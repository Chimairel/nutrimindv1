import {
  MealPlanCycleDeadlineOutcome,
  MealPlanCycleStatus,
  PlanType,
  ShoppingDayGroup,
} from '@prisma/client';

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

export interface MealPlanCycleTiming extends WeeklyCycleWindow {
  preparationOpensAt: Date;
  shoppingDeadlineAt: Date;
  expectedSlotCount: number;
}

export interface ShoppingSchedule {
  shoppingDayOfWeek?: number | null;
  shoppingDayGroup?: ShoppingDayGroup | null;
}

export interface MealPlanCycleLifecycleFacts {
  status: MealPlanCycleStatus;
  startDate: Date;
  endDate: Date;
  shoppingDeadlineAt: Date;
  deadlineOutcome: MealPlanCycleDeadlineOutcome | null;
  readyAt: Date | null;
  shoppingStartedAt: Date | null;
  hasAnySlots: boolean;
  hasCompleteSlotSet: boolean;
  now: Date;
}

export interface MealPlanCycleLifecycleResult {
  status: MealPlanCycleStatus;
  deadlineOutcome: MealPlanCycleDeadlineOutcome | null;
}

/**
 * Reduces persisted cycle facts to one lifecycle state. Slot review status is
 * intentionally an input rather than the lifecycle itself. Deadline outcome
 * is write-once: a plan completed after the cutoff remains recorded as having
 * missed that cutoff even if it later becomes ready to shop.
 */
export function deriveMealPlanCycleLifecycle(
  facts: MealPlanCycleLifecycleFacts
): MealPlanCycleLifecycleResult {
  if (
    facts.status === MealPlanCycleStatus.SUPERSEDED ||
    facts.status === MealPlanCycleStatus.COMPLETED
  ) {
    return { status: facts.status, deadlineOutcome: facts.deadlineOutcome };
  }

  const businessDay = getManilaMidnight(getManilaDateKey(facts.now));
  const cutoffReached = facts.now.getTime() >= facts.shoppingDeadlineAt.getTime();
  const deadlineOutcome =
    facts.deadlineOutcome ??
    (cutoffReached
      ? facts.hasCompleteSlotSet &&
        facts.readyAt !== null &&
        facts.readyAt.getTime() <= facts.shoppingDeadlineAt.getTime()
        ? MealPlanCycleDeadlineOutcome.COMPLETE
        : MealPlanCycleDeadlineOutcome.INCOMPLETE
      : null);

  if (facts.endDate.getTime() < businessDay.getTime()) {
    return { status: MealPlanCycleStatus.COMPLETED, deadlineOutcome };
  }
  if (facts.status === MealPlanCycleStatus.REVALIDATION_REQUIRED) {
    return { status: facts.status, deadlineOutcome };
  }
  if (
    facts.startDate.getTime() <= businessDay.getTime() &&
    facts.endDate.getTime() >= businessDay.getTime()
  ) {
    return { status: MealPlanCycleStatus.ACTIVE, deadlineOutcome };
  }
  if (facts.shoppingStartedAt) {
    return { status: MealPlanCycleStatus.SHOPPING_STARTED, deadlineOutcome };
  }
  if (facts.hasCompleteSlotSet) {
    return { status: MealPlanCycleStatus.READY_TO_SHOP, deadlineOutcome };
  }
  if (cutoffReached) {
    return { status: MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE, deadlineOutcome };
  }
  return {
    status: facts.hasAnySlots ? MealPlanCycleStatus.UNDER_REVIEW : MealPlanCycleStatus.PREPARING,
    deadlineOutcome,
  };
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

export function getMealPlanCycleTiming(
  planType: PlanType,
  startDate: Date,
  numDays: number,
  preparationLeadDays: number = 3
): MealPlanCycleTiming {
  if (!Number.isInteger(numDays) || numDays < 1 || numDays > 7) {
    throw new Error('Meal-plan cycle length must be between one and seven calendar days.');
  }
  if (!Number.isInteger(preparationLeadDays) || preparationLeadDays < 0 || preparationLeadDays > 14) {
    throw new Error('Meal-plan preparation lead time is outside the supported range.');
  }

  const normalizedStart = getManilaMidnight(getManilaDateKey(startDate));
  const endDate = getScheduledMealDate(normalizedStart, numDays - 1);
  const shoppingDeadlineAt =
    planType === PlanType.WEEKLY ? getScheduledMealDate(normalizedStart, -1) : normalizedStart;
  const preparationOpensAt =
    planType === PlanType.WEEKLY
      ? getScheduledMealDate(shoppingDeadlineAt, -preparationLeadDays)
      : normalizedStart;

  return {
    startDate: normalizedStart,
    endDate,
    preparationOpensAt,
    shoppingDeadlineAt,
    expectedSlotCount: numDays * 3,
  };
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

export function getCycleStartDay(schedule: ShoppingSchedule | ShoppingDayGroup | number): number {
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

export function getDayBefore(date: Date): Date {
  return getManilaMidnight(addCalendarDays(getManilaDateKey(date), -1));
}
