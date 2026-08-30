import { PlanType, ShoppingDayGroup } from '@prisma/client';

export const MEAL_PLAN_BUSINESS_TIME_ZONE = 'Asia/Manila';

const MANILA_OFFSET = '+08:00';

export interface MealPlanGenerationWindow {
  planType: PlanType;
  numDays: number;
  startDate: Date;
}

export interface WeeklyCycleWindow {
  startDate: Date;
  endDate: Date;
}

export interface ShoppingSchedule {
  shoppingDayOfWeek?: number | null;
  shoppingDayGroup?: ShoppingDayGroup | null;
}

export const WEEKLY_PLAN_REVIEW_LEAD_DAYS = 3;

function getManilaDateParts(value: Date): { dateKey: string; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEAL_PLAN_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  if (!year || !month || !day || weekday === undefined || weekdays[weekday] === undefined) {
    throw new Error('Cannot determine the Asia/Manila meal-plan business date.');
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    dayOfWeek: weekdays[weekday],
  };
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getManilaDateKey(value: Date = new Date()): string {
  return getManilaDateParts(value).dateKey;
}

export function getManilaMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${MANILA_OFFSET}`);
}

export function getScheduledMealDate(startDate: Date, dayOffset: number): Date {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return new Date(startDate.getTime() + dayOffset * millisecondsPerDay);
}

function normalizeShoppingDay(
  schedule: ShoppingSchedule | ShoppingDayGroup | number | null | undefined
): number | null {
  if (typeof schedule === 'number') {
    return Number.isInteger(schedule) && schedule >= 0 && schedule <= 6 ? schedule : null;
  }
  if (typeof schedule === 'string') {
    return schedule === ShoppingDayGroup.WEEKDAY ? 0 : 6;
  }
  if (!schedule) return null;
  if (
    typeof schedule.shoppingDayOfWeek === 'number' &&
    Number.isInteger(schedule.shoppingDayOfWeek) &&
    schedule.shoppingDayOfWeek >= 0 &&
    schedule.shoppingDayOfWeek <= 6
  ) {
    return schedule.shoppingDayOfWeek;
  }
  if (schedule.shoppingDayGroup) {
    return schedule.shoppingDayGroup === ShoppingDayGroup.WEEKDAY ? 0 : 6;
  }
  return null;
}

export function getCycleStartDay(
  schedule: ShoppingSchedule | ShoppingDayGroup | number
): number {
  const shoppingDay = normalizeShoppingDay(schedule);
  if (shoppingDay === null) throw new Error('A valid shopping day is required.');
  return (shoppingDay + 1) % 7;
}

export function getOnDemandMealPlanWindow(
  schedule: ShoppingSchedule | ShoppingDayGroup | number | null | undefined,
  now: Date = new Date()
): MealPlanGenerationWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  const today = getManilaMidnight(dateKey);

  const shoppingDay = normalizeShoppingDay(schedule);
  if (shoppingDay === null) {
    return { planType: PlanType.WEEKLY, numDays: 7, startDate: today };
  }

  const weekStartDay = (shoppingDay + 1) % 7;
  if (dayOfWeek === weekStartDay) {
    return { planType: PlanType.WEEKLY, numDays: 7, startDate: today };
  }

  const daysUntilStart = (weekStartDay - dayOfWeek + 7) % 7;
  return {
    planType: PlanType.STARTER,
    numDays: daysUntilStart,
    startDate: today,
  };
}

export function getCurrentWeeklyCycleWindow(
  schedule: ShoppingSchedule | ShoppingDayGroup | number,
  now: Date = new Date()
): WeeklyCycleWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  const daysSinceStart = (dayOfWeek - getCycleStartDay(schedule) + 7) % 7;
  const startKey = addCalendarDays(dateKey, -daysSinceStart);

  return {
    startDate: getManilaMidnight(startKey),
    endDate: getManilaMidnight(addCalendarDays(startKey, 6)),
  };
}

export function getNextWeeklyCycleWindow(
  schedule: ShoppingSchedule | ShoppingDayGroup | number,
  now: Date = new Date()
): WeeklyCycleWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  let daysUntilStart = (getCycleStartDay(schedule) - dayOfWeek + 7) % 7;
  if (daysUntilStart === 0) daysUntilStart = 7;
  const startKey = addCalendarDays(dateKey, daysUntilStart);

  return {
    startDate: getManilaMidnight(startKey),
    endDate: getManilaMidnight(addCalendarDays(startKey, 6)),
  };
}

export function getWeeklyPlanPreparationDate(
  schedule: ShoppingSchedule | ShoppingDayGroup | number,
  now: Date = new Date(),
  leadDays: number = WEEKLY_PLAN_REVIEW_LEAD_DAYS
): Date {
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 6) {
    throw new Error('Weekly plan review lead days must be an integer from 0 to 6.');
  }
  const nextCycle = getNextWeeklyCycleWindow(schedule, now);
  const shoppingDateKey = addCalendarDays(getManilaDateKey(nextCycle.startDate), -1);
  return getManilaMidnight(addCalendarDays(shoppingDateKey, -leadDays));
}

export function isWeeklyPlanPreparationDue(
  schedule: ShoppingSchedule | ShoppingDayGroup | number,
  now: Date = new Date(),
  leadDays: number = WEEKLY_PLAN_REVIEW_LEAD_DAYS
): boolean {
  const todayKey = getManilaDateKey(now);
  const preparationKey = getManilaDateKey(getWeeklyPlanPreparationDate(schedule, now, leadDays));
  const nextCycle = getNextWeeklyCycleWindow(schedule, now);
  const shoppingDayKey = addCalendarDays(getManilaDateKey(nextCycle.startDate), -1);
  return todayKey >= preparationKey && todayKey <= shoppingDayKey;
}

export function getDayBefore(date: Date): Date {
  return getManilaMidnight(addCalendarDays(getManilaDateKey(date), -1));
}
