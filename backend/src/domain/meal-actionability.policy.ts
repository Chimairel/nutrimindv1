import { MealLibraryStatus, MealPlanStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export const MEAL_ACTIONABILITY_BUSINESS_TIME_ZONE = 'Asia/Manila';

const ASIA_MANILA_UTC_OFFSET = '+08:00';

export const USER_ACTIONABLE_MEAL_PLAN_STATUSES = Object.freeze([
  MealPlanStatus.APPROVED,
] as const);

export const APPROVED_MEAL_LIBRARY_STATUSES = Object.freeze([
  MealLibraryStatus.APPROVED,
] as const);

export class MealPlanNotActionableError extends Error {
  readonly code = 'MEAL_PLAN_NOT_ACTIONABLE';

  constructor(message = 'Meal plan item is not currently actionable.') {
    super(message);
    this.name = 'MealPlanNotActionableError';
  }
}

type MealPlanCandidate = {
  status: unknown;
  scheduledDate: Date | string | number | null | undefined;
};

type MealLogCandidate = {
  mealPlan: { status: unknown } | null | undefined;
};

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getManilaBusinessDateKey(
  value: Date | string | number
): string | null {
  const date = toValidDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEAL_ACTIONABILITY_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function getStartOfManilaBusinessDay(now: Date = new Date()): Date {
  const dateKey = getManilaBusinessDateKey(now);
  if (!dateKey) {
    throw new Error('Cannot determine the current Asia/Manila business date.');
  }

  return new Date(`${dateKey}T00:00:00${ASIA_MANILA_UTC_OFFSET}`);
}

export function isUserActionableMealPlanStatus(
  status: unknown
): status is typeof MealPlanStatus.APPROVED {
  switch (status) {
    case MealPlanStatus.APPROVED:
      return true;
    case MealPlanStatus.PENDING_REVIEW:
    case MealPlanStatus.REJECTED:
    case MealPlanStatus.CANCELLED:
    default:
      return false;
  }
}

export function isMealPlanScheduleCurrent(
  scheduledDate: MealPlanCandidate['scheduledDate'],
  now: Date = new Date()
): boolean {
  const scheduledDateKey = scheduledDate === null || scheduledDate === undefined
    ? null
    : getManilaBusinessDateKey(scheduledDate);
  const currentDateKey = getManilaBusinessDateKey(now);

  return Boolean(
    scheduledDateKey &&
    currentDateKey &&
    scheduledDateKey >= currentDateKey
  );
}

export function isUserActionableMealPlan(
  mealPlan: MealPlanCandidate,
  now: Date = new Date()
): boolean {
  return isUserActionableMealPlanStatus(mealPlan.status) &&
    isMealPlanScheduleCurrent(mealPlan.scheduledDate, now);
}

export function assertUserActionableMealPlan(
  mealPlan: MealPlanCandidate,
  now: Date = new Date()
): void {
  if (!isUserActionableMealPlan(mealPlan, now)) {
    throw new MealPlanNotActionableError();
  }
}

export function filterUserActionableMealPlans<T extends MealPlanCandidate>(
  mealPlans: readonly T[],
  now: Date = new Date()
): T[] {
  return mealPlans.filter((mealPlan) => isUserActionableMealPlan(mealPlan, now));
}

export function getApprovedMealPlanStatusWhere(): Prisma.MealPlanWhereInput {
  return {
    status: MealPlanStatus.APPROVED,
  };
}

export function getCurrentMealPlanScheduleWhere(
  now: Date = new Date()
): Prisma.MealPlanWhereInput {
  return {
    scheduledDate: {
      gte: getStartOfManilaBusinessDay(now),
    },
  };
}

export function getUserActionableMealPlanWhere(
  now: Date = new Date()
): Prisma.MealPlanWhereInput {
  return {
    ...getApprovedMealPlanStatusWhere(),
    ...getCurrentMealPlanScheduleWhere(now),
  };
}

export function getOwnedMealPlanWhere(
  userId: string,
  mealPlanId: string
): Prisma.MealPlanWhereInput {
  return {
    id: mealPlanId,
    userId,
  };
}

export function isApprovedMealLibraryStatus(
  status: unknown
): status is typeof MealLibraryStatus.APPROVED {
  switch (status) {
    case MealLibraryStatus.APPROVED:
      return true;
    case MealLibraryStatus.FLAGGED:
    default:
      return false;
  }
}

export function getApprovedMealLibraryWhere(): Prisma.MealLibraryWhereInput {
  return {
    status: MealLibraryStatus.APPROVED,
  };
}

export function isNutritionEligibleMealLog(log: MealLogCandidate): boolean {
  return log.mealPlan === null ||
    (log.mealPlan !== undefined && isUserActionableMealPlanStatus(log.mealPlan.status));
}

export function getNutritionEligibleMealLogWhere(): Prisma.MealLogWhereInput {
  return {
    OR: [
      { mealPlanId: null },
      { mealPlan: { status: MealPlanStatus.APPROVED } },
    ],
  };
}

export function isNutritionistReviewableMealPlanStatus(status: unknown): boolean {
  return status === MealPlanStatus.PENDING_REVIEW;
}

export function getNutritionistReviewableMealPlanWhere(): Prisma.MealPlanWhereInput {
  return {
    status: MealPlanStatus.PENDING_REVIEW,
  };
}

export function isMealPlanHistoryVisible(status: unknown): boolean {
  switch (status) {
    case MealPlanStatus.PENDING_REVIEW:
    case MealPlanStatus.APPROVED:
    case MealPlanStatus.REJECTED:
    case MealPlanStatus.CANCELLED:
      return true;
    default:
      return false;
  }
}

export function isMealPlanNotActionableError(
  error: unknown
): error is MealPlanNotActionableError {
  return error instanceof MealPlanNotActionableError;
}
