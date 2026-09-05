import type { CommonMealDefinition } from '@/data/common-meal-catalogue';

export interface CatalogueFnriFoodEvidence {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodium: number | null;
}

function roundNutrient(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateCatalogueNutrition(
  meal: CommonMealDefinition,
  foods: ReadonlyMap<string, CatalogueFnriFoodEvidence>,
) {
  let hasCompleteSodium = true;
  const totals = meal.ingredients.reduce(
    (result, item) => {
      const food = foods.get(item.foodName);
      if (!food) throw new Error(`FNRI item not resolved: ${item.foodName}`);
      const portion = item.grams / 100;
      result.calories += food.calories * portion;
      result.proteinG += food.proteinG * portion;
      result.carbsG += food.carbsG * portion;
      result.fatG += food.fatG * portion;
      if (food.sodium === null) hasCompleteSodium = false;
      else result.sodiumMg += food.sodium * portion;
      return result;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 },
  );

  return {
    calories: roundNutrient(totals.calories),
    proteinG: roundNutrient(totals.proteinG),
    carbsG: roundNutrient(totals.carbsG),
    fatG: roundNutrient(totals.fatG),
    sodiumMg: hasCompleteSodium ? roundNutrient(totals.sodiumMg) : null,
  };
}
