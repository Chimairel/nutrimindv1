import {
  getMealSlotCalorieTarget,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from './meal-calorie-allocation.policy';

/** Safety eligibility must already have been applied by the caller. */
export function rankLibraryMeals<T extends { id: string; mealType: string; calories: number }>(
  meals: T[],
  dailyTarget: number,
  slotCalories?: number | Record<string, number>
): T[] {
  const groups = ['BREAKFAST', 'LUNCH', 'DINNER'].map((type) =>
    meals
      .filter(
        (meal) => meal.mealType === type && isMealWithinSlotCalorieRange({ ...meal, dailyCalorieTarget: dailyTarget })
      )
      .sort((a, b) => {
        const target =
          (typeof slotCalories === 'number' ? slotCalories : slotCalories?.[type]) ??
          (isPrimaryMealType(type) ? getMealSlotCalorieTarget(dailyTarget, type) : 0);
        return Math.abs(a.calories - target) - Math.abs(b.calories - target) || a.id.localeCompare(b.id);
      })
  );
  return [...groups.flatMap((group) => group.slice(0, 1)), ...groups.flatMap((group) => group.slice(1))];
}
