import {
  getMealSlotCalorieTarget,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from './meal-calorie-allocation.policy';

/** Safety eligibility must already have been applied by the caller. */
export function rankLibraryMeals<
  T extends {
    id: string;
    mealType: string;
    mealTypes?: readonly string[];
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    isFavorite?: boolean;
    alreadyPlannedInCycle?: boolean;
    localityRank?: number;
    ricePreferenceScore?: number;
  },
>(
  meals: T[],
  dailyTarget: number,
  slotCalories?: number | Record<string, number>,
  requestedMealType?: string,
  slotMacros?: { proteinG: number; carbsG: number; fatG: number }
): T[] {
  const types = requestedMealType ? [requestedMealType] : ['BREAKFAST', 'LUNCH', 'DINNER'];
  const groups = types.map((type) =>
    meals
      .filter(
        (meal) =>
          (meal.mealTypes?.includes(type) ?? meal.mealType === type) &&
          isMealWithinSlotCalorieRange({ ...meal, mealType: type, dailyCalorieTarget: dailyTarget })
      )
      .sort((a, b) => {
        const target =
          (typeof slotCalories === 'number' ? slotCalories : slotCalories?.[type]) ??
          (isPrimaryMealType(type) ? getMealSlotCalorieTarget(dailyTarget, type) : 0);
        const favorite = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favorite) return favorite;
        const calorieFit = Math.abs(a.calories - target) - Math.abs(b.calories - target);
        if (calorieFit) return calorieFit;
        const macroDistance = (meal: T) => slotMacros
          ? Math.abs((meal.proteinG ?? 0) - slotMacros.proteinG) * 4 +
            Math.abs((meal.carbsG ?? 0) - slotMacros.carbsG) * 4 +
            Math.abs((meal.fatG ?? 0) - slotMacros.fatG) * 9
          : Math.abs((meal.proteinG ?? 0) * 4 + (meal.carbsG ?? 0) * 4 + (meal.fatG ?? 0) * 9 - meal.calories);
        const macroFit = macroDistance(a) - macroDistance(b);
        if (macroFit) return macroFit;
        const variety = Number(Boolean(a.alreadyPlannedInCycle)) - Number(Boolean(b.alreadyPlannedInCycle));
        if (variety) return variety;
        const locality = (a.localityRank ?? Number.MAX_SAFE_INTEGER) - (b.localityRank ?? Number.MAX_SAFE_INTEGER);
        if (locality) return locality;
        const rice = (b.ricePreferenceScore ?? 0) - (a.ricePreferenceScore ?? 0);
        return rice || a.id.localeCompare(b.id);
      })
  );
  const ordered = [...groups.flatMap((group) => group.slice(0, 1)), ...groups.flatMap((group) => group.slice(1))];
  return ordered.filter((meal, index) => ordered.findIndex((candidate) => candidate.id === meal.id) === index);
}
