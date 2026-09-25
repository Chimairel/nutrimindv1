import type { MealPlan } from '@/types';

export interface ApprovedPlanRecipe {
  meal: MealPlan;
  occurrences: MealPlan[];
}

/** Collapse repeated plan slots only when they share persisted recipe identity and displayed nutrition. */
export function groupApprovedPlanRecipes(meals: readonly MealPlan[]): ApprovedPlanRecipe[] {
  const groups = new Map<string, ApprovedPlanRecipe>();
  for (const meal of meals) {
    const identity = meal.composedServingSignature || meal.baseRecipeSignature ||
      (meal.libraryMealId ? `library:${meal.libraryMealId}` : null);
    const key = identity
      ? JSON.stringify([identity, meal.mealType, meal.calories, meal.proteinG, meal.carbsG, meal.fatG])
      : `slot:${meal.id}`;
    const existing = groups.get(key);
    if (existing) existing.occurrences.push(meal);
    else groups.set(key, { meal, occurrences: [meal] });
  }
  return [...groups.values()];
}
