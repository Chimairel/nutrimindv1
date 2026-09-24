import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { CronService } from '../src/services/cron.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';

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
  } finally {
    UpcomingPlanPreparationService.ensureForUser = originalEnsure;
    await prisma.user.deleteMany({ where: { email: { startsWith: `batch10-scheduled-${marker}-` } } });
    await prisma.user.deleteMany({ where: { email: `batch10-cron-${marker}@example.invalid` } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[Batch 10 scheduled preparation] FAIL', error);
  process.exitCode = 1;
});
