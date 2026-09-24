import { describe, expect, it } from 'vitest';
import { addCalendarDays, getManilaDateKey } from '@/lib/manila-date';
import { getDashboardCycleDates } from './model';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';

function mockMeal(scheduledDate: string): MealPlan {
  return {
    id: `meal-${scheduledDate}`,
    userId: 'u1',
    planGroupId: 'g1',
    mealType: 'LUNCH',
    scheduledDate: new Date(`${scheduledDate}T04:00:00.000Z`),
    mealName: 'Test Meal',
    description: null,
    calories: 500,
    proteinG: 30,
    carbsG: 60,
    fatG: 15,
    status: 'APPROVED',
    prepTimeMinutes: null,
    servings: 1,
    aiConfidenceFlag: 'NONE',
    requiresSafetyRevalidation: false,
    ingredients: [],
  } as unknown as MealPlan;
}

function mockPending(scheduledDate: string): PendingMealPreview {
  return {
    mealName: 'Pending Soup',
    mealType: 'DINNER',
    description: null,
    calories: 400,
    proteinG: 25,
    carbsG: 45,
    fatG: 12,
    scheduledDate,
    ingredients: [],
  };
}

describe('addCalendarDays', () => {
  it('adds calendar days within the same month', () => {
    expect(addCalendarDays('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('subtracts calendar days across month boundaries', () => {
    expect(addCalendarDays('2026-10-02', -3)).toBe('2026-09-29');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds calendar days across month boundaries', () => {
    expect(addCalendarDays('2026-09-28', 4)).toBe('2026-10-02');
  });

  it('handles year boundaries correctly', () => {
    expect(addCalendarDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addCalendarDays('2026-01-02', -3)).toBe('2025-12-30');
  });
});

describe('getDashboardCycleDates', () => {
  const fixedNow = new Date('2026-09-24T10:00:00+08:00'); // Thursday, Sep 24, 2026 in Manila

  it('returns empty array when no meals are scheduled', () => {
    expect(getDashboardCycleDates([], [], null, fixedNow)).toEqual([]);
  });

  it('returns full 7-day range for a 4-day STARTER bridge plan anchored to Sunday cycle end', () => {
    // User has a starter plan spanning Sep 24 through Sep 27 (4 days)
    const starterMeals = [
      mockMeal('2026-09-24'),
      mockMeal('2026-09-25'),
      mockMeal('2026-09-26'),
      mockMeal('2026-09-27'),
    ];
    const cycleMeta = {
      planType: 'STARTER',
      startDate: '2026-09-23T16:00:00.000Z', // Sep 24 in Manila
      endDate: '2026-09-26T16:00:00.000Z',   // Sep 27 in Manila
    };

    const dates = getDashboardCycleDates(starterMeals, [], cycleMeta, fixedNow);
    const dateKeys = dates.map((d) => getManilaDateKey(d));

    // Must be exactly 7 consecutive days ending on Sunday Sep 27
    expect(dateKeys).toHaveLength(7);
    expect(dateKeys).toEqual([
      '2026-09-21', // Mon (past, grayed out)
      '2026-09-22', // Tue (past, grayed out)
      '2026-09-23', // Wed (past, grayed out)
      '2026-09-24', // Thu (today, active)
      '2026-09-25', // Fri (starter day 2)
      '2026-09-26', // Sat (starter day 3)
      '2026-09-27', // Sun (starter day 4)
    ]);
  });

  it('returns full 7-day range for an active WEEKLY plan with past days', () => {
    // Weekly plan from Sep 21 to Sep 27
    const weeklyMeals = [
      mockMeal('2026-09-21'),
      mockMeal('2026-09-22'),
      mockMeal('2026-09-23'),
      mockMeal('2026-09-24'),
      mockMeal('2026-09-25'),
      mockMeal('2026-09-26'),
      mockMeal('2026-09-27'),
    ];
    const cycleMeta = {
      planType: 'WEEKLY',
      startDate: '2026-09-20T16:00:00.000Z',
      endDate: '2026-09-26T16:00:00.000Z',
    };

    const dates = getDashboardCycleDates(weeklyMeals, [], cycleMeta, fixedNow);
    const dateKeys = dates.map((d) => getManilaDateKey(d));

    expect(dateKeys).toHaveLength(7);
    expect(dateKeys).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('works without cycleMeta by deriving 7 days ending at latest meal date', () => {
    const starterMeals = [
      mockMeal('2026-09-25'),
      mockMeal('2026-09-26'),
      mockMeal('2026-09-27'),
    ];

    const dates = getDashboardCycleDates(starterMeals, [], null, fixedNow);
    const dateKeys = dates.map((d) => getManilaDateKey(d));

    expect(dateKeys).toHaveLength(7);
    expect(dateKeys).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('includes pending review meals when constructing cycle dates', () => {
    const pendingMeals = [
      mockPending('2026-09-24'),
      mockPending('2026-09-25'),
      mockPending('2026-09-26'),
      mockPending('2026-09-27'),
    ];

    const dates = getDashboardCycleDates([], pendingMeals, null, fixedNow);
    const dateKeys = dates.map((d) => getManilaDateKey(d));

    expect(dateKeys).toHaveLength(7);
    expect(dateKeys).toContain('2026-09-24');
    expect(dateKeys).toContain('2026-09-21');
  });
});
