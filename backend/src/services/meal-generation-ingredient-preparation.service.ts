import { AIConfidenceFlag, MealCandidateProvenance, MealIngredientDataSource, MealType } from '@prisma/client';
import { reconcileFnriMealTotals } from '@/domain/fnri-meal-totals.policy';
import { lookupIngredientCompositions } from '@/lib/ingredient-composition';
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
  const namesToResolve = input.meals.flatMap((meal) =>
    meal.ingredients
      .filter(
        (ingredient) =>
          !(
            meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS &&
            (ingredient.quantity === undefined || ingredient.quantity <= 0)
          ) && !ingredient.foodItemId
      )
      .map((ingredient) => ingredient.name)
  );
  const compositionByName = await lookupIngredientCompositions(namesToResolve);
  const resolvedIds = [
    ...new Set([
      ...[...compositionByName.values()].flatMap((food) => (food ? [food.id] : [])),
      ...input.meals.flatMap((meal) =>
        meal.ingredients.flatMap((ingredient) => (ingredient.foodItemId ? [ingredient.foodItemId] : []))
      ),
    ]),
  ];
  const composition = await prisma.foodItem.findMany({ where: { id: { in: resolvedIds } } });
  const compositionById = new Map(composition.map((food) => [food.id, food]));
  composition.forEach((food) => compositionRevisions.set(food.id, food.compositionRevision));

  for (const rawMeal of input.meals) {
    const slot = input.unmatchedSlots.find(
      (candidate) => candidate.dayNumber === rawMeal.dayNumber && candidate.mealType === rawMeal.mealType
    );
    const scheduledDate = slot ? slot.scheduledDate : new Date(input.startDate);
    let hasEstimatedIngredient = false;
    const ingredientsData: PreparedGeneratedMeal['ingredientsData'] = [];

    for (const ingredient of rawMeal.ingredients) {
      const ingredientName = ingredient.name;
      const linkedFood = ingredient.foodItemId ? compositionById.get(ingredient.foodItemId) : undefined;
      if (
        rawMeal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS &&
        (ingredient.quantity === undefined || ingredient.quantity <= 0)
      ) {
        hasEstimatedIngredient = true;
        ingredientsData.push({
          ingredientName,
          category: linkedFood?.category || 'PANTRY',
          foodItemId: linkedFood?.id ?? null,
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

      if (linkedFood && rawMeal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS) {
        ingredientsData.push({
          ingredientName,
          category: linkedFood.category || 'PANTRY',
          foodItemId: linkedFood.id,
          dataSource: MealIngredientDataSource.SOURCE_RECIPE,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
        continue;
      }

      const food = compositionByName.get(ingredientName.trim());
      if (food) {
        ingredientsData.push({
          ingredientName: food.name,
          category: food.category || 'PANTRY',
          foodItemId: food.id,
          dataSource: food.source === 'FNRI' ? MealIngredientDataSource.FNRI : MealIngredientDataSource.USDA_FDC,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
      } else {
        hasEstimatedIngredient = true;
        ingredientsData.push({
          ingredientName,
          category: 'PANTRY',
          foodItemId: null,
          dataSource:
            rawMeal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
              ? MealIngredientDataSource.SOURCE_RECIPE
              : MealIngredientDataSource.GEMINI_ESTIMATED,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        });
      }
    }

    const mealComposition = ingredientsData.flatMap((item) => {
      const food = item.foodItemId ? compositionById.get(item.foodItemId) : undefined;
      return food ? [food] : [];
    });
    const reconciliation = reconcileFnriMealTotals(
      ingredientsData.filter(
        (item) =>
          item.dataSource === MealIngredientDataSource.FNRI || item.dataSource === MealIngredientDataSource.USDA_FDC
      ),
      mealComposition,
      ['FNRI', 'USDA_FDC']
    );
    const completeReconciliation = reconciliation.complete && ingredientsData.length === reconciliation.total;
    if (!completeReconciliation) hasEstimatedIngredient = true;
    let confidence = completeReconciliation ? AIConfidenceFlag.CAUTION : AIConfidenceFlag.NEEDS_REVIEW;
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
      ...(completeReconciliation ? reconciliation.totals : {}),
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
