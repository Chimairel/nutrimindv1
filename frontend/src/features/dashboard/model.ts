import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { getManilaDateKey } from '@/lib/manila-date';

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
  reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

export type OutsideMealPreviewItem = {
  name: string;
  portionGrams: number | null;
  source: 'VERIFIED_LIBRARY' | 'FNRI' | 'USER_REPORTED' | 'GEMINI_ESTIMATED' | 'NUTRITIONIST_REVIEWED' | 'UNRESOLVED';
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

export function calculateDashboardMetrics(input: {
  activeDate: Date;
  currentMeals: MealPlan[];
  dailyCalorieTarget?: number | null;
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
    scheduled.reduce((sum, meal) => sum + meal[field], 0) || fallback;

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
