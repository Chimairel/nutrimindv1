import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { MealNutritionEvidenceSource, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const sourcePath = sourceArg
  ? path.resolve(sourceArg.slice('--source='.length))
  : path.resolve('prisma/data/panlasang-pinoy-recipes.json');

interface SourceRecipe {
  sourceUrl: string;
  nutritionPerServing?: {
    servingSize?: string | null;
    sodiumMg?: number | null;
    sugarG?: number | null;
    fiberG?: number | null;
    potassiumMg?: number | null;
    phosphorusMg?: number | null;
    saturatedFatG?: number | null;
  };
}

function sourceUrlFromDescription(description: string | null): string | null {
  return description?.match(/Source: (https:\/\/panlasangpinoy\.com\/[^\s]+)/u)?.[1] ?? null;
}

async function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Panlasang source JSON not found: ${sourcePath}`);
  const recipes = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as SourceRecipe[];
  const sourceByUrl = new Map(recipes.map((recipe) => [recipe.sourceUrl, recipe]));
  const meals = await prisma.mealLibrary.findMany({
    where: { description: { contains: 'Source: https://panlasangpinoy.com/' } },
    select: { id: true, description: true },
    orderBy: { id: 'asc' },
  });
  const matches = meals.flatMap((meal) => {
    const url = sourceUrlFromDescription(meal.description);
    const recipe = url ? sourceByUrl.get(url) : null;
    return recipe?.nutritionPerServing ? [{ meal, nutrition: recipe.nutritionPerServing }] : [];
  });
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    sourceRecipes: recipes.length,
    databaseCorpusRows: meals.length,
    matchedRows: matches.length,
    unmatchedRows: meals.length - matches.length,
    withSodium: matches.filter(({ nutrition }) => nutrition.sodiumMg != null).length,
    withSugar: matches.filter(({ nutrition }) => nutrition.sugarG != null).length,
    withFiber: matches.filter(({ nutrition }) => nutrition.fiberG != null).length,
    withPotassium: matches.filter(({ nutrition }) => nutrition.potassiumMg != null).length,
    withPhosphorus: matches.filter(({ nutrition }) => nutrition.phosphorusMg != null).length,
    withSaturatedFat: matches.filter(({ nutrition }) => nutrition.saturatedFatG != null).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;

  let updated = 0;
  let cursor = 0;
  const workers = Array.from({ length: 12 }, async () => {
    while (cursor < matches.length) {
      const current = matches[cursor++];
      const { meal, nutrition } = current;
      await prisma.mealLibrary.update({
        where: { id: meal.id },
        data: {
          sodiumMg: nutrition.sodiumMg ?? null,
          sugarG: nutrition.sugarG ?? null,
          fiberG: nutrition.fiberG ?? null,
          potassiumMg: nutrition.potassiumMg ?? null,
          phosphorusMg: nutrition.phosphorusMg ?? null,
          saturatedFatG: nutrition.saturatedFatG ?? null,
          nutritionServingDescription: nutrition.servingSize?.slice(0, 180) ?? '1 recipe serving',
          nutritionEvidenceSource: MealNutritionEvidenceSource.SOURCE_PUBLISHED,
        },
      });
      updated += 1;
    }
  });
  await Promise.all(workers);
  console.log(JSON.stringify({ applied: true, updatedRows: updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
