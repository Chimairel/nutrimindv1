import assert from 'node:assert/strict';
import test from 'node:test';
import { PlanType, ShoppingDayGroup } from '@prisma/client';
import {
  getCurrentWeeklyCycleWindow,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  getWeeklyPlanPreparationDate,
  isWeeklyPlanPreparationDue,
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
  const scheduledDates = Array.from({ length: 7 }, (_, day) =>
    getScheduledMealDate(sunday, day).toISOString()
  );

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

test('[TEST-017] Saturday-night cron targets the upcoming Sunday cycle', () => {
  const saturdayNightInManila = new Date('2026-08-22T15:00:00.000Z');
  const cycle = getNextWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, saturdayNightInManila);

  assert.equal(cycle.startDate.toISOString(), '2026-08-22T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-08-28T16:00:00.000Z');
});

test('[TEST-017] Sunday-night cron targets the upcoming Monday cycle', () => {
  const sundayNightInManila = new Date('2026-08-23T14:00:00.000Z');
  const cycle = getNextWeeklyCycleWindow(ShoppingDayGroup.WEEKDAY, sundayNightInManila);

  assert.equal(cycle.startDate.toISOString(), '2026-08-23T16:00:00.000Z');
  assert.equal(cycle.endDate.toISOString(), '2026-08-29T16:00:00.000Z');
});

test('[TEST-017] the same instant produces the same cycle regardless of server timezone', () => {
  const instant = new Date('2026-08-22T16:17:00.000Z');
  const first = getCurrentWeeklyCycleWindow(ShoppingDayGroup.WEEKEND, instant);
  const second = getCurrentWeeklyCycleWindow(
    ShoppingDayGroup.WEEKEND,
    new Date(instant.getTime())
  );

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

test('[TEST-051] preparation opens three days before the exact grocery day', () => {
  const sundayInManila = new Date('2026-08-30T10:00:00+08:00');
  const schedule = { shoppingDayOfWeek: 3 };

  assert.equal(
    getWeeklyPlanPreparationDate(schedule, sundayInManila).toISOString(),
    '2026-08-29T16:00:00.000Z'
  );
  assert.equal(isWeeklyPlanPreparationDue(schedule, sundayInManila), true);
  assert.equal(
    isWeeklyPlanPreparationDue(schedule, new Date('2026-08-29T10:00:00+08:00')),
    false
  );
});
