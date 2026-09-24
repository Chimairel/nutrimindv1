import 'dotenv/config';
import { MealCandidateProvenance, Prisma, PrismaClient } from '@prisma/client';
import {
  createSourceIngredientFnriMatcher,
  isInvalidSourceIngredientLabel,
  SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
  type SourceIngredientMatchMethod,
} from '../src/domain/source-ingredient-fnri-match.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

type IngredientRecord = Record<string, unknown> & { name?: unknown };
type MatchStatus = 'MATCHED' | 'UNRESOLVED' | 'INVALID_SOURCE_FRAGMENT';

interface EnrichedIngredient extends IngredientRecord {
  foodItemId: string | null;
  fnriFoodName: string | null;
  fnriMatchMethod: SourceIngredientMatchMethod | null;
  fnriMatchStatus: MatchStatus;
  fnriMappingVersion: string;
  excludedFromPlanning: boolean;
}

function ingredientRecords(value: Prisma.JsonValue): IngredientRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is IngredientRecord => !!item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

async function main() {
  const [foods, recipes] = await Promise.all([
    prisma.foodItem.findMany({
      where: { source: 'FNRI' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.rawRecipeCandidate.findMany({
      where: { sourceName: 'PANLASANG_PINOY' },
      select: { id: true, ingredients: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const matcher = createSourceIngredientFnriMatcher(foods);
  const methodCounts: Record<SourceIngredientMatchMethod, number> = {
    CANONICAL_NAME: 0,
    CURATED_EQUIVALENT: 0,
    UNIQUE_LEXICAL_MATCH: 0,
  };
  const unresolved = new Map<string, number>();
  const invalid = new Map<string, number>();
  const recipeUpdates: Array<{ id: string; ingredients: EnrichedIngredient[] }> = [];
  let occurrences = 0;
  let matchedOccurrences = 0;
  let unresolvedOccurrences = 0;
  let invalidOccurrences = 0;

  for (const recipe of recipes) {
    const enriched = ingredientRecords(recipe.ingredients).map((ingredient): EnrichedIngredient => {
      occurrences += 1;
      const name = typeof ingredient.name === 'string' ? ingredient.name.trim() : '';
      const match = matcher.match(name);
      const isInvalid = isInvalidSourceIngredientLabel(name);
      if (match) {
        matchedOccurrences += 1;
        methodCounts[match.method] += 1;
      } else if (isInvalid) {
        invalidOccurrences += 1;
        invalid.set(name || '(blank)', (invalid.get(name || '(blank)') ?? 0) + 1);
      } else {
        unresolvedOccurrences += 1;
        unresolved.set(name || '(blank)', (unresolved.get(name || '(blank)') ?? 0) + 1);
      }
      return {
        ...ingredient,
        foodItemId: match?.food.id ?? null,
        fnriFoodName: match?.food.name ?? null,
        fnriMatchMethod: match?.method ?? null,
        fnriMatchStatus: match ? 'MATCHED' : isInvalid ? 'INVALID_SOURCE_FRAGMENT' : 'UNRESOLVED',
        fnriMappingVersion: SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
        excludedFromPlanning: isInvalid,
      };
    });
    if (JSON.stringify(enriched) !== JSON.stringify(recipe.ingredients))
      recipeUpdates.push({ id: recipe.id, ingredients: enriched });
  }

  const planIngredients = await prisma.mealIngredient.findMany({
    where: {
      mealPlan: {
        candidateProvenance: MealCandidateProvenance.RAW_RECIPE_CORPUS,
        sourceRawRecipeCandidate: { sourceName: 'PANLASANG_PINOY' },
      },
    },
    select: { id: true, ingredientName: true, foodItemId: true },
    orderBy: { id: 'asc' },
  });
  const planUpdates = planIngredients.flatMap((ingredient) => {
    const match = matcher.match(ingredient.ingredientName);
    return match && ingredient.foodItemId !== match.food.id ? [{ id: ingredient.id, foodItemId: match.food.id }] : [];
  });
  const invalidPlanIngredientIds = planIngredients
    .filter((ingredient) => isInvalidSourceIngredientLabel(ingredient.ingredientName))
    .map((ingredient) => ingredient.id);

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    mappingVersion: SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
    fnriFoods: foods.length,
    recipesVisited: recipes.length,
    recipesToUpdate: recipeUpdates.length,
    ingredientOccurrences: occurrences,
    matchedOccurrences,
    unresolvedOccurrences,
    invalidOccurrences,
    methodCounts,
    planIngredientsVisited: planIngredients.length,
    planIngredientsToLink: planUpdates.length,
    invalidPlanIngredientsToRemove: invalidPlanIngredientIds.length,
    topUnresolved: [...unresolved.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 30)
      .map(([name, count]) => ({ name, count })),
    invalidSourceFragments: [...invalid.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([name, count]) => ({ name, count })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) return;

  for (let offset = 0; offset < recipeUpdates.length; offset += 50) {
    await prisma.$transaction(
      recipeUpdates.slice(offset, offset + 50).map((entry) =>
        prisma.rawRecipeCandidate.update({
          where: { id: entry.id },
          data: { ingredients: entry.ingredients as unknown as Prisma.InputJsonValue },
        })
      )
    );
  }
  for (let offset = 0; offset < planUpdates.length; offset += 100) {
    await prisma.$transaction(
      planUpdates
        .slice(offset, offset + 100)
        .map((entry) =>
          prisma.mealIngredient.update({ where: { id: entry.id }, data: { foodItemId: entry.foodItemId } })
        )
    );
  }
  if (invalidPlanIngredientIds.length) {
    await prisma.mealIngredient.deleteMany({ where: { id: { in: invalidPlanIngredientIds } } });
  }
  await prisma.auditEvent.create({
    data: {
      action: 'PANLASANG_FNRI_IDENTITY_RECONCILIATION',
      entityType: 'RawRecipeCandidate',
      metadata: summary as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(
    JSON.stringify(
      { applied: true, recipeRowsUpdated: recipeUpdates.length, planRowsLinked: planUpdates.length },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
