import { Apple, Moon, Sun, Utensils } from 'lucide-react';

export type QueueRow = {
  id: string;
  priority: number;
  status: string;
  queueReason: string | null;
  claimedRevision: number | null;
  messages: Array<{
    id: string;
    sender: 'USER' | 'NUTRITIONIST';
    itemRevision: number;
    content: string;
    createdAt: string;
  }>;
  claimStatus: { claimedByMe: boolean; claimedByOther: boolean; claimedByName: string | null };
  outsideMealLogItem: {
    id: string;
    name: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    calorieLow: number | null;
    calorieHigh: number | null;
    compatibilityStatus: string;
    nutritionStatus: string;
    includedInTotals: boolean;
    currentRevision: number;
    portionGrams?: number | null;
    source?: string;
    ingredients: string[] | null;
    mealLog: {
      mealName: string;
      mealType: string | null;
      loggedAt: string;
      estimationContext?: string | null;
      outsideImageMime?: string | null;
    };
  };
};
export type ObservedSubmission = {
  id: string;
  sourceRevision: number;
  createdAt: string;
  sourceOutsideMealItem: {
    name: string;
    portionGrams: number | null;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    currentRevision: number;
    nutritionStatus: string;
    ingredients: unknown;
    mealLog: { mealType: string | null; estimationContext: string | null; status: string };
  } | null;
};
export const emptyCorrection = { calories: '', proteinG: '', carbsG: '', fatG: '', reason: '' };
export type OutsideQueues = { rows: QueueRow[]; submissions: ObservedSubmission[] };
export function getMealTypeTheme(mealType?: string | null) {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) {
    return {
      label: 'Breakfast',
      icon: Sun,
      badgeStyle: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  if (norm.includes('LUNCH')) {
    return {
      label: 'Lunch',
      icon: Utensils,
      badgeStyle: 'border-brand-green/25 bg-brand-green/10 text-brand-green dark:text-emerald-400',
    };
  }
  if (norm.includes('DINNER')) {
    return {
      label: 'Dinner',
      icon: Moon,
      badgeStyle: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    };
  }
  if (norm.includes('SNACK')) {
    return {
      label: 'Snack',
      icon: Apple,
      badgeStyle: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
  }
  return {
    label: mealType || 'Meal',
    icon: Utensils,
    badgeStyle: 'border-brand-border/70 bg-brand-bgAlt text-brand-muted',
  };
}
