import prisma from '@/lib/prisma';
import { deriveMealPlanCycleLifecycle, getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import {
  ConditionClearanceState,
  MealPlanStatus,
  MealPlanCycleStatus,
  MealLibrarySafetyEvidenceStatus,
  MealLibraryStatus,
  Prisma,
  ProfileCycleAdaptationState,
} from '@prisma/client';

type CycleClient = Pick<Prisma.TransactionClient, 'mealPlanCycle'>;

export const mealPlanCycleSummarySelect = {
  id: true,
  planType: true,
  cycleRevision: true,
  startDate: true,
  endDate: true,
  preparationOpensAt: true,
  shoppingDeadlineAt: true,
  expectedSlotCount: true,
  status: true,
  profileAdaptationState: true,
  requestedProfileRevision: true,
  requestedSafetyRevision: true,
  acknowledgedProfileRevision: true,
  pendingProfileChangeKinds: true,
  deadlineOutcome: true,
  readyAt: true,
  activatedAt: true,
  incompleteAcknowledgedAt: true,
  shoppingStartedAt: true,
  supersededAt: true,
  supersededById: true,
  snapshot: {
    select: {
      profileRevision: true,
      safetyRevision: true,
      dailyCalorieTarget: true,
      generatedAt: true,
    },
  },
  _count: { select: { mealPlans: true } },
} satisfies Prisma.MealPlanCycleSelect;

export class MealPlanCycleService {
  static getBusinessDay(now: Date = new Date()): Date {
    return getManilaMidnight(getManilaDateKey(now));
  }

  /**
   * Returns only slots whose complete reusable/manual evidence is current for
   * this cycle's user. Grocery projection and lifecycle readiness share this
   * authority so APPROVED alone can never leak an invalidated meal.
   */
  static async getClearedMealPlanIds(
    userId: string,
    cycleId: string,
    now: Date = new Date(),
    client: CycleClient = prisma
  ): Promise<string[]> {
    const cycle = await client.mealPlanCycle.findFirst({
      where: { id: cycleId, userId },
      select: {
        user: { select: { healthConditions: { select: { condition: true } } } },
        mealPlans: {
          where: { status: { not: MealPlanStatus.CANCELLED } },
          select: {
            id: true,
            status: true,
            requiresSafetyRevalidation: true,
            libraryMealId: true,
            baseRecipeSignature: true,
            composedServingSignature: true,
            safetyPolicyVersion: true,
            highRiskReviewRequired: true,
            reviewApprovalCount: true,
            libraryMeal: {
              select: {
                status: true,
                safetyEvidenceStatus: true,
                safetyEvidenceRevision: true,
                recipeSignature: true,
              },
            },
            clearanceUsages: {
              select: {
                condition: true,
                composedServingSignature: true,
                clearance: {
                  select: {
                    state: true,
                    recipeSignature: true,
                    evidenceRevision: true,
                    composedServingSignature: true,
                    expiresAt: true,
                  },
                },
              },
            },
            reviewDecisions: {
              where: { decision: 'APPROVE' },
              select: { nutritionistProfileId: true },
            },
          },
        },
      },
    });
    if (!cycle) return [];
    const requiredConditions = new Set(
      cycle.user.healthConditions.map((item) => item.condition).filter((condition) => condition !== 'NONE')
    );
    return cycle.mealPlans
      .filter((meal) => {
        if (
          meal.status !== MealPlanStatus.APPROVED ||
          meal.requiresSafetyRevalidation ||
          !meal.baseRecipeSignature ||
          !meal.composedServingSignature ||
          !meal.safetyPolicyVersion
        ) {
          return false;
        }
        if (meal.libraryMealId) {
          const library = meal.libraryMeal;
          if (
            !library ||
            library.status !== MealLibraryStatus.APPROVED ||
            library.safetyEvidenceStatus !== MealLibrarySafetyEvidenceStatus.COMPLETE ||
            library.recipeSignature !== meal.baseRecipeSignature
          ) {
            return false;
          }
          const validConditions = new Set(
            meal.clearanceUsages
              .filter(
                (usage) =>
                  usage.clearance.state === ConditionClearanceState.ACTIVE &&
                  usage.clearance.recipeSignature === library.recipeSignature &&
                  usage.clearance.evidenceRevision === library.safetyEvidenceRevision &&
                  usage.composedServingSignature === meal.composedServingSignature &&
                  (!usage.clearance.composedServingSignature ||
                    usage.clearance.composedServingSignature === meal.composedServingSignature) &&
                  (!usage.clearance.expiresAt || usage.clearance.expiresAt > now)
              )
              .map((usage) => usage.condition)
          );
          return [...requiredConditions].every((condition) => validConditions.has(condition));
        }
        const distinctApprovers = new Set(meal.reviewDecisions.map((decision) => decision.nutritionistProfileId));
        const requiredApprovals = meal.highRiskReviewRequired ? 2 : 1;
        return meal.reviewApprovalCount >= requiredApprovals && distinctApprovers.size >= requiredApprovals;
      })
      .map((meal) => meal.id);
  }

  static async synchronizeLifecycle(
    userId: string,
    now: Date = new Date(),
    client: CycleClient = prisma
  ): Promise<void> {
    const cycles = await client.mealPlanCycle.findMany({
      where: {
        userId,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      select: {
        id: true,
        status: true,
        profileAdaptationState: true,
        startDate: true,
        endDate: true,
        shoppingDeadlineAt: true,
        expectedSlotCount: true,
        deadlineOutcome: true,
        readyAt: true,
        activatedAt: true,
        shoppingStartedAt: true,
        groceryList: { select: { isStale: true } },
        user: { select: { healthConditions: { select: { condition: true } } } },
        mealPlans: {
          where: { status: { not: MealPlanStatus.CANCELLED } },
          select: {
            id: true,
            status: true,
            mealType: true,
            scheduledDate: true,
            requiresSafetyRevalidation: true,
            createdAt: true,
            reviewedAt: true,
            libraryMealId: true,
            baseRecipeSignature: true,
            composedServingSignature: true,
            safetyPolicyVersion: true,
            highRiskReviewRequired: true,
            reviewApprovalCount: true,
            libraryMeal: {
              select: {
                status: true,
                safetyEvidenceStatus: true,
                safetyEvidenceRevision: true,
                recipeSignature: true,
              },
            },
            clearanceUsages: {
              select: {
                condition: true,
                composedServingSignature: true,
                clearance: {
                  select: {
                    state: true,
                    recipeSignature: true,
                    evidenceRevision: true,
                    composedServingSignature: true,
                    expiresAt: true,
                  },
                },
              },
            },
            reviewDecisions: {
              where: { decision: 'APPROVE' },
              select: { nutritionistProfileId: true, stage: true },
            },
          },
        },
      },
    });

    for (const cycle of cycles) {
      if (cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) {
        const gatedStatus =
          cycle.profileAdaptationState === ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED
            ? MealPlanCycleStatus.REVALIDATION_REQUIRED
            : MealPlanCycleStatus.PREPARING;
        if (cycle.status !== gatedStatus) {
          await client.mealPlanCycle.updateMany({
            where: { id: cycle.id, userId, status: cycle.status },
            data: { status: gatedStatus },
          });
        }
        continue;
      }
      const clearedMealPlanIds = new Set(await this.getClearedMealPlanIds(userId, cycle.id, now, client));
      const clearedMeals = cycle.mealPlans.filter((meal) => clearedMealPlanIds.has(meal.id));
      const clearedSlots = new Set(clearedMeals.map((meal) => `${meal.scheduledDate.getTime()}:${meal.mealType}`));
      const allSlotsCleared = clearedSlots.size >= cycle.expectedSlotCount;
      const groceryProjectionReady = Boolean(cycle.groceryList && !cycle.groceryList.isStale);
      const hasCompleteSlotSet = allSlotsCleared && groceryProjectionReady;
      const observedReadyAt = hasCompleteSlotSet
        ? (cycle.readyAt ??
          new Date(Math.max(...clearedMeals.map((meal) => (meal.reviewedAt ?? meal.createdAt).getTime()))))
        : cycle.readyAt;
      const next = deriveMealPlanCycleLifecycle({
        ...cycle,
        readyAt: observedReadyAt,
        now,
        hasAnySlots: cycle.mealPlans.length > 0,
        hasCompleteSlotSet,
      });
      const readyAt = observedReadyAt;
      const activatedAt = next.status === MealPlanCycleStatus.ACTIVE ? (cycle.activatedAt ?? now) : cycle.activatedAt;
      if (
        next.status === cycle.status &&
        next.deadlineOutcome === cycle.deadlineOutcome &&
        readyAt === cycle.readyAt &&
        activatedAt === cycle.activatedAt
      ) {
        continue;
      }
      await client.mealPlanCycle.updateMany({
        where: { id: cycle.id, userId, status: cycle.status },
        data: {
          status: next.status,
          deadlineOutcome: next.deadlineOutcome,
          readyAt,
          activatedAt,
        },
      });
    }
  }

  static async getCurrentCycle(userId: string, now: Date = new Date()) {
    await this.synchronizeLifecycle(userId, now);
    const businessDay = this.getBusinessDay(now);
    return prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { lte: businessDay },
        endDate: { gte: businessDay },
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
      select: mealPlanCycleSummarySelect,
    });
  }

  static async getUpcomingCycle(userId: string, now: Date = new Date()) {
    await this.synchronizeLifecycle(userId, now);
    const businessDay = this.getBusinessDay(now);
    return prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { gt: businessDay },
        status: { notIn: [MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.COMPLETED] },
      },
      orderBy: [{ startDate: 'asc' }, { cycleRevision: 'desc' }],
      select: mealPlanCycleSummarySelect,
    });
  }

  static async getCurrentAndUpcoming(userId: string, now: Date = new Date()) {
    await this.synchronizeLifecycle(userId, now);
    const businessDay = this.getBusinessDay(now);
    const [current, upcoming] = await Promise.all([
      prisma.mealPlanCycle.findFirst({
        where: {
          userId,
          startDate: { lte: businessDay },
          endDate: { gte: businessDay },
          status: { not: MealPlanCycleStatus.SUPERSEDED },
        },
        orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
        select: mealPlanCycleSummarySelect,
      }),
      prisma.mealPlanCycle.findFirst({
        where: {
          userId,
          startDate: { gt: businessDay },
          status: { notIn: [MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.COMPLETED] },
        },
        orderBy: [{ startDate: 'asc' }, { cycleRevision: 'desc' }],
        select: mealPlanCycleSummarySelect,
      }),
    ]);
    return { current, upcoming };
  }

  static async recordShoppingStarted(
    client: Prisma.TransactionClient,
    userId: string,
    cycleId: string,
    now: Date = new Date()
  ): Promise<void> {
    await this.synchronizeLifecycle(userId, now, client);
    const cycle = await client.mealPlanCycle.findFirst({ where: { id: cycleId, userId } });
    if (!cycle) throw new Error('The shopping list is not attached to an accessible plan cycle.');
    if (cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) {
      throw new Error('This cycle is waiting for profile review or rebuilding and cannot be used for shopping.');
    }
    if (
      cycle.status === MealPlanCycleStatus.PREPARING ||
      cycle.status === MealPlanCycleStatus.UNDER_REVIEW ||
      cycle.status === MealPlanCycleStatus.REVALIDATION_REQUIRED ||
      cycle.status === MealPlanCycleStatus.SUPERSEDED ||
      cycle.status === MealPlanCycleStatus.COMPLETED
    ) {
      throw new Error('This cycle is not ready for shopping.');
    }
    if (cycle.status === MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE && cycle.incompleteAcknowledgedAt === null) {
      throw new Error('Acknowledge the missing plan slots before shopping from this partial list.');
    }
    if (cycle.shoppingStartedAt) return;

    await client.mealPlanCycle.updateMany({
      where: { id: cycle.id, userId, shoppingStartedAt: null },
      data: {
        shoppingStartedAt: now,
        ...(cycle.status === MealPlanCycleStatus.ACTIVE ? {} : { status: MealPlanCycleStatus.SHOPPING_STARTED }),
      },
    });
  }

  static async acknowledgeIncompleteCycle(userId: string, cycleId: string, now: Date = new Date()) {
    return prisma.$transaction(async (tx) => {
      await this.synchronizeLifecycle(userId, now, tx);
      const cycle = await tx.mealPlanCycle.findFirst({ where: { id: cycleId, userId } });
      if (!cycle) throw new Error('Meal-plan cycle not found.');
      if (cycle.incompleteAcknowledgedAt) return cycle;
      if (
        cycle.status !== MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE &&
        !(cycle.status === MealPlanCycleStatus.ACTIVE && cycle.deadlineOutcome === 'INCOMPLETE')
      ) {
        throw new Error('Only an incomplete-at-deadline cycle can be acknowledged.');
      }
      return tx.mealPlanCycle.update({
        where: { id: cycle.id },
        data: { incompleteAcknowledgedAt: now },
      });
    });
  }

  static async startShopping(userId: string, cycleId: string, now: Date = new Date()) {
    return prisma.$transaction(async (tx) => {
      const grocery = await tx.groceryList.findUnique({
        where: { planGroupId: cycleId },
        select: { userId: true, isStale: true },
      });
      if (!grocery || grocery.userId !== userId || grocery.isStale) {
        throw new Error('A current shopping list is required before shopping can start.');
      }
      await this.recordShoppingStarted(tx, userId, cycleId, now);
      return tx.mealPlanCycle.findUniqueOrThrow({
        where: { id: cycleId },
        select: mealPlanCycleSummarySelect,
      });
    });
  }
}
