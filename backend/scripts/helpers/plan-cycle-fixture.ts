import { MealPlanCycleStatus, MealPlanCycleDeadlineOutcome, PlanType, PrismaClient } from '@prisma/client';
import { getManilaMidnight, getManilaDateKey, getScheduledMealDate } from '../../src/domain/meal-plan-cycle.policy';

type PlanCycleClient = Pick<PrismaClient, 'mealPlanCycle'>;

interface FixturePlanCycleInput {
  id: string;
  userId: string;
  startDate?: Date;
  endDate?: Date;
  planType?: PlanType;
  status?: MealPlanCycleStatus;
  expectedSlotCount?: number;
}

/**
 * Creates the cycle root required by plan, grocery, snapshot, and generation-job
 * fixtures. Acceptance scripts should use ACTIVE only when they are explicitly
 * exercising authoritative current-cycle behavior; unrelated fixtures should
 * remain SUPERSEDED so they cannot influence current/upcoming lookup.
 */
export async function createFixturePlanCycle(client: PlanCycleClient, input: FixturePlanCycleInput) {
  const startDate = getManilaMidnight(getManilaDateKey(input.startDate ?? new Date()));
  const endDate = input.endDate ? getManilaMidnight(getManilaDateKey(input.endDate)) : startDate;
  const status = input.status ?? MealPlanCycleStatus.SUPERSEDED;
  const activeLike = status === MealPlanCycleStatus.ACTIVE;

  return client.mealPlanCycle.create({
    data: {
      id: input.id,
      userId: input.userId,
      planType: input.planType ?? PlanType.STARTER,
      startDate,
      endDate,
      preparationOpensAt: startDate,
      shoppingDeadlineAt: startDate,
      expectedSlotCount: input.expectedSlotCount ?? 3,
      status,
      deadlineOutcome: status === MealPlanCycleStatus.COMPLETED ? MealPlanCycleDeadlineOutcome.COMPLETE : undefined,
      activatedAt: activeLike ? startDate : undefined,
      supersededAt: status === MealPlanCycleStatus.SUPERSEDED ? new Date() : undefined,
    },
  });
}

export function fixtureCycleEnd(startDate: Date, days: number): Date {
  return getScheduledMealDate(startDate, Math.max(0, days - 1));
}
