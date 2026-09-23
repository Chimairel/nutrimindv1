import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MealPlanCycleStatus, PrismaClient } from '@prisma/client';
import { UserPrivacyService } from '../src/services/user-privacy.service';
import { createFixturePlanCycle } from './helpers/plan-cycle-fixture';

const prisma = new PrismaClient();

async function cleanupStaleFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'account-deletion-' } },
    select: { id: true, mealPlans: { select: { id: true } }, scopedConditionClearances: { select: { id: true } } },
  });
  const userIds = users.map(({ id }) => id);
  const mealPlanIds = users.flatMap(({ mealPlans }) => mealPlans.map(({ id }) => id));
  const clearanceIds = users.flatMap(({ scopedConditionClearances }) => scopedConditionClearances.map(({ id }) => id));
  if (clearanceIds.length) {
    await prisma.mealPlanClearanceUsage.deleteMany({ where: { clearanceId: { in: clearanceIds } } });
    await prisma.mealConditionClearanceDecision.deleteMany({ where: { clearanceId: { in: clearanceIds } } });
    await prisma.mealConditionClearance.deleteMany({ where: { id: { in: clearanceIds } } });
  }
  if (mealPlanIds.length) {
    await prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlanId: { in: mealPlanIds } } });
  }
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.auditEvent.deleteMany({
    where: { action: 'USER_SELF_DELETION', entityId: { in: userIds } },
  });
  await prisma.mealLibrary.deleteMany({ where: { mealName: { startsWith: 'Shared deletion fixture ' } } });
}

async function main() {
  await cleanupStaleFixtures();
  const marker = randomUUID();
  const email = `account-deletion-${marker}@example.test`;
  const password = `Delete-${marker}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const nutritionist = await prisma.nutritionistProfile.findFirstOrThrow({
    where: { isVerified: true },
    orderBy: { id: 'asc' },
  });
  const libraryMeal = await prisma.mealLibrary.create({
    data: {
      mealName: `Shared deletion fixture ${marker}`,
      mealType: 'LUNCH',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      recipeSignature: marker.replaceAll('-', ''),
      safetyEvidenceRevision: 1,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Disposable deletion fixture',
      email,
      passwordHash,
      role: 'USER',
      emailVerified: true,
      sessions: {
        create: {
          sessionToken: `account-deletion-${marker}`,
          expires: new Date(Date.now() + 60_000),
        },
      },
      userProfile: { create: {} },
      waterLogs: { create: { amountMl: 250 } },
    },
  });

  const planGroupId = `account-deletion-${marker}`;
  await createFixturePlanCycle(prisma, {
    id: planGroupId,
    userId: user.id,
    status: MealPlanCycleStatus.ACTIVE,
  });
  await prisma.groceryList.create({
    data: { userId: user.id, planGroupId, weekLabel: 'Disposable fixture' },
  });

  const plan = await prisma.mealPlan.create({
    data: {
      planGroupId,
      userId: user.id,
      libraryMealId: libraryMeal.id,
      status: 'APPROVED',
      mealType: libraryMeal.mealType,
      mealName: libraryMeal.mealName,
      calories: libraryMeal.calories,
      proteinG: libraryMeal.proteinG,
      carbsG: libraryMeal.carbsG,
      fatG: libraryMeal.fatG,
      scheduledDate: new Date(),
      reviewedAt: new Date(),
      requiresSafetyRevalidation: false,
      candidateProvenance: 'CERTIFIED_LIBRARY',
    },
  });
  await prisma.mealPlanReviewDecision.create({
    data: {
      mealPlanId: plan.id,
      nutritionistProfileId: nutritionist.id,
      stage: 'PRIMARY',
      decision: 'APPROVE',
      rationale: 'Disposable account deletion acceptance fixture.',
      evidenceSnapshot: { fixture: true },
    },
  });

  const clearance = await prisma.mealConditionClearance.create({
    data: {
      mealLibraryId: libraryMeal.id,
      userScopeId: user.id,
      condition: 'HYPERTENSION',
      recipeSignature: libraryMeal.recipeSignature!,
      evidenceRevision: libraryMeal.safetyEvidenceRevision,
      assuranceTier: 'STANDARD',
      provenance: 'MANUAL_REVIEW',
      state: 'ACTIVE',
      evidenceSnapshot: { fixture: true },
      activatedAt: new Date(),
    },
  });
  await prisma.mealConditionClearanceDecision.create({
    data: {
      clearanceId: clearance.id,
      nutritionistProfileId: nutritionist.id,
      stage: 'PRIMARY',
      decision: 'APPROVE',
      rationale: 'Disposable account deletion acceptance fixture.',
      evidenceSnapshot: { fixture: true },
    },
  });
  await prisma.mealPlanClearanceUsage.create({
    data: {
      mealPlanId: plan.id,
      clearanceId: clearance.id,
      condition: 'HYPERTENSION',
    },
  });

  const sharedMealCountBefore = await prisma.mealLibrary.count({ where: { id: libraryMeal.id } });
  await UserPrivacyService.deleteAccount(user.id, { password });

  const [
    deletedUser,
    sessionCount,
    cycleCount,
    planCount,
    clearanceCount,
    reviewCount,
    decisionCount,
    waterCount,
    groceryCount,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.session.count({ where: { userId: user.id } }),
    prisma.mealPlanCycle.count({ where: { userId: user.id } }),
    prisma.mealPlan.count({ where: { userId: user.id } }),
    prisma.mealConditionClearance.count({ where: { userScopeId: user.id } }),
    prisma.mealPlanReviewDecision.count({ where: { mealPlanId: plan.id } }),
    prisma.mealConditionClearanceDecision.count({ where: { clearanceId: clearance.id } }),
    prisma.waterLog.count({ where: { userId: user.id } }),
    prisma.groceryList.count({ where: { userId: user.id } }),
  ]);
  const deletionAudit = await prisma.auditEvent.findFirst({
    where: { action: 'USER_SELF_DELETION', entityId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  const sharedMealCountAfter = await prisma.mealLibrary.count({ where: { id: libraryMeal.id } });

  assert.equal(deletedUser, null);
  assert.deepEqual(
    { sessionCount, cycleCount, planCount, clearanceCount, reviewCount, decisionCount, waterCount, groceryCount },
    {
      sessionCount: 0,
      cycleCount: 0,
      planCount: 0,
      clearanceCount: 0,
      reviewCount: 0,
      decisionCount: 0,
      waterCount: 0,
      groceryCount: 0,
    }
  );
  assert.equal(sharedMealCountBefore, 1);
  assert.equal(sharedMealCountAfter, 1);
  assert.ok(deletionAudit);
  assert.equal(deletionAudit.actorUserId, null);

  console.log(
    JSON.stringify(
      {
        pass: true,
        deletedPatientOwnedRecords: true,
        deletedPlanCycleRoot: true,
        restrictiveReviewLinksHandled: true,
        sharedMealPreserved: true,
        deletionAuditPreservedAndDeidentified: true,
      },
      null,
      2
    )
  );

  await prisma.auditEvent.deleteMany({ where: { action: 'USER_SELF_DELETION', entityId: user.id } });
  await prisma.mealLibrary.delete({ where: { id: libraryMeal.id } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
