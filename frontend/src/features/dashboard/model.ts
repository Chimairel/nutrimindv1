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
}

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
  };
}
