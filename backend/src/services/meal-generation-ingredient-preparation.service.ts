import { AIConfidenceFlag, MealCandidateProvenance, MealIngredientDataSource, MealType } from '@prisma/client';
import { reconcileFnriMealTotals } from '@/domain/fnri-meal-totals.policy';
import { lookupIngredient } from '@/lib/fnri';
import prisma from '@/lib/prisma';
import type { PreparationRankingReasonCode } from '@/domain/upcoming-preparation.policy';

export interface GroundedFoodReference {
  id: string;
  name: string;
  category: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface GeneratedMeal {
  dayNumber: number;
  mealType: MealType;
  mealName: string;
  description: string;
  ingredients: { foodItemId: string | null; name: string; quantity?: number; unit?: string }[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rawCandidateId?: string;
  candidateProvenance?: MealCandidateProvenance;
  candidateRank?: number;
  rankingScore?: number;
  rankingReasonCodes?: PreparationRankingReasonCode[];
}

export interface PreparedGeneratedMeal {
  mealType: MealType;
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: Date;
  aiConfidenceFlag: AIConfidenceFlag;
  rawCandidateId?: string;
  candidateProvenance: MealCandidateProvenance;
  candidateRank?: number;
  rankingScore?: number;
  rankingReasonCodes?: PreparationRankingReasonCode[];
  ingredientsData: Array<{
    ingredientName: string;
    category: string;
    foodItemId: string | null;
    dataSource: MealIngredientDataSource;
    quantity?: number;
    unit?: string;
  }>;
}

export async function prepareGeneratedMealIngredients(input: {
  meals: readonly GeneratedMeal[];
  unmatchedSlots: ReadonlyArray<{ dayNumber: number; mealType: MealType; scheduledDate: Date }>;
  startDate: Date;
  userHasConditions: boolean;
  groundedFoodById: ReadonlyMap<string, GroundedFoodReference>;
}): Promise<{ preparedMeals: PreparedGeneratedMeal[]; compositionRevisions: Map<string, number> }> {
  const preparedMeals: PreparedGeneratedMeal[] = [];
  const compositionRevisions = new Map<string, number>();

  for (const rawMeal of input.meals) {
    const slot = input.unmatchedSlots.find(
      (candidate) => candidate.dayNumber === rawMeal.dayNumber && candidate.mealType === rawMeal.mealType
    );
    const scheduledDate = slot ? slot.scheduledDate : new Date(input.startDate);
    let hasEstimatedIngredient = false;
    const ingredientsData: PreparedGeneratedMeal['ingredientsData'] = [];

    for (const ingredient of rawMeal.ingredients) {
      const ingredientName = ingredient.name;
      if (
        rawMeal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS &&
        (ingredient.quantity === undefined || ingredient.quantity <= 0)
      ) {
        hasEstimatedIngredient = true;
        ingredientsData.push({
          ingredientName,
          category: 'PANTRY',
          foodItemId: null,
          dataSource: MealIngredientDataSource.SOURCE_RECIPE,
        });
        continue;
      }

      const groundedFood = ingredient.foodItemId ? input.groundedFoodById.get(ingredient.foodItemId) : undefined;
      if (groundedFood) {
        ingredientsData.push({
          ingredientName: groundedFood.name,
          category: groundedFood.category || 'PANTRY',
          foodItemId: groundedFood.id,
          dataSource: MealIngredientDataSource.FNRI,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
        continue;
      }

      try {
        const lookup = await lookupIngredient(ingredientName);
        if (lookup.source === 'ESTIMATED') hasEstimatedIngredient = true;
        ingredientsData.push({
          ingredientName: lookup.food.name || ingredientName,
          category: lookup.food.category || 'PANTRY',
          foodItemId: lookup.food.id || null,
          dataSource:
            lookup.source === 'ESTIMATED' ? MealIngredientDataSource.GEMINI_ESTIMATED : MealIngredientDataSource.FNRI,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
      } catch (lookupError) {
        console.warn(`Ingredient lookup failed for: ${ingredientName}, using as estimated.`, lookupError);
        hasEstimatedIngredient = true;
        ingredientsData.push({
          ingredientName,
          category: 'PANTRY',
          foodItemId: null,
          dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
      }
    }

    const composition = await prisma.foodItem.findMany({
      where: { id: { in: ingredientsData.flatMap((item) => (item.foodItemId ? [item.foodItemId] : [])) } },
    });
    composition.forEach((food) => compositionRevisions.set(food.id, food.compositionRevision));
    const reconciliation = reconcileFnriMealTotals(ingredientsData, composition);
    if (!reconciliation.complete) hasEstimatedIngredient = true;
    let confidence = reconciliation.complete ? AIConfidenceFlag.CAUTION : AIConfidenceFlag.NEEDS_REVIEW;
    if (input.userHasConditions) {
      confidence = hasEstimatedIngredient ? AIConfidenceFlag.NEEDS_REVIEW : AIConfidenceFlag.CAUTION;
    }

    preparedMeals.push({
      mealType: rawMeal.mealType,
      mealName: rawMeal.mealName,
      description: rawMeal.description,
      calories: Number(rawMeal.calories) || 0,
      proteinG: Number(rawMeal.proteinG) || 0,
      carbsG: Number(rawMeal.carbsG) || 0,
      fatG: Number(rawMeal.fatG) || 0,
      ...(reconciliation.complete ? reconciliation.totals : {}),
      scheduledDate,
      aiConfidenceFlag: confidence,
      rawCandidateId: rawMeal.rawCandidateId,
      candidateProvenance: rawMeal.candidateProvenance ?? MealCandidateProvenance.AI_FROM_SCRATCH,
      candidateRank: rawMeal.candidateRank,
      rankingScore: rawMeal.rankingScore,
      rankingReasonCodes: rawMeal.rankingReasonCodes,
      ingredientsData,
    });
  }

  return { preparedMeals, compositionRevisions };
}
