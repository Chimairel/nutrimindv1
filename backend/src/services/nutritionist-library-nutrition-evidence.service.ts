import {
  FlagStatus,
  MealIngredientDataSource,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyReviewOutcome,
  MealLibraryStatus,
  MealNutritionEvidenceSource,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { reconcileFnriMealTotals } from '@/domain/fnri-meal-totals.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import type { PrepareLibraryNutritionEvidenceInput } from '@/domain/library-nutrition-evidence.schema';
import { suspendMealClearancesForEvidenceChange } from './condition-clearance.service';

const COMPOSITION_SOURCES = ['FNRI', 'USDA_FDC'] as const;
const NUTRIENT_KEYS = [
  ['fiber', 'fiberG'],
  ['sodium', 'sodiumMg'],
  ['potassium', 'potassiumMg'],
] as const;

type CompositionFood = {
  id: string;
  name: string;
  source: string;
  sourceRecordId: string | null;
  sourceReferenceUrl: string | null;
  compositionRevision: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiber: number | null;
  sodium: number | null;
  potassium: number | null;
};

export function calculateLibraryNutritionEvidence(
  ingredients: readonly { foodItemId: string; gramsPerServing: number }[],
  foods: readonly CompositionFood[]
) {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const portions = ingredients.map((ingredient) => ({
    foodItemId: ingredient.foodItemId,
    quantity: ingredient.gramsPerServing,
    unit: 'g',
  }));
  const macros = reconcileFnriMealTotals(portions, foods, COMPOSITION_SOURCES);
  if (!macros.complete)
    throw new Error('Every ingredient needs a specific FNRI or USDA food record and edible grams per serving.');
  const nutrients = Object.fromEntries(
    NUTRIENT_KEYS.map(([sourceKey, resultKey]) => {
      const complete = ingredients.every((ingredient) => {
        const value = byId.get(ingredient.foodItemId)?.[sourceKey];
        return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
      });
      const value = complete
        ? Math.round(
            ingredients.reduce(
              (total, ingredient) =>
                total + (byId.get(ingredient.foodItemId)![sourceKey]! * ingredient.gramsPerServing) / 100,
              0
            ) * 10
          ) / 10
        : null;
      return [resultKey, value];
    })
  ) as { fiberG: number | null; sodiumMg: number | null; potassiumMg: number | null };
  return { ...macros.totals, ...nutrients };
}

export async function searchLibraryCompositionFoods(search: string, source: 'FNRI' | 'USDA_FDC' = 'FNRI') {
  const term = search.trim();
  if (term.length < 2 || term.length > 80) return [];
  return prisma.foodItem.findMany({
    where: {
      source,
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: term, mode: 'insensitive' }, verifiedAt: { not: null } } } },
      ],
    },
    select: { id: true, name: true, source: true, sourceRecordId: true, sourceReferenceUrl: true },
    orderBy: [{ source: 'asc' }, { name: 'asc' }],
    take: 20,
  });
}

export async function prepareLibraryNutritionEvidence(
  nutritionistProfileId: string,
  mealId: string,
  input: PrepareLibraryNutritionEvidenceInput
) {
  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    include: { user: { select: { role: true } } },
  });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer)) {
    throw new Error('Only a currently verified nutritionist can prepare recipe nutrition evidence.');
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
        const meal = await tx.mealLibrary.findUnique({
          where: { id: mealId },
          include: { ingredients: { orderBy: { position: 'asc' } }, flags: { where: { status: FlagStatus.PENDING } } },
        });
        if (!meal) throw new Error('Meal not found.');
        if (meal.status !== MealLibraryStatus.APPROVED || meal.flags.length) {
          throw new Error('Flagged or archived meals cannot be prepared for certification.');
        }
        if (meal.safetyEvidenceRevision !== input.expectedRevision) {
          throw new Error('Evidence revision conflict. Refresh the meal before editing nutrition evidence.');
        }
        const inputById = new Map(input.ingredients.map((ingredient) => [ingredient.id, ingredient]));
        if (
          !meal.ingredients.length ||
          meal.ingredients.length !== inputById.size ||
          meal.ingredients.some((ingredient) => !inputById.has(ingredient.id))
        ) {
          throw new Error('Every saved recipe ingredient must have one food record and edible gram amount.');
        }
        const foodIds = [...new Set(input.ingredients.map((ingredient) => ingredient.foodItemId))];
        const foods = await tx.foodItem.findMany({
          where: { id: { in: foodIds }, source: { in: [...COMPOSITION_SOURCES] } },
          select: {
            id: true,
            name: true,
            source: true,
            sourceRecordId: true,
            sourceReferenceUrl: true,
            compositionRevision: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            fiber: true,
            sodium: true,
            potassium: true,
          },
        });
        if (foods.length !== foodIds.length)
          throw new Error('Each selected food must be an FNRI or USDA composition record.');
        const byId = new Map(foods.map((food) => [food.id, food]));
        const revisedIngredients = meal.ingredients.map((ingredient) => {
          const submitted = inputById.get(ingredient.id)!;
          const food = byId.get(submitted.foodItemId)!;
          return {
            id: ingredient.id,
            ingredientName: ingredient.ingredientName,
            category: ingredient.category,
            foodItemId: food.id,
            dataSource: food.source === 'FNRI' ? MealIngredientDataSource.FNRI : MealIngredientDataSource.USDA_FDC,
            quantity: submitted.gramsPerServing,
            unit: 'g',
          };
        });
        const totals = calculateLibraryNutritionEvidence(input.ingredients, foods);
        const recipeSignature = buildMealLibraryRecipeSignature({
          ...meal,
          ...totals,
          ingredients: revisedIngredients,
        });
        const nextRevision = meal.safetyEvidenceRevision + 1;
        const now = new Date();
        const wasCertified = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
        const claimed = await tx.mealLibrary.updateMany({
          where: { id: mealId, safetyEvidenceRevision: input.expectedRevision, status: MealLibraryStatus.APPROVED },
          data: {
            ...totals,
            sugarG: null,
            phosphorusMg: null,
            saturatedFatG: null,
            nutritionEvidenceSource: revisedIngredients.some(
              (ingredient) => ingredient.dataSource === MealIngredientDataSource.USDA_FDC
            )
              ? MealNutritionEvidenceSource.NUTRITIONIST_EDITED
              : MealNutritionEvidenceSource.FNRI_RECONCILED,
            nutritionServingDescription: meal.nutritionServingDescription ?? '1 recipe serving',
            recipeSignature,
            safetyEvidenceRevision: nextRevision,
            ...(wasCertified
              ? {
                  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
                  safetyInvalidatedAt: now,
                  safetyInvalidationReason: 'NUTRITION_EVIDENCE_CHANGED',
                }
              : {}),
          },
        });
        if (claimed.count !== 1)
          throw new Error('Evidence revision conflict. Refresh the meal before editing nutrition evidence.');
        for (const ingredient of revisedIngredients) {
          await tx.mealLibraryIngredient.update({
            where: { id: ingredient.id },
            data: {
              foodItemId: ingredient.foodItemId,
              dataSource: ingredient.dataSource,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            },
          });
        }
        if (wasCertified) {
          await suspendMealClearancesForEvidenceChange(tx, mealId, 'NUTRITION_EVIDENCE_CHANGED');
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId,
              nutritionistProfileId,
              outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
              evidenceRevision: nextRevision,
              reasonCode: 'NUTRITION_EVIDENCE_CHANGED',
              evidenceSnapshot: { previousCertifiedRevision: meal.certifiedEvidenceRevision, nextRevision },
            },
          });
        }
        const evidenceSnapshot = {
          revision: nextRevision,
          recipeSignature,
          portionBasis: input.portionBasis,
          previousTotals: {
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
          },
          totals,
          ingredients: revisedIngredients.map((ingredient) => {
            const food = byId.get(ingredient.foodItemId)!;
            const previous = meal.ingredients.find((item) => item.id === ingredient.id)!;
            return {
              ingredientId: ingredient.id,
              recipeLabel: ingredient.ingredientName,
              previousFoodItemId: previous.foodItemId,
              previousQuantity: previous.quantity,
              previousUnit: previous.unit,
              foodItemId: food.id,
              foodName: food.name,
              source: food.source,
              sourceRecordId: food.sourceRecordId,
              sourceReferenceUrl: food.sourceReferenceUrl,
              compositionRevision: food.compositionRevision,
              gramsPerServing: ingredient.quantity,
            };
          }),
        };
        await tx.auditEvent.create({
          data: {
            action: 'NUTRITION_EVIDENCE_PREPARED',
            entityType: 'MealLibrary',
            entityId: mealId,
            actorUserId: reviewer.userId,
            metadata: evidenceSnapshot as Prisma.InputJsonValue,
          },
        });
        return { revision: nextRevision, totals, hasUsda: foods.some((food) => food.source === 'USDA_FDC') };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('This exact recipe already exists. Resolve the duplicate before preparing evidence.');
    }
    throw error;
  }
}
