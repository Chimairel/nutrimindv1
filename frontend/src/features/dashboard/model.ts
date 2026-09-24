import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { getManilaDateKey, addCalendarDays, manilaDateFromKey } from '@/lib/manila-date';

export interface OutsideMealLog {
  loggedAt: string;
  status: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  provisionalCalories?: number;
  nutritionCompleteness?: 'COMPLETE' | 'PARTIAL' | 'UNRESOLVED';
}

export type OutsideMealInputItem = {
  name: string;
  portionGrams?: number;
  mealLibraryId?: string;
  reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

export type OutsideMealPreviewItem = {
  name: string;
  portionGrams: number | null;
  servingDescription?: string | null;
  source:
    | 'VERIFIED_LIBRARY'
    | 'FNRI'
    | 'USER_REPORTED'
    | 'USER_ADJUSTED_LIBRARY'
    | 'GEMINI_ESTIMATED'
    | 'NUTRITIONIST_REVIEWED'
    | 'UNRESOLVED';
  nutritionStatus: string;
  includedInTotals: boolean;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calorieLow: number | null;
  calorieHigh: number | null;
  warnings: string[];
};

export type PendingReview = {
  mealCount: number;
  planType: 'STARTER' | 'WEEKLY';
  reviewStatus: 'PENDING_REVIEW';
  meals: PendingMealPreview[];
};

export type OutsideMealWarning = {
  confirmationId: string;
  warnings: string[];
  reasons: string[];
  estimate: { calories: number; proteinG: number; carbsG: number; fatG: number };
  items: OutsideMealPreviewItem[];
  summary: {
    provisionalCalories: number;
    provisionalItemCount: number;
    unresolvedItemCount: number;
    completeness: 'COMPLETE' | 'PARTIAL' | 'UNRESOLVED';
  };
  usedAi: boolean;
};

export type CycleMetaSnapshot = {
  id?: string;
  planType?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  status?: string;
} | null;

/**
 * Returns a full 7-day weekly cycle date range for the dashboard date selector.
 * If the active plan is a STARTER bridge plan, partial plan, or in-flight weekly plan,
 * this anchors on the cycle end date and expands backwards to ensure all 7 days of the
 * weekly cycle are present, with elapsed days styled as grayed-out past dates.
 */
export function getDashboardCycleDates(
  scheduledMeals: MealPlan[],
  pendingMeals: PendingMealPreview[] = [],
  cycleMeta?: CycleMetaSnapshot,
  now: Date = new Date()
): Date[] {
  const allMeals = [...scheduledMeals, ...pendingMeals];
  if (allMeals.length === 0) return [];

  const todayKey = getManilaDateKey(now);
  const mealDateKeys = Array.from(
    new Set(
      allMeals
        .map((m) => getManilaDateKey(m.scheduledDate))
        .filter((k): k is string => Boolean(k))
    )
  ).sort();

  if (mealDateKeys.length === 0) return [];

  // Determine the anchor end date for the 7-day weekly cycle
  let endKey = mealDateKeys[mealDateKeys.length - 1];
  if (cycleMeta?.endDate) {
    const cycleEndKey = getManilaDateKey(cycleMeta.endDate);
    if (cycleEndKey) {
      endKey = cycleEndKey;
    }
  }

  // Ensure endKey covers at least today if all meals were in the past
  if (todayKey && todayKey > endKey) {
    endKey = todayKey;
  }

  // Generate the full 7-day weekly cycle window ending on endKey
  const cycleDateKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    cycleDateKeys.push(addCalendarDays(endKey, -i));
  }

  // Merge with any meal dates that fall outside the 7-day window to guarantee no meal is omitted
  const allDateKeys = Array.from(new Set([...cycleDateKeys, ...mealDateKeys])).sort();

  return allDateKeys.map((k) => manilaDateFromKey(k));
}

export function calculateDashboardMetrics(input: {
  activeDate: Date;
  currentMeals: MealPlan[];
  dailyCalorieTarget?: number | null;
  dailyMacroTargets?: Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number }> | null;
  outsideMealLogs: OutsideMealLog[];
  pendingMeals: PendingMealPreview[];
}) {
  const dateKey = getManilaDateKey(input.activeDate);
  const mealsList = input.currentMeals.filter((meal) => getManilaDateKey(meal.scheduledDate) === dateKey);
  const pendingMeals = input.pendingMeals.filter((meal) => getManilaDateKey(meal.scheduledDate) === dateKey);
  const outsideMeals = input.outsideMealLogs.filter(
    (meal) => meal.status === 'DONE' && getManilaDateKey(meal.loggedAt) === dateKey
  );
  const doneMeals = mealsList.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE'));
  const total = (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
    doneMeals.reduce((sum, meal) => sum + meal[field], 0) + outsideMeals.reduce((sum, meal) => sum + meal[field], 0);
  const scheduled = [...mealsList, ...pendingMeals];
  const provisionalCalories = outsideMeals.reduce((sum, meal) => sum + (meal.provisionalCalories ?? 0), 0);
  const unresolvedMealCount = outsideMeals.filter(
    (meal) => meal.nutritionCompleteness && meal.nutritionCompleteness !== 'COMPLETE'
  ).length;
  const target = (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG', fallback: number) =>
    input.dailyMacroTargets?.[dateKey]?.[field] ?? (scheduled.reduce((sum, meal) => sum + meal[field], 0) || fallback);

  return {
    mealsList,
    caloriesConsumed: total('calories'),
    caloriesTarget: input.dailyCalorieTarget || target('calories', 2000),
    proteinConsumed: total('proteinG'),
    proteinTarget: target('proteinG', 120),
    carbsConsumed: total('carbsG'),
    carbsTarget: target('carbsG', 220),
    fatConsumed: total('fatG'),
    fatTarget: target('fatG', 60),
    provisionalCalories,
    unresolvedMealCount,
  };
}
