import assert from 'node:assert/strict';
import { test } from 'node:test';
import prisma from '../src/lib/prisma';
import { MealAiQueueService } from '../src/services/meal-ai-queue.service';

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
test('the preparation service starts once, sleeps on no work, and uses explicit wake for new work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousRun = MealAiQueueService.runOne;
  const previousRead = prisma.mealPlanGenerationJob.findFirst;
  let calls = 0;
  let futureReads = 0;
  let worked = false;
  MealAiQueueService.runOne = async () => {
    calls++;
    return worked;
  };
  prisma.mealPlanGenerationJob.findFirst = (async () => {
    futureReads++;
    return null;
  }) as typeof previousRead;
  t.after(async () => {
    await MealAiQueueService.shutdown();
    MealAiQueueService.runOne = previousRun;
    prisma.mealPlanGenerationJob.findFirst = previousRead;
  });
  MealAiQueueService.startWorker();
  MealAiQueueService.startWorker();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 1);
  assert.equal(futureReads, 1);
  t.mock.timers.tick(30_000);
  await settle();
  assert.equal(calls, 1);
  worked = true;
  MealAiQueueService.triggerNonBlocking();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 2);
  assert.equal(futureReads, 1);
  t.mock.timers.tick(30_000);
  await settle();
  assert.equal(calls, 3);
  await MealAiQueueService.shutdown();
  t.mock.timers.tick(30 * 60_000);
  await settle();
  assert.equal(calls, 3);
});
