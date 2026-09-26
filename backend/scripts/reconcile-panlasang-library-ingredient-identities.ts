import 'dotenv/config';
import { MealLibrarySafetyEvidenceStatus, Prisma, PrismaClient } from '@prisma/client';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import {
  createSourceIngredientFnriMatcher,
  normalizeSourceIngredientName,
} from '../src/domain/source-ingredient-fnri-match.policy';
import { createUsdaCompositionMatcher, USDA_FDC_SOURCE } from '../src/domain/usda-food-composition.policy';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const oneMealId = process.argv.find((arg) => arg.startsWith('--meal-id='))?.slice('--meal-id='.length);

async function main() {
  const [fnriFoods, fnriAliases, usdaFoods, usdaAliases, meals] = await Promise.all([
    prisma.foodItem.findMany({ where: { source: 'FNRI' }, select: { id: true, name: true } }),
    prisma.foodAlias.findMany({
      where: { verifiedAt: { not: null }, foodItem: { source: 'FNRI' } },
      select: { alias: true, foodItemId: true, verifiedAt: true },
    }),
    prisma.foodItem.findMany({ where: { source: USDA_FDC_SOURCE }, select: { id: true, name: true, source: true } }),
    prisma.foodAlias.findMany({
      where: { verifiedAt: { not: null }, foodItem: { source: USDA_FDC_SOURCE } },
      select: { alias: true, foodItemId: true, verifiedAt: true },
    }),
    prisma.mealLibrary.findMany({
      where: {
        ...(oneMealId ? { id: oneMealId } : { description: { contains: 'panlasangpinoy.com', mode: 'insensitive' } }),
        safetyEvidenceStatus: { not: MealLibrarySafetyEvidenceStatus.COMPLETE },
      },
      include: { ingredients: { orderBy: { position: 'asc' } } },
      orderBy: { id: 'asc' },
    }),
  ]);
  const fnri = createSourceIngredientFnriMatcher(fnriFoods, fnriAliases);
  const usda = createUsdaCompositionMatcher(usdaFoods, usdaAliases);
  const matchCache = new Map<string, string | null>();
  const match = (name: string) => {
    if (!matchCache.has(name)) {
      matchCache.set(name, fnri.match(name)?.food.id ?? usda(normalizeSourceIngredientName(name))?.id ?? null);
    }
    return matchCache.get(name) ?? null;
  };
  const updates = meals.flatMap((meal) => {
    if (!meal.description.toLowerCase().includes('panlasangpinoy.com')) return [];
    const links = meal.ingredients.flatMap((ingredient) => {
      if (ingredient.foodItemId) return [];
      const foodItemId = match(ingredient.ingredientName);
      return foodItemId ? [{ id: ingredient.id, foodItemId, name: ingredient.ingredientName }] : [];
    });
    if (!links.length) return [];
    const byId = new Map(links.map((link) => [link.id, link.foodItemId]));
    const recipeSignature = buildMealLibraryRecipeSignature({
      ...meal,
      ingredients: meal.ingredients.map((ingredient) => ({
        ...ingredient,
        foodItemId: byId.get(ingredient.id) ?? ingredient.foodItemId,
      })),
    });
    return [{ meal, links, recipeSignature }];
  });
  const signatureCounts = new Map<string, number>();
  for (const update of updates)
    signatureCounts.set(update.recipeSignature, (signatureCounts.get(update.recipeSignature) ?? 0) + 1);
  const projectedCollisions = updates.filter((update) => (signatureCounts.get(update.recipeSignature) ?? 0) > 1);
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    mealsVisited: meals.length,
    mealsWithLinks: updates.length,
    fnriLinks: updates.flatMap((update) => update.links).filter((link) => !link.foodItemId.startsWith('USDA_FDC_'))
      .length,
    usdaLinks: updates.flatMap((update) => update.links).filter((link) => link.foodItemId.startsWith('USDA_FDC_'))
      .length,
    projectedSignatureCollisions: projectedCollisions.length,
    collisionMeals: projectedCollisions.map((update) => ({ id: update.meal.id, mealName: update.meal.mealName })),
    sample: updates
      .filter((update) => update.meal.mealName === 'Chao Fan')
      .map((update) => ({
        mealName: update.meal.mealName,
        links: update.links.map(({ name, foodItemId }) => ({ name, foodItemId })),
        remainingUnlinked:
          update.meal.ingredients.length -
          update.meal.ingredients.filter((ingredient) => ingredient.foodItemId).length -
          update.links.length,
      })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;

  let appliedMeals = 0;
  let appliedLinks = 0;
  let skippedConflicts = 0;
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < updates.length) {
      const update = updates[nextIndex++];
      if ((signatureCounts.get(update.recipeSignature) ?? 0) > 1) {
        skippedConflicts++;
        continue;
      }
      const existingSignature = await prisma.mealLibrary.findFirst({
        where: { recipeSignature: update.recipeSignature, id: { not: update.meal.id } },
        select: { id: true },
      });
      if (existingSignature) {
        skippedConflicts++;
        continue;
      }
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
            const claimed = await tx.mealLibrary.updateMany({
              where: {
                id: update.meal.id,
                recipeSignature: update.meal.recipeSignature,
                safetyEvidenceRevision: update.meal.safetyEvidenceRevision,
                safetyEvidenceStatus: { not: MealLibrarySafetyEvidenceStatus.COMPLETE },
              },
              data: {
                recipeSignature: update.recipeSignature,
                safetyEvidenceRevision: { increment: 1 },
              },
            });
            if (claimed.count !== 1) throw new Error('Concurrent library evidence change');
            for (const link of update.links) {
              const linked = await tx.mealLibraryIngredient.updateMany({
                where: { id: link.id, mealLibraryId: update.meal.id, foodItemId: null },
                data: { foodItemId: link.foodItemId },
              });
              if (linked.count !== 1) throw new Error('Concurrent ingredient evidence change');
            }
          },
          { maxWait: 30_000, timeout: 60_000 }
        );
        appliedMeals++;
        appliedLinks += update.links.length;
        if (appliedMeals % 100 === 0) console.log(JSON.stringify({ appliedMeals, appliedLinks, skippedConflicts }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          skippedConflicts++;
          continue;
        }
        throw error;
      }
    }
  }
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => worker()));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  await prisma.auditEvent.create({
    data: {
      action: 'PANLASANG_LIBRARY_IDENTITY_RECONCILIATION',
      entityType: 'MealLibrary',
      metadata: { ...summary, sample: [], appliedMeals, appliedLinks, skippedConflicts } as Prisma.InputJsonValue,
    },
  });
  console.log(JSON.stringify({ appliedMeals, appliedLinks, skippedConflicts }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
