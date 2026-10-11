import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundTaskLoop } from '../src/lib/background-task-loop';
import {
  mealWorkerDelay,
  MEAL_WORKER_ACTIVE_DELAY_MS,
  MEAL_WORKER_IDLE_DELAY_MS,
} from '../src/domain/meal-worker-scheduling.policy';

const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test('empty workers sleep, explicit requests wake immediately, and stop clears pending timers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const loop = new BackgroundTaskLoop(
    async () => {
      calls++;
      return MEAL_WORKER_IDLE_DELAY_MS;
    },
    MEAL_WORKER_IDLE_DELAY_MS,
    () => assert.fail('unexpected task error')
  );
  t.after(() => loop.stop());
  loop.wake();
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 1);
  t.mock.timers.tick(5 * 60_000);
  await settle();
  assert.equal(calls, 1);
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 2);
  await loop.stop();
  t.mock.timers.tick(MEAL_WORKER_IDLE_DELAY_MS * 2);
  await settle();
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 2);
});

test('active turns retain 30-second pacing and wake-ups never overlap a running task', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let finish!: (delay: number) => void;
  const loop = new BackgroundTaskLoop(
    () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    MEAL_WORKER_IDLE_DELAY_MS,
    () => assert.fail('unexpected error')
  );
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  loop.wake();
  loop.wake();
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(calls, 1);
  finish(MEAL_WORKER_ACTIVE_DELAY_MS);
  await settle();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 2);
  finish(MEAL_WORKER_ACTIVE_DELAY_MS);
  await settle();
  t.mock.timers.tick(29_999);
  await settle();
  assert.equal(calls, 2);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(calls, 3);
  const stopped = loop.stop();
  finish(MEAL_WORKER_ACTIVE_DELAY_MS);
  await stopped;
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(calls, 3);
});

test('errors wait before retrying and an explicit wake can recover sooner', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let failures = 0;
  const loop = new BackgroundTaskLoop(
    async () => {
      calls++;
      throw new Error('Synthetic outage');
    },
    MEAL_WORKER_IDLE_DELAY_MS,
    () => {
      failures++;
    }
  );
  t.after(() => loop.stop());
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  t.mock.timers.tick(30_000);
  await settle();
  assert.equal(calls, 1);
  loop.wake();
  t.mock.timers.tick(0);
  await settle();
  assert.equal(calls, 2);
  t.mock.timers.tick(MEAL_WORKER_IDLE_DELAY_MS);
  await settle();
  assert.equal(calls, 3);
  assert.equal(failures, 3);
});

test('known job retry times remain bounded while an empty queue allows scale-to-zero', () => {
  const now = new Date('2026-10-11T04:00:00Z');
  assert.equal(mealWorkerDelay(true, null, now), 30_000);
  assert.equal(mealWorkerDelay(false, null, now), 15 * 60_000);
  assert.equal(mealWorkerDelay(false, new Date(now.getTime() + 120_000), now), 120_000);
  assert.equal(mealWorkerDelay(false, new Date(now.getTime() + 60 * 60_000), now), 15 * 60_000);
  assert.equal(mealWorkerDelay(false, new Date(now.getTime() - 1), now), 30_000);
});
