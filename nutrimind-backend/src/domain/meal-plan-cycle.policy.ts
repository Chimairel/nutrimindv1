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

function getWeekStartDay(group: ShoppingDayGroup): number {
  return group === ShoppingDayGroup.WEEKDAY ? 1 : 0;
}

export function getOnDemandMealPlanWindow(
  group: ShoppingDayGroup | null | undefined,
  now: Date = new Date()
): MealPlanGenerationWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  const today = getManilaMidnight(dateKey);

  if (!group) {
    return { planType: PlanType.WEEKLY, numDays: 7, startDate: today };
  }

  const weekStartDay = getWeekStartDay(group);
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
  group: ShoppingDayGroup,
  now: Date = new Date()
): WeeklyCycleWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  const daysSinceStart = (dayOfWeek - getWeekStartDay(group) + 7) % 7;
  const startKey = addCalendarDays(dateKey, -daysSinceStart);

  return {
    startDate: getManilaMidnight(startKey),
    endDate: getManilaMidnight(addCalendarDays(startKey, 6)),
  };
}

export function getNextWeeklyCycleWindow(
  group: ShoppingDayGroup,
  now: Date = new Date()
): WeeklyCycleWindow {
  const { dateKey, dayOfWeek } = getManilaDateParts(now);
  let daysUntilStart = (getWeekStartDay(group) - dayOfWeek + 7) % 7;
  if (daysUntilStart === 0) daysUntilStart = 7;
  const startKey = addCalendarDays(dateKey, daysUntilStart);

  return {
    startDate: getManilaMidnight(startKey),
    endDate: getManilaMidnight(addCalendarDays(startKey, 6)),
  };
}

export function getDayBefore(date: Date): Date {
  return getManilaMidnight(addCalendarDays(getManilaDateKey(date), -1));
}
