export type PrimaryMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export const PRIMARY_MEAL_CALORIE_SHARES: Readonly<Record<PrimaryMealType, number>> = Object.freeze({
  BREAKFAST: 0.3,
  LUNCH: 0.4,
  DINNER: 0.3,
});

export const MEAL_SLOT_CALORIE_TOLERANCE = 0.15;

export function isPrimaryMealType(mealType: string): mealType is PrimaryMealType {
  return mealType === 'BREAKFAST' || mealType === 'LUNCH' || mealType === 'DINNER';
}

export function getMealSlotCalorieTarget(dailyCalorieTarget: number, mealType: PrimaryMealType): number {
  return Math.round(dailyCalorieTarget * PRIMARY_MEAL_CALORIE_SHARES[mealType]);
}

export function getMealSlotCalorieRange(
  dailyCalorieTarget: number,
  mealType: PrimaryMealType,
  tolerance = MEAL_SLOT_CALORIE_TOLERANCE
): { minimum: number; target: number; maximum: number } {
  const target = getMealSlotCalorieTarget(dailyCalorieTarget, mealType);
  return {
    minimum: Math.floor(target * (1 - tolerance)),
    target,
    maximum: Math.ceil(target * (1 + tolerance)),
  };
}

export function isMealWithinSlotCalorieRange(input: {
  calories: number;
  dailyCalorieTarget: number;
  mealType: string;
  tolerance?: number;
}): boolean {
  if (
    !Number.isFinite(input.calories) ||
    input.calories <= 0 ||
    !Number.isFinite(input.dailyCalorieTarget) ||
    input.dailyCalorieTarget <= 0 ||
    !isPrimaryMealType(input.mealType)
  ) {
    return false;
  }

  const range = getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType, input.tolerance);
  return input.calories >= range.minimum && input.calories <= range.maximum;
}

export function getMealSlotCalorieDeviation(input: {
  calories: number;
  dailyCalorieTarget: number;
  mealType: PrimaryMealType;
}): number {
  return Math.abs(input.calories - getMealSlotCalorieTarget(input.dailyCalorieTarget, input.mealType));
}

export function rankCalorieCompatibleMeals<TMeal extends { id: string; calories: number; usageCount: number }>(
  candidates: readonly TMeal[],
  dailyCalorieTarget: number,
  mealType: string
): TMeal[] {
  if (!isPrimaryMealType(mealType)) return [];

  return candidates
    .filter((candidate) =>
      isMealWithinSlotCalorieRange({
        calories: candidate.calories,
        dailyCalorieTarget,
        mealType,
      })
    )
    .sort((left, right) => {
      const calorieDifference =
        getMealSlotCalorieDeviation({ calories: left.calories, dailyCalorieTarget, mealType }) -
        getMealSlotCalorieDeviation({ calories: right.calories, dailyCalorieTarget, mealType });
      return calorieDifference || left.usageCount - right.usageCount || left.id.localeCompare(right.id);
    });
}
