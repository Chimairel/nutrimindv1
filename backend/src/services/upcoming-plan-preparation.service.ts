import { MealPlanCycleStatus, MealPlanStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { MealGenerationService } from './meal-generation.service';
import { CertifiedSlotFallbackService } from './certified-slot-fallback.service';
import { DEADLINE_FALLBACK_CALORIE_TOLERANCE } from '@/domain/upcoming-preparation.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { GroceryService } from './grocery.service';

export class UpcomingPlanPreparationService {
  private static readonly inFlight = new Map<string, Promise<unknown>>();

  static triggerNonBlocking(userId: string, now: Date = new Date()): void {
    if (this.inFlight.has(userId)) return;
    const task = new Promise<void>((resolve) => {
      setImmediate(() => {
        void this.ensureForUser(userId, now)
          .catch((error) => console.error('[UpcomingPreparation] Recovery trigger failed:', error))
          .finally(() => {
            this.inFlight.delete(userId);
            resolve();
          });
      });
    });
    this.inFlight.set(userId, task);
  }

  static async ensureForUser(userId: string, now: Date = new Date()) {
    const result = await MealGenerationService.ensureUpcomingPlanForUser(userId, now);
    if (result.planGroupId) await this.reconcileDeadline(userId, result.planGroupId, now);
    return result;
  }

  static async reconcileDeadline(userId: string, cycleId: string, now: Date = new Date()) {
    const cycle = await prisma.mealPlanCycle.findFirst({
      where: { id: cycleId, userId },
      include: {
        mealPlans: {
          where: { status: MealPlanStatus.PENDING_REVIEW },
          orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!cycle || cycle.shoppingStartedAt || now.getTime() < cycle.shoppingDeadlineAt.getTime()) return cycle;

    const handledSlots = new Set<string>();
    for (const pending of cycle.mealPlans) {
      const slotKey = `${pending.scheduledDate.getTime()}:${pending.mealType}`;
      if (handledSlots.has(slotKey)) continue;
      handledSlots.add(slotKey);
      const fallback = await CertifiedSlotFallbackService.replaceWithBestCertified({
        mealPlanId: pending.id,
        tolerance: DEADLINE_FALLBACK_CALORIE_TOLERANCE,
        reasonCode: 'SHOPPING_DEADLINE_WIDER_TOLERANCE',
        expectedStatus: MealPlanStatus.PENDING_REVIEW,
      });
      if (!fallback.replaced) {
        await prisma.$transaction(async (tx) => {
          await tx.mealPlan.updateMany({
            where: {
              planGroupId: cycle.id,
              scheduledDate: pending.scheduledDate,
              mealType: pending.mealType,
              status: MealPlanStatus.PENDING_REVIEW,
            },
            data: { status: MealPlanStatus.CANCELLED },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: null,
              action: 'MEAL_PLAN_SLOT_UNAVAILABLE_AT_DEADLINE',
              entityType: 'MealPlanCycle',
              entityId: cycle.id,
              metadata: {
                scheduledDate: pending.scheduledDate.toISOString(),
                mealType: pending.mealType,
              },
            },
          });
        });
      }
    }

    await MealPlanCycleService.synchronizeLifecycle(userId, now);
    const updated = await prisma.mealPlanCycle.findUnique({ where: { id: cycle.id } });
    if (updated?.status === MealPlanCycleStatus.READY_TO_SHOP) {
      await GroceryService.generateGroceryList(userId, undefined, cycle.id);
    }
    return updated;
  }

  static async runScheduled(now: Date = new Date()) {
    const results = { scanned: 0, prepared: 0, existing: 0, notOpen: 0, failed: 0 };
    let afterId: string | undefined;
    while (true) {
      const users = await prisma.user.findMany({
        where: {
          id: afterId ? { gt: afterId } : undefined,
          role: 'USER',
          onboardingDone: true,
          nutritionReport: { acknowledgedAt: { not: null }, isStale: false },
        },
        orderBy: { id: 'asc' },
        select: { id: true },
        take: 100,
      });
      if (users.length === 0) break;
      afterId = users[users.length - 1].id;
      for (const user of users) {
        results.scanned += 1;
        try {
          const result = await this.ensureForUser(user.id, now);
          if (result.state === 'PREPARED') results.prepared += 1;
          else if (result.state === 'EXISTING') results.existing += 1;
          else results.notOpen += 1;
        } catch (error) {
          results.failed += 1;
          console.error(`[UpcomingPreparation] Scheduled preparation failed for user ${user.id}:`, error);
        }
      }
      if (users.length < 100) break;
    }
    return results;
  }
}
