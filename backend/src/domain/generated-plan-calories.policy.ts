import {
  getMealSlotCalorieRange,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
  MEAL_SLOT_CALORIE_TOLERANCE,
} from './meal-calorie-allocation.policy';

export function assertMealSlotCalories(calories: number, dailyCalorieTarget: number, mealType: string) {
  if (isMealWithinSlotCalorieRange({ calories, dailyCalorieTarget, mealType })) return;
  const range = isPrimaryMealType(mealType) ? getMealSlotCalorieRange(dailyCalorieTarget, mealType) : null;
  throw new Error(
    range
      ? `${mealType} has ${Math.round(calories)} kcal; this profile requires ${range.minimum}–${range.maximum} kcal (target ${range.target}). Adjust the serving and ingredient quantities before approval.`
      : 'A valid primary meal and calorie target are required.'
  );
}

export function validateGeneratedDayCalories(
  meals: readonly { dayNumber: number; mealType: string; calories: number }[],
  target: number
): string[] {
  const issues: string[] = [];
  for (const day of new Set(meals.map((meal) => meal.dayNumber))) {
    const entries = meals.filter((meal) => meal.dayNumber === day);
    if (!['BREAKFAST', 'LUNCH', 'DINNER'].every((type) => entries.some((meal) => meal.mealType === type))) continue;
    const total = entries.reduce((sum, meal) => sum + meal.calories, 0);
    if (
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(total) ||
      total < Math.floor(target * (1 - MEAL_SLOT_CALORIE_TOLERANCE)) ||
      total > Math.ceil(target * (1 + MEAL_SLOT_CALORIE_TOLERANCE))
    ) {
      issues.push(
        `Day ${day} totals ${Math.round(total)} kcal, outside the daily ±15% allowance around ${target} kcal. Adjust ingredient portions.`
      );
    }
  }
  return issues;
}
