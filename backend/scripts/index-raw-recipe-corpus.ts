import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DietaryPreference, MealType, Prisma, PrismaClient } from '@prisma/client';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DEFAULT_SOURCE = path.resolve(
  'C:/Users/chima/Desktop/Nutrimind/backend/prisma/data/panlasang-pinoy-recipes.json'
);

type RawIngredient = { name?: unknown; quantity?: unknown; unit?: unknown; text?: unknown };
type RawRecipe = {
  id?: unknown;
  name?: unknown;
  sourceUrl?: unknown;
  image?: unknown;
  youtubeUrl?: unknown;
  category?: unknown;
  cuisine?: unknown;
  description?: unknown;
  originalServings?: unknown;
  nutritionPerServing?: Record<string, unknown> | null;
  ingredients1Person?: RawIngredient[];
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function finite(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : null;
}

function inferMealType(recipe: RawRecipe): MealType {
  const text = `${normalize(recipe.name)} ${normalize(recipe.category)}`;
  if (/\b(breakfast|pancake|omelet|omelette|tapsilog|longsilog|tocilog|french toast)\b/u.test(text)) {
    return MealType.BREAKFAST;
  }
  if (/\b(snack|dessert|cookie|cake|bread|muffin|candy|drink|beverage|shake|smoothie|salad)\b/u.test(text)) {
    return MealType.SNACK;
  }
  return /\b(dinner|supper)\b/u.test(text) ? MealType.DINNER : MealType.LUNCH;
}

function signature(recipe: RawRecipe): string {
  const nutrition = recipe.nutritionPerServing ?? {};
  const ingredients = (recipe.ingredients1Person ?? [])
    .map((ingredient) => normalize(ingredient.name ?? ingredient.text))
    .filter(Boolean)
    .sort();
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'RAW_RECIPE_SIGNATURE_V1',
        name: normalize(recipe.name),
        category: normalize(recipe.category),
        calories: finite(nutrition.calories),
        proteinG: finite(nutrition.proteinG),
        carbsG: finite(nutrition.carbsG),
        fatG: finite(nutrition.fatG),
        ingredients,
      })
    )
    .digest('hex');
}

async function main() {
  const sourcePath = process.env.PANLASANG_RAW_CORPUS_PATH || DEFAULT_SOURCE;
  const parsed = JSON.parse(await readFile(sourcePath, 'utf8')) as RawRecipe[];
  if (!Array.isArray(parsed)) throw new Error('Raw recipe corpus must be a JSON array.');

  const unique = new Map<string, RawRecipe>();
  let malformed = 0;
  for (const recipe of [...parsed].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!normalize(recipe.id) || !normalize(recipe.name) || !String(recipe.sourceUrl ?? '').startsWith('http')) {
      malformed += 1;
      continue;
    }
    const contentSignature = signature(recipe);
    if (!unique.has(contentSignature)) unique.set(contentSignature, recipe);
  }

  const exactDuplicates = parsed.length - malformed - unique.size;
  const summary = { raw: parsed.length, uniqueContent: unique.size, exactDuplicates, malformed, apply: APPLY };
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) return;

  const keepSignatures = [...unique.keys()];
  const rows: Prisma.RawRecipeCandidateCreateManyInput[] = [];
  for (const [contentSignature, recipe] of unique) {
    const rawIngredients = recipe.ingredients1Person ?? [];
    const ingredients = rawIngredients.map((ingredient) => ({
      name: String(ingredient.name ?? ingredient.text ?? '').trim(),
      quantity: finite(ingredient.quantity),
      unit: String(ingredient.unit ?? '').trim() || null,
    }));
    const classification = classifyMealIngredients(ingredients);
    const nutrition = recipe.nutritionPerServing ?? null;
    const tags = classification.compatibleDietaryPreferences.length
      ? classification.compatibleDietaryPreferences
      : [DietaryPreference.OMNIVORE];
    const sourceRecordId = String(recipe.id);

    rows.push({
      sourceRecordId,
      sourceUrl: String(recipe.sourceUrl),
      sourceImageUrl: recipe.image ? String(recipe.image) : null,
      sourceVideoUrl: recipe.youtubeUrl ? String(recipe.youtubeUrl) : null,
      recipeName: String(recipe.name).trim(),
      normalizedName: normalize(recipe.name),
      contentSignature,
      category: recipe.category ? String(recipe.category) : null,
      cuisines: Array.isArray(recipe.cuisine) ? recipe.cuisine.map(String) : [],
      description: recipe.description ? String(recipe.description) : null,
      mealType: inferMealType(recipe),
      dietaryTags: tags,
      ingredients: ingredients as unknown as Prisma.InputJsonValue,
      publishedNutrition: nutrition ? (nutrition as Prisma.InputJsonValue) : Prisma.JsonNull,
      calories: finite(nutrition?.calories),
      proteinG: finite(nutrition?.proteinG),
      carbsG: finite(nutrition?.carbsG),
      fatG: finite(nutrition?.fatG),
      originalServings: finite(recipe.originalServings),
      status: 'AVAILABLE',
    });
  }
  for (let offset = 0; offset < rows.length; offset += 200) {
    await prisma.rawRecipeCandidate.createMany({ data: rows.slice(offset, offset + 200), skipDuplicates: true });
  }
  await prisma.rawRecipeCandidate.updateMany({
    where: { contentSignature: { in: keepSignatures } },
    data: { status: 'AVAILABLE' },
  });
  await prisma.rawRecipeCandidate.updateMany({
    where: { contentSignature: { notIn: keepSignatures } },
    data: { status: 'RETIRED' },
  });
  console.log(`Indexed ${unique.size} content-distinct recipes; retired corpus rows absent from this snapshot.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
