import { MealPlanCycleStatus, MealPlanStatus, Prisma, ProfileCycleAdaptationState } from '@prisma/client';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';

export const PROFILE_CHANGE_KIND = {
  BODY_TARGETS: 'BODY_TARGETS',
  FOOD_PREFERENCES: 'FOOD_PREFERENCES',
  SHOPPING_SCHEDULE: 'SHOPPING_SCHEDULE',
  SAFETY: 'SAFETY',
} as const;

export type ProfileChangeKind = (typeof PROFILE_CHANGE_KIND)[keyof typeof PROFILE_CHANGE_KIND];

const TERMINAL_CYCLE_STATUSES = [MealPlanCycleStatus.COMPLETED, MealPlanCycleStatus.SUPERSEDED] as const;

/**
 * Records the profile revision a prepared cycle must react to without mutating
 * its immutable generation snapshot. Active and shopping-started cycles retain
 * their historical targets for ordinary changes.
 */
export class ProfileCycleAdaptationService {
  static async recordOrdinaryChange(
    tx: Prisma.TransactionClient,
    userId: string,
    profileRevision: number,
    changeKinds: readonly ProfileChangeKind[],
    now: Date = new Date()
  ) {
    const businessDay = getStartOfManilaBusinessDay(now);
    return tx.mealPlanCycle.updateMany({
      where: {
        userId,
        startDate: { gt: businessDay },
        shoppingStartedAt: null,
        status: { notIn: [...TERMINAL_CYCLE_STATUSES, MealPlanCycleStatus.SHOPPING_STARTED] },
      },
      data: {
        profileAdaptationState: ProfileCycleAdaptationState.AWAITING_REPORT_ACKNOWLEDGMENT,
        requestedProfileRevision: profileRevision,
        pendingProfileChangeKinds: [...new Set(changeKinds)],
      },
    });
  }

  /** Safety changes fail closed across every unconsumed current/future cycle. */
  static async recordSafetyChange(
    tx: Prisma.TransactionClient,
    userId: string,
    profileRevision: number,
    safetyRevision: number,
    now: Date = new Date()
  ) {
    const businessDay = getStartOfManilaBusinessDay(now);
    await tx.mealPlanCycle.updateMany({
      where: {
        userId,
        endDate: { gte: businessDay },
        status: { notIn: [...TERMINAL_CYCLE_STATUSES] },
      },
      data: {
        status: MealPlanCycleStatus.REVALIDATION_REQUIRED,
        profileAdaptationState: ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED,
        requestedProfileRevision: profileRevision,
        requestedSafetyRevision: safetyRevision,
        acknowledgedProfileRevision: null,
        pendingProfileChangeKinds: [PROFILE_CHANGE_KIND.SAFETY],
      },
    });
  }

  /**
   * Releases only cycles waiting for the exact report revision the user saw.
   * Shopping-day changes retire the now-wrong dated identity. Other ordinary
   * changes preserve rows for the later rebuild/rerank pass while blocking use.
   */
  static async acknowledgeProfileRevision(
    tx: Prisma.TransactionClient,
    userId: string,
    profileRevision: number,
    now: Date = new Date()
  ) {
    const waiting = await tx.mealPlanCycle.findMany({
      where: {
        userId,
        requestedProfileRevision: profileRevision,
        profileAdaptationState: {
          in: [
            ProfileCycleAdaptationState.AWAITING_REPORT_ACKNOWLEDGMENT,
            ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED,
          ],
        },
      },
      select: { id: true, profileAdaptationState: true, pendingProfileChangeKinds: true },
    });

    for (const cycle of waiting) {
      if (
        cycle.profileAdaptationState === ProfileCycleAdaptationState.AWAITING_REPORT_ACKNOWLEDGMENT &&
        cycle.pendingProfileChangeKinds.includes(PROFILE_CHANGE_KIND.SHOPPING_SCHEDULE)
      ) {
        await tx.mealPlan.updateMany({
          where: {
            planGroupId: cycle.id,
            status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
          },
          data: { status: MealPlanStatus.CANCELLED },
        });
        await tx.groceryList.updateMany({ where: { planGroupId: cycle.id }, data: { isStale: true } });
        await tx.mealPlanCycle.update({
          where: { id: cycle.id },
          data: {
            status: MealPlanCycleStatus.SUPERSEDED,
            supersededAt: now,
            acknowledgedProfileRevision: profileRevision,
          },
        });
        continue;
      }

      if (cycle.profileAdaptationState === ProfileCycleAdaptationState.AWAITING_REPORT_ACKNOWLEDGMENT) {
        await tx.groceryList.updateMany({ where: { planGroupId: cycle.id }, data: { isStale: true } });
        await tx.mealPlanCycle.update({
          where: { id: cycle.id },
          data: {
            status: MealPlanCycleStatus.PREPARING,
            profileAdaptationState: ProfileCycleAdaptationState.REBUILD_REQUIRED,
            acknowledgedProfileRevision: profileRevision,
          },
        });
        continue;
      }

      await tx.mealPlanCycle.update({
        where: { id: cycle.id },
        data: { acknowledgedProfileRevision: profileRevision },
      });
    }

    await this.reconcileSafetyCycles(tx, userId);
  }

  /** Clear the safety gate only after report acknowledgment and every slot is actionable. */
  static async reconcileSafetyCycles(tx: Prisma.TransactionClient, userId: string) {
    const cycles = await tx.mealPlanCycle.findMany({
      where: {
        userId,
        profileAdaptationState: ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED,
        status: { notIn: [...TERMINAL_CYCLE_STATUSES] },
      },
      select: {
        id: true,
        requestedProfileRevision: true,
        acknowledgedProfileRevision: true,
        expectedSlotCount: true,
        mealPlans: {
          where: { status: { not: MealPlanStatus.CANCELLED } },
          select: { status: true, requiresSafetyRevalidation: true, scheduledDate: true, mealType: true },
        },
      },
    });

    for (const cycle of cycles) {
      if (
        cycle.requestedProfileRevision === null ||
        cycle.acknowledgedProfileRevision !== cycle.requestedProfileRevision
      ) {
        continue;
      }
      const actionableSlots = new Set(
        cycle.mealPlans
          .filter((meal) => meal.status === MealPlanStatus.APPROVED && meal.requiresSafetyRevalidation === false)
          .map((meal) => `${meal.scheduledDate.getTime()}:${meal.mealType}`)
      );
      if (actionableSlots.size < cycle.expectedSlotCount) continue;

      await tx.mealPlanCycle.update({
        where: { id: cycle.id },
        data: {
          status: MealPlanCycleStatus.PREPARING,
          profileAdaptationState: ProfileCycleAdaptationState.CURRENT,
          pendingProfileChangeKinds: [],
        },
      });
    }
  }
}
