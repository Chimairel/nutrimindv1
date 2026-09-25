import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { createUsdaCompositionMatcher, USDA_FDC_SOURCE } from '../src/domain/usda-food-composition.policy';
import {
  isInvalidSourceIngredientLabel,
  normalizeSourceIngredientName,
} from '../src/domain/source-ingredient-fnri-match.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function ingredientRows(value: Prisma.JsonValue): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Prisma.JsonObject => !!row && typeof row === 'object' && !Array.isArray(row))
    : [];
}

async function main() {
  const [foods, aliases, recipes] = await Promise.all([
    prisma.foodItem.findMany({
      where: { source: USDA_FDC_SOURCE },
      select: { id: true, name: true, source: true, sourceRecordId: true },
    }),
    prisma.foodAlias.findMany({
      where: { verifiedAt: { not: null }, foodItem: { source: USDA_FDC_SOURCE } },
      select: { alias: true, foodItemId: true, verifiedAt: true },
    }),
    prisma.rawRecipeCandidate.findMany({
      where: { sourceName: 'PANLASANG_PINOY' },
      select: { id: true, ingredients: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const match = createUsdaCompositionMatcher(foods, aliases);
  let matched = 0;
  let alreadyLinked = 0;
  let unresolved = 0;
  const changes: Array<{ id: string; ingredients: Record<string, unknown>[] }> = [];
  for (const recipe of recipes) {
    let changed = false;
    const ingredients = ingredientRows(recipe.ingredients).map((row) => {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (typeof row.foodItemId === 'string' && row.foodItemId) {
        alreadyLinked += 1;
        return row;
      }
      if (!name || isInvalidSourceIngredientLabel(name)) return row;
      const food = match(normalizeSourceIngredientName(name));
      if (!food) {
        unresolved += 1;
        return row;
      }
      matched += 1;
      changed = true;
      return {
        ...row,
        foodItemId: food.id,
        usdaFdcId: food.sourceRecordId,
        usdaFoodName: food.name,
        compositionIdentitySource: USDA_FDC_SOURCE,
      };
    });
    if (changed) changes.push({ id: recipe.id, ingredients });
  }
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    recipes: recipes.length,
    existingUsdaFoods: foods.length,
    alreadyLinked,
    matched,
    unresolved,
    recipesToUpdate: changes.length,
  };
  console.log(JSON.stringify(summary));
  if (!APPLY) return;
  for (let offset = 0; offset < changes.length; offset += 50) {
    await prisma.$transaction(
      changes.slice(offset, offset + 50).map((entry) =>
        prisma.rawRecipeCandidate.update({
          where: { id: entry.id },
          data: { ingredients: entry.ingredients as Prisma.InputJsonValue },
        })
      )
    );
  }
  await prisma.auditEvent.create({
    data: { action: 'PANLASANG_USDA_IDENTITY_RECONCILIATION', entityType: 'RawRecipeCandidate', metadata: summary },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
