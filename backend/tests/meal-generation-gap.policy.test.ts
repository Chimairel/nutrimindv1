import assert from 'node:assert/strict';
import test from 'node:test';
import { MealType } from '@prisma/client';
import { earliestMissingDay, missingMealSlots } from '@/domain/meal-generation-gap.policy';
import { getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';

const monday = new Date('2026-09-28T00:00:00.000Z');

test('[TEST-225] AI queue starts at day 1 and never jumps to a later ready-looking day', () => {
  const occupied = [
    { scheduledDate: getScheduledMealDate(monday, 0), mealType: MealType.BREAKFAST },
    { scheduledDate: getScheduledMealDate(monday, 1), mealType: MealType.BREAKFAST },
    { scheduledDate: getScheduledMealDate(monday, 1), mealType: MealType.LUNCH },
  ];
  const missing = missingMealSlots(monday, 21, occupied);
  assert.equal(missing.length, 18);
  assert.deepEqual(earliestMissingDay(missing).map((slot) => slot.mealType), [MealType.LUNCH, MealType.DINNER]);
  assert.ok(missing.slice(2).every((slot) => slot.dayNumber >= 2));
});

test('[TEST-225] a complete certified/raw cycle has no AI work', () => {
  const occupied = Array.from({ length: 7 }, (_, day) =>
    [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER].map((mealType) => ({
      scheduledDate: getScheduledMealDate(monday, day), mealType,
    }))
  ).flat();
  assert.deepEqual(missingMealSlots(monday, 21, occupied), []);
  assert.deepEqual(earliestMissingDay([]), []);
});
