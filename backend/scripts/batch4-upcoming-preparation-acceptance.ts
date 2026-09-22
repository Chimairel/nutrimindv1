import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  AssuranceTier,
  MealPlanCycleStatus,
  MealPlanStatus,
  MealType,
  PlanType,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { CertifiedSlotFallbackService } from '../src/services/certified-slot-fallback.service';
import { UPCOMING_PREPARATION_POLICY_VERSION } from '../src/domain/upcoming-preparation.policy';

async function main() {
  const run = randomUUID();
  let userId: string | null = null;
  let cycleId: string | null = null;
  let readinessCycleId: string | null = null;
  let libraryMealId: string | null = null;
  let fallbackCycleId: string | null = null;
  let fallbackReplacementId: string | null = null;
  let fallbackLibraryMealId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 4 Deadline Fixture',
        email: `batch4-${run}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
      },
    });
    userId = user.id;
    cycleId = `batch4-${run}`;
    const now = new Date('2026-09-23T04:00:00.000Z');
    const startDate = new Date('2026-09-24T16:00:00.000Z');
    const endDate = new Date('2026-09-30T16:00:00.000Z');
    const preparationOpensAt = new Date('2026-09-19T16:00:00.000Z');
    const shoppingDeadlineAt = new Date('2026-09-22T16:00:00.000Z');

    await prisma.mealPlanCycle.create({
      data: {
        id: cycleId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate,
        endDate,
        preparationOpensAt,
        shoppingDeadlineAt,
        preparationPolicyVersion: UPCOMING_PREPARATION_POLICY_VERSION,
        assuranceTier: AssuranceTier.STANDARD,
        preparationTriggeredAt: preparationOpensAt,
        expectedSlotCount: 21,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    const pending = await prisma.mealPlan.create({
      data: {
        planGroupId: cycleId,
        userId: user.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: 'Unsafe-to-publish deadline fixture',
        calories: 450,
        proteinG: 20,
        carbsG: 55,
        fatG: 15,
        scheduledDate: startDate,
        reviewWorkKey: 'a'.repeat(64),
        candidateRank: 1,
        rankingScore: 50,
        rankingReasonCodes: ['INGREDIENTS_RESOLVED'],
      },
    });

    const reconciled = await UpcomingPlanPreparationService.reconcileDeadline(user.id, cycleId, now);
    assert.equal(reconciled?.status, MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE);
    const [slot, audit] = await Promise.all([
      prisma.mealPlan.findUniqueOrThrow({ where: { id: pending.id } }),
      prisma.auditEvent.findFirst({
        where: { entityType: 'MealPlanCycle', entityId: cycleId, action: 'MEAL_PLAN_SLOT_UNAVAILABLE_AT_DEADLINE' },
      }),
    ]);
    assert.equal(slot.status, MealPlanStatus.CANCELLED);
    assert.ok(audit);
    assert.equal(await prisma.groceryList.count({ where: { planGroupId: cycleId } }), 0);

    readinessCycleId = `batch4-ready-${run}`;
    const readinessStart = new Date('2026-10-04T16:00:00.000Z');
    const readinessEnd = new Date('2026-10-10T16:00:00.000Z');
    const libraryMeal = await prisma.mealLibrary.create({
      data: {
        mealName: `Batch 4 readiness ${run}`,
        mealType: MealType.BREAKFAST,
        calories: 450,
        proteinG: 20,
        carbsG: 55,
        fatG: 15,
        recipeSignature: randomUUID().replaceAll('-', ''),
        status: 'APPROVED',
        safetyEvidenceStatus: 'COMPLETE',
      },
    });
    libraryMealId = libraryMeal.id;
    await prisma.mealPlanCycle.create({
      data: {
        id: readinessCycleId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: readinessStart,
        endDate: readinessEnd,
        preparationOpensAt: new Date('2026-09-30T16:00:00.000Z'),
        shoppingDeadlineAt: new Date('2026-10-03T16:00:00.000Z'),
        expectedSlotCount: 21,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER] as const;
    await prisma.mealPlan.createMany({
      data: Array.from({ length: 7 }, (_, day) =>
        mealTypes.map((mealType) => ({
          planGroupId: readinessCycleId!,
          userId: user.id,
          libraryMealId: libraryMeal.id,
          status: MealPlanStatus.APPROVED,
          planType: PlanType.WEEKLY,
          mealType,
          mealName: libraryMeal.mealName,
          calories: libraryMeal.calories,
          proteinG: libraryMeal.proteinG,
          carbsG: libraryMeal.carbsG,
          fatG: libraryMeal.fatG,
          scheduledDate: new Date(readinessStart.getTime() + day * 86_400_000),
          reviewedAt: now,
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
          baseRecipeSignature: libraryMeal.recipeSignature,
          composedServingSignature: libraryMeal.recipeSignature,
        }))
      ).flat(),
    });
    await MealPlanCycleService.synchronizeLifecycle(user.id, now);
    const beforeGrocery = await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: readinessCycleId } });
    assert.equal(beforeGrocery.status, MealPlanCycleStatus.UNDER_REVIEW);
    await prisma.groceryList.create({
      data: { userId: user.id, planGroupId: readinessCycleId, weekLabel: 'Batch 4 acceptance', isStale: false },
    });
    await MealPlanCycleService.synchronizeLifecycle(user.id, now);
    const afterGrocery = await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: readinessCycleId } });
    assert.equal(afterGrocery.status, MealPlanCycleStatus.READY_TO_SHOP);

    await prisma.userProfile.create({
      data: {
        userId: user.id,
        age: 30,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 70,
        targetWeightKg: 70,
        goal: 'MAINTAIN',
        activityLevel: 'LIGHTLY_ACTIVE',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
        shoppingDayOfWeek: 6,
      },
    });
    fallbackCycleId = `batch4-fallback-${run}`;
    const fallbackStart = new Date('2026-11-01T16:00:00.000Z');
    await prisma.mealPlanCycle.create({
      data: {
        id: fallbackCycleId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: fallbackStart,
        endDate: new Date(fallbackStart.getTime() + 6 * 86_400_000),
        preparationOpensAt: new Date(fallbackStart.getTime() - 4 * 86_400_000),
        shoppingDeadlineAt: new Date(fallbackStart.getTime() - 86_400_000),
        expectedSlotCount: 21,
        status: MealPlanCycleStatus.UNDER_REVIEW,
        snapshot: {
          create: {
            userId: user.id,
            profileRevision: 0,
            safetyRevision: 0,
            weightKg: 70,
            activityLevel: 'LIGHTLY_ACTIVE',
            goal: 'MAINTAIN',
            dailyCalorieTarget: 2000,
            dailyMacroTargets: { proteinG: 120, carbsG: 230, fatG: 67 },
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            ricePreferenceProvenance: 'DEFAULTED',
            planningGeographyLevel: 'NATIONAL',
            mealLocalityPreference: 'NATIONAL',
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    const fallbackTarget = await prisma.mealPlan.create({
      data: {
        planGroupId: fallbackCycleId,
        userId: user.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: 'Rejected candidate awaiting certified fallback',
        calories: 500,
        proteinG: 20,
        carbsG: 60,
        fatG: 18,
        scheduledDate: fallbackStart,
      },
    });
    const fallback = await CertifiedSlotFallbackService.replaceWithBestCertified({
      mealPlanId: fallbackTarget.id,
      tolerance: 0.3,
      reasonCode: 'BATCH4_ACCEPTANCE',
      expectedStatus: MealPlanStatus.PENDING_REVIEW,
    });
    assert.equal(fallback.replaced, true);
    assert.ok(fallback.replacementPlanId);
    fallbackReplacementId = fallback.replacementPlanId;
    const [superseded, replacement] = await Promise.all([
      prisma.mealPlan.findUniqueOrThrow({ where: { id: fallbackTarget.id } }),
      prisma.mealPlan.findUniqueOrThrow({ where: { id: fallback.replacementPlanId! } }),
    ]);
    fallbackLibraryMealId = replacement.libraryMealId;
    assert.equal(superseded.status, MealPlanStatus.CANCELLED);
    assert.equal(superseded.supersededByMealPlanId, replacement.id);
    assert.equal(replacement.status, MealPlanStatus.APPROVED);
    assert.equal(replacement.candidateProvenance, 'CERTIFIED_LIBRARY');

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('MealPlan', 'MealPlanCycle')
        AND column_name IN (
          'reviewWorkKey', 'candidateRank', 'rankingScore', 'rankingReasonCodes',
          'fallbackAvailable', 'supersededByMealPlanId', 'preparationPolicyVersion',
          'assuranceTier', 'preparationTriggeredAt'
        )
    `;
    assert.equal(columns.length, 9);

    console.log(
      JSON.stringify(
        {
          migrationColumns: columns.map((item) => item.column_name).sort(),
          unresolvedPendingSlot: 'CANCELLED',
          cycleAtDeadline: reconciled?.status,
          groceryPublication: 'BLOCKED',
          readinessBeforeGrocery: beforeGrocery.status,
          readinessAfterGrocery: afterGrocery.status,
          certifiedFallbackSupersession: 'PASS',
          deadlineAudit: 'PASS',
        },
        null,
        2
      )
    );
  } finally {
    if (cycleId) {
      await prisma.auditEvent.deleteMany({ where: { entityType: 'MealPlanCycle', entityId: cycleId } });
    }
    if (fallbackReplacementId) {
      await prisma.auditEvent.deleteMany({ where: { entityType: 'MealPlan', entityId: fallbackReplacementId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (fallbackLibraryMealId) {
      await prisma.mealLibrary.updateMany({
        where: { id: fallbackLibraryMealId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
    if (libraryMealId) await prisma.mealLibrary.deleteMany({ where: { id: libraryMealId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
