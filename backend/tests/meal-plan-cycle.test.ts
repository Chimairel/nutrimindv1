import assert from 'node:assert/strict';
import test from 'node:test';
import { MealPlanCycleDeadlineOutcome, MealPlanCycleStatus, PlanType, ShoppingDayGroup } from '@prisma/client';
import {
  deriveMealPlanCycleLifecycle,
  getCurrentWeeklyCycleWindow,
  getMealPlanCycleTiming,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
} from '../src/domain/meal-plan-cycle.policy';

test('[TEST-017] Thursday generation creates the exact weekend starter bridge', () => {
  const thursdayInManila = new Date('2026-08-19T16:30:00.000Z');
  const window = getOnDemandMealPlanWindow(ShoppingDayGroup.WEEKEND, thursdayInManila);

  assert.equal(window.planType, PlanType.STARTER);
  assert.equal(window.numDays, 3);
  assert.equal(window.startDate.toISOString(), '2026-08-19T16:00:00.000Z');
});

test('[TEST-017] Sunday generation creates a full Sunday-to-Saturday week', () => {
  const sundayInManila = new Date('2026-08-22T16:17:00.000Z');
  const generation = getOnDemandMealPlanWindow(ShoppingDayGroup.WEEKEND, sundayInManila);
  const cycle = getCurrentWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, sundayInManila);

  assert.equal(generation.planType, PlanType.WEEKLY);
  assert.equal(generation.numDays, 7);
  assert.equal(generation.startDate.toISOString(), '2026-08-22T16:00:00.000Z');
  assert.equal(cycle.startDate.toISOString(), '2026-08-22T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-08-28T16:00:00.000Z');
});

test('[TEST-017] all seven scheduled dates retain Manila midnight', () => {
  const sunday = new Date('2026-08-22T16:00:00.000Z');
  const scheduledDates = Array.from({ length: 7 }, (_, day) => getScheduledMealDate(sunday, day).toISOString());

  assert.deepEqual(scheduledDates, [
    '2026-08-22T16:00:00.000Z',
    '2026-08-23T16:00:00.000Z',
    '2026-08-24T16:00:00.000Z',
    '2026-08-25T16:00:00.000Z',
    '2026-08-26T16:00:00.000Z',
    '2026-08-27T16:00:00.000Z',
    '2026-08-28T16:00:00.000Z',
  ]);
});

test('[TEST-017] Saturday night resolves the upcoming Sunday cycle', () => {
  const saturdayNightInManila = new Date('2026-08-22T15:00:00.000Z');
  const cycle = getNextWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, saturdayNightInManila);

  assert.equal(cycle.startDate.toISOString(), '2026-08-22T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-08-28T16:00:00.000Z');
});

test('[TEST-017] Sunday night resolves the upcoming Monday cycle', () => {
  const sundayNightInManila = new Date('2026-08-23T14:00:00.000Z');
  const cycle = getNextWeeklyCycleWindow(ShoppingDayGroup.WEEKDAY, sundayNightInManila);

  assert.equal(cycle.startDate.toISOString(), '2026-08-23T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-08-29T16:00:00.000Z');
});

test('[TEST-017] the same instant produces the same cycle regardless of server timezone', () => {
  const instant = new Date('2026-08-22T16:17:00.000Z');
  const first = getCurrentWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, instant);
  const second = getCurrentWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, new Date(instant.getTime()));

  assert.deepEqual(second, first);
});

test('[TEST-051] exact Wednesday shopping anchors a Thursday-to-Wednesday cycle', () => {
  const thursdayInManila = new Date('2026-09-03T10:00:00+08:00');
  const cycle = getCurrentWeeklyCycleWindow({ shoppingDayOfWeek: 3 }, thursdayInManila);

  assert.equal(cycle.startDate.toISOString(), '2026-09-02T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-09-08T16:00:00.000Z');
});

test('[TEST-051] a mid-cycle signup receives only the bridge through shopping day', () => {
  const fridayInManila = new Date('2026-08-28T10:00:00+08:00');
  const window = getOnDemandMealPlanWindow({ shoppingDayOfWeek: 3 }, fridayInManila);

  assert.equal(window.planType, PlanType.STARTER);
  assert.equal(window.numDays, 6);
  assert.equal(window.startDate.toISOString(), '2026-08-27T16:00:00.000Z');
});

test('[BATCH-1] weekly cycle timing opens three days before the exact Manila shopping cutoff', () => {
  const sundayStart = new Date('2026-09-26T16:00:00.000Z');
  const timing = getMealPlanCycleTiming(PlanType.WEEKLY, sundayStart, 7);

  assert.equal(timing.startDate.toISOString(), '2026-09-26T16:00:00.000Z');
  assert.equal(timing.endDate.toISOString(), '2026-10-02T16:00:00.000Z');
  assert.equal(timing.shoppingDeadlineAt.toISOString(), '2026-09-25T16:00:00.000Z');
  assert.equal(timing.preparationOpensAt.toISOString(), '2026-09-22T16:00:00.000Z');
  assert.equal(timing.expectedSlotCount, 21);
});

test('[BATCH-1] starter timing remains bounded to its actual bridge', () => {
  const thursdayStart = new Date('2026-09-23T16:00:00.000Z');
  const timing = getMealPlanCycleTiming(PlanType.STARTER, thursdayStart, 3);

  assert.equal(timing.endDate.toISOString(), '2026-09-25T16:00:00.000Z');
  assert.equal(timing.shoppingDeadlineAt.toISOString(), timing.startDate.toISOString());
  assert.equal(timing.preparationOpensAt.toISOString(), timing.startDate.toISOString());
  assert.equal(timing.expectedSlotCount, 9);
});

test('[BATCH-1] invalid cycle lengths and preparation policy fail closed', () => {
  const start = new Date('2026-09-26T16:00:00.000Z');
  assert.throws(() => getMealPlanCycleTiming(PlanType.WEEKLY, start, 0));
  assert.throws(() => getMealPlanCycleTiming(PlanType.WEEKLY, start, 8));
  assert.throws(() => getMealPlanCycleTiming(PlanType.WEEKLY, start, 7, -1));
});

test('[BATCH-1] all seven shopping weekdays produce a next-day seven-day cycle and exact cutoff', () => {
  const reference = new Date('2026-09-21T10:00:00+08:00');
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (let shoppingDay = 0; shoppingDay < 7; shoppingDay += 1) {
    const cycle = getNextWeeklyCycleWindow({ shoppingDayOfWeek: shoppingDay }, reference);
    const timing = getMealPlanCycleTiming(PlanType.WEEKLY, cycle.startDate, 7);
    const startLabel = cycle.startDate.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
    });
    const startWeekday = weekdays[startLabel];
    assert.equal(startWeekday, (shoppingDay + 1) % 7);
    assert.equal(timing.endDate.getTime() - timing.startDate.getTime(), 6 * 86_400_000);
    assert.equal(timing.shoppingDeadlineAt.getTime(), timing.startDate.getTime() - 86_400_000);
  }
});

test('[BATCH-1] deadline outcome is retained when a late-completed cycle becomes ready', () => {
  const startDate = new Date('2026-09-26T16:00:00.000Z');
  const shoppingDeadlineAt = new Date('2026-09-25T16:00:00.000Z');
  const before = deriveMealPlanCycleLifecycle({
    status: MealPlanCycleStatus.UNDER_REVIEW,
    startDate,
    endDate: getScheduledMealDate(startDate, 6),
    shoppingDeadlineAt,
    deadlineOutcome: null,
    readyAt: null,
    shoppingStartedAt: null,
    hasAnySlots: true,
    hasCompleteSlotSet: false,
    now: new Date(shoppingDeadlineAt.getTime() - 1),
  });
  assert.equal(before.status, MealPlanCycleStatus.UNDER_REVIEW);
  assert.equal(before.deadlineOutcome, null);

  const missed = deriveMealPlanCycleLifecycle({
    status: before.status,
    startDate,
    endDate: getScheduledMealDate(startDate, 6),
    shoppingDeadlineAt,
    deadlineOutcome: before.deadlineOutcome,
    readyAt: null,
    shoppingStartedAt: null,
    hasAnySlots: true,
    hasCompleteSlotSet: false,
    now: shoppingDeadlineAt,
  });
  assert.equal(missed.status, MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE);
  assert.equal(missed.deadlineOutcome, MealPlanCycleDeadlineOutcome.INCOMPLETE);

  const completedLate = deriveMealPlanCycleLifecycle({
    status: missed.status,
    startDate,
    endDate: getScheduledMealDate(startDate, 6),
    shoppingDeadlineAt,
    deadlineOutcome: missed.deadlineOutcome,
    readyAt: new Date(shoppingDeadlineAt.getTime() + 60_000),
    shoppingStartedAt: null,
    hasAnySlots: true,
    hasCompleteSlotSet: true,
    now: new Date(shoppingDeadlineAt.getTime() + 60_000),
  });
  assert.equal(completedLate.status, MealPlanCycleStatus.READY_TO_SHOP);
  assert.equal(completedLate.deadlineOutcome, MealPlanCycleDeadlineOutcome.INCOMPLETE);
});

test('[BATCH-1] incomplete cycles activate on time without grocery acknowledgment', () => {
  const startDate = new Date('2026-09-26T16:00:00.000Z');
  const result = deriveMealPlanCycleLifecycle({
    status: MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE,
    startDate,
    endDate: getScheduledMealDate(startDate, 6),
    shoppingDeadlineAt: getScheduledMealDate(startDate, -1),
    deadlineOutcome: MealPlanCycleDeadlineOutcome.INCOMPLETE,
    readyAt: null,
    shoppingStartedAt: null,
    hasAnySlots: true,
    hasCompleteSlotSet: false,
    now: new Date(startDate.getTime() + 60_000),
  });
  assert.equal(result.status, MealPlanCycleStatus.ACTIVE);
  assert.equal(result.deadlineOutcome, MealPlanCycleDeadlineOutcome.INCOMPLETE);
});

test('[BATCH-1] a plan observed ready before cutoff retains a complete deadline outcome', () => {
  const startDate = new Date('2026-09-26T16:00:00.000Z');
  const shoppingDeadlineAt = getScheduledMealDate(startDate, -1);
  const result = deriveMealPlanCycleLifecycle({
    status: MealPlanCycleStatus.READY_TO_SHOP,
    startDate,
    endDate: getScheduledMealDate(startDate, 6),
    shoppingDeadlineAt,
    deadlineOutcome: null,
    readyAt: new Date(shoppingDeadlineAt.getTime() - 60_000),
    shoppingStartedAt: null,
    hasAnySlots: true,
    hasCompleteSlotSet: true,
    now: new Date(shoppingDeadlineAt.getTime() + 60_000),
  });
  assert.equal(result.status, MealPlanCycleStatus.READY_TO_SHOP);
  assert.equal(result.deadlineOutcome, MealPlanCycleDeadlineOutcome.COMPLETE);
});
