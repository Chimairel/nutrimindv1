import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { CronService } from '../src/services/cron.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { UserSafetyRecheckService } from '../src/services/user-safety-recheck.service';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.BATCH10_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Scheduled-preparation acceptance requires a disposable loopback database.');
  }
  assert.equal(await prisma.user.count(), 0, 'This pagination acceptance requires an empty disposable database.');

  const marker = randomUUID();
  const now = new Date('2026-09-23T15:59:00.000Z');
  const seen: string[] = [];
  const originalEnsure = UpcomingPlanPreparationService.ensureForUser;
  const originalRecheck = UserSafetyRecheckService.runSafetyRecheck;
  try {
    await prisma.user.createMany({
      data: Array.from({ length: 205 }, (_, index) => ({
        name: 'Batch 10 Scheduled Fixture',
        email: `batch10-scheduled-${marker}-${index}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
      })),
    });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `batch10-scheduled-${marker}-` } },
      select: { id: true },
    });
    assert.equal(users.length, 205);
    await prisma.nutritionReport.createMany({
      data: users.map(({ id }) => ({
        userId: id,
        acknowledgedAt: now,
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic scheduled-scan fixture.',
        basedOnConditions: [],
        basedOnAllergies: [],
      })),
    });

    UpcomingPlanPreparationService.ensureForUser = async (userId, receivedNow) => {
      assert.equal(receivedNow.getTime(), now.getTime());
      seen.push(userId);
      return { state: 'NOT_OPEN', planGroupId: null };
    };
    const result = await UpcomingPlanPreparationService.runScheduled(now);
    assert.deepEqual(result, { scanned: 205, prepared: 0, existing: 0, notOpen: 205, failed: 0 });
    assert.equal(new Set(seen).size, 205, 'Every eligible account should be visited exactly once.');
    assert.deepEqual(new Set(seen), new Set(users.map((user) => user.id)));
    console.log('[Batch 10 scheduled preparation] PASS: all 205 users visited once across bounded pages');

    UpcomingPlanPreparationService.ensureForUser = originalEnsure;
    await prisma.user.deleteMany({ where: { email: { startsWith: `batch10-scheduled-${marker}-` } } });

    const cronUser = await prisma.user.create({
      data: {
        name: 'Batch 10 Manila Boundary Fixture',
        email: `batch10-cron-${marker}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
        onboardingDone: true,
        userProfile: { create: { dailyCalorieTarget: 2000 } },
        mealLogs: {
          create: [
            {
              source: 'USER_LOGGED',
              mealName: 'Before midnight',
              dataSource: 'USER_REPORTED',
              status: 'DONE',
              calories: 400,
              proteinG: 20,
              carbsG: 50,
              fatG: 10,
              loggedAt: new Date('2026-09-23T15:59:00.000Z'),
            },
            {
              source: 'USER_LOGGED',
              mealName: 'After midnight',
              dataSource: 'USER_REPORTED',
              status: 'DONE',
              calories: 600,
              proteinG: 30,
              carbsG: 70,
              fatG: 20,
              loggedAt: new Date('2026-09-23T16:00:00.000Z'),
            },
          ],
        },
      },
    });
    const beforeBoundary = await CronService.runDailyCheckin(new Date('2026-09-24T15:59:00.000Z'));
    assert.equal(beforeBoundary.processedCount, 1);
    const afterBoundary = await CronService.runDailyCheckin(new Date('2026-09-24T16:01:00.000Z'));
    assert.equal(afterBoundary.processedCount, 1);
    await CronService.runDailyCheckin(new Date('2026-09-24T16:01:00.000Z'));
    const dailyLogs = await prisma.dailyNutritionLog.findMany({
      where: { userId: cronUser.id },
      orderBy: { logDate: 'asc' },
    });
    assert.equal(dailyLogs.length, 2, 'A rerun must update, not duplicate, the Manila-day aggregate.');
    assert.deepEqual(
      dailyLogs.map(({ logDate, totalCalories }) => [logDate.toISOString(), totalCalories]),
      [
        ['2026-09-22T16:00:00.000Z', 400],
        ['2026-09-23T16:00:00.000Z', 600],
      ]
    );
    console.log('[Batch 10 daily check-in] PASS: Manila midnight boundary and idempotent rerun');

    await prisma.user.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        name: 'Batch 10 Safety Retry Fixture',
        email: `batch10-recheck-${marker}-${index}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
      })),
    });
    const pendingUsers = await prisma.user.findMany({
      where: { email: { startsWith: `batch10-recheck-${marker}-` } },
      select: { id: true },
    });
    assert.equal(pendingUsers.length, 55);
    const scheduledDate = new Date('2026-09-24T16:00:00.000Z');
    const cycles = pendingUsers.map(({ id }) => ({
      id: `batch10-recheck-${id}`,
      userId: id,
      planType: 'STARTER' as const,
      startDate: scheduledDate,
      endDate: scheduledDate,
      preparationOpensAt: scheduledDate,
      shoppingDeadlineAt: scheduledDate,
      expectedSlotCount: 1,
    }));
    await prisma.mealPlanCycle.createMany({ data: cycles });
    await prisma.mealPlan.createMany({
      data: cycles.map((cycle) => ({
        planGroupId: cycle.id,
        userId: cycle.userId,
        status: 'PENDING_REVIEW' as const,
        mealType: 'BREAKFAST' as const,
        mealName: 'Safety retry fixture',
        calories: 400,
        proteinG: 20,
        carbsG: 50,
        fatG: 10,
        planType: 'STARTER' as const,
        scheduledDate,
        requiresSafetyRevalidation: true,
      })),
    });
    const rechecked: string[] = [];
    UserSafetyRecheckService.runSafetyRecheck = (async (userId: string) => {
      rechecked.push(userId);
    }) as typeof UserSafetyRecheckService.runSafetyRecheck;
    await CronService.retrySafetyRevalidation(new Date('2026-09-24T16:01:00.000Z'));
    assert.equal(rechecked.length, 55);
    assert.deepEqual(new Set(rechecked), new Set(pendingUsers.map((user) => user.id)));
    console.log('[Batch 10 safety retry] PASS: all 55 affected users visited across bounded pages');
  } finally {
    UpcomingPlanPreparationService.ensureForUser = originalEnsure;
    UserSafetyRecheckService.runSafetyRecheck = originalRecheck;
    await prisma.user.deleteMany({ where: { email: { startsWith: `batch10-scheduled-${marker}-` } } });
    await prisma.user.deleteMany({ where: { email: `batch10-cron-${marker}@example.invalid` } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `batch10-recheck-${marker}-` } } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[Batch 10 scheduled preparation] FAIL', error);
  process.exitCode = 1;
});
