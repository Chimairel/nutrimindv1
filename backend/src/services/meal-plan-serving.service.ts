import type { Prisma } from '@prisma/client';
import { buildComposedServing } from '@/domain/composed-serving.policy';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';

export interface BaseServingInput {
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  recipeSignature?: string | null;
  ingredients: readonly {
    ingredientName: string;
    foodItemId?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
  evidenceSource: string;
}

export function buildBaseServingPersistence(input: BaseServingInput) {
  const baseRecipeSignature =
    input.recipeSignature ??
    buildMealLibraryRecipeSignature({
      mealName: input.mealName,
      mealType: input.mealType,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      ingredients: input.ingredients,
    });
  return {
    baseRecipeSignature,
    composedServingSignature: baseRecipeSignature,
    servingComponents: {
      create: {
        componentType: 'BASE_RECIPE' as const,
        position: 0,
        quantityG: null,
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        evidenceSource: input.evidenceSource,
      },
    },
  };
}

export async function replacePlanBaseServing(
  tx: Prisma.TransactionClient,
  mealPlanId: string,
  input: BaseServingInput
) {
  const persistence = buildBaseServingPersistence(input);
  await tx.mealPlanServingComponent.deleteMany({ where: { mealPlanId } });
  await tx.mealPlanServingComponent.create({ data: { mealPlanId, ...persistence.servingComponents.create } });
  await tx.mealPlan.update({
    where: { id: mealPlanId },
    data: {
      baseRecipeSignature: persistence.baseRecipeSignature,
      composedServingSignature: persistence.composedServingSignature,
    },
  });
  return persistence;
}

/**
 * Adds reviewed paired rice to a plan as explicit evidence. Callers must pass
 * the governed FNRI rice identity; this service refuses unreviewed rice roles.
 */
export async function composePlanWithPairedRice(
  tx: Prisma.TransactionClient,
  input: { mealPlanId: string; cookedRiceG: number; fnriRiceFoodItemId: string }
) {
  const plan = await tx.mealPlan.findUniqueOrThrow({
    where: { id: input.mealPlanId },
    include: {
      libraryMeal: true,
      servingComponents: { orderBy: { position: 'asc' } },
      clearanceUsages: { include: { clearance: { select: { composedServingSignature: true } } } },
    },
  });
  if (
    !plan.libraryMeal ||
    plan.libraryMeal.riceRole !== 'PAIR_WITH_RICE' ||
    plan.libraryMeal.riceRoleReviewStatus !== 'REVIEWED'
  ) {
    throw new Error('Only a reviewed PAIR_WITH_RICE recipe can receive a rice component.');
  }
  if (!plan.baseRecipeSignature) throw new Error('Plan has no current base recipe signature.');
  const baseComponent = plan.servingComponents.find((component) => component.componentType === 'BASE_RECIPE');
  if (!baseComponent) throw new Error('Plan has no current base serving component.');
  const rice = await tx.foodItem.findUniqueOrThrow({ where: { id: input.fnriRiceFoodItemId } });
  const composed = buildComposedServing({
    baseRecipeSignature: plan.baseRecipeSignature,
    baseNutrition: {
      calories: baseComponent.calories,
      proteinG: baseComponent.proteinG,
      carbsG: baseComponent.carbsG,
      fatG: baseComponent.fatG,
    },
    riceFood: rice,
    cookedRiceG: input.cookedRiceG,
  });
  if (
    plan.clearanceUsages.some(
      (usage) => usage.clearance.composedServingSignature !== composed.composedServingSignature
    )
  ) {
    throw new Error('This rice composition requires explicit condition clearance for the composed serving.');
  }
  await tx.mealPlanServingComponent.deleteMany({ where: { mealPlanId: plan.id, componentType: 'COOKED_RICE' } });
  await tx.mealPlanServingComponent.create({
    data: {
      mealPlanId: plan.id,
      componentType: 'COOKED_RICE',
      position: 1,
      foodItemId: rice.id,
      quantityG: input.cookedRiceG,
      ...composed.riceNutrition,
      evidenceSource: `FNRI:${rice.compositionRevision}`,
    },
  });
  await tx.mealPlan.update({
    where: { id: plan.id },
    data: { ...composed.total, composedServingSignature: composed.composedServingSignature },
  });
  await tx.mealPlanClearanceUsage.updateMany({
    where: { mealPlanId: plan.id },
    data: { composedServingSignature: composed.composedServingSignature },
  });
  return composed;
}
