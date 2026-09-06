import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveWeeklySwap, SwapLimitReachedError } from '../src/services/meal-swap.service';

function trackerClient(initial: { id: string; userId: string; swapsUsed: number }) {
  const state = { ...initial };
  return {
    state,
    client: {
      planSwapTracker: {
        async updateMany(input: any) {
          if (state.id !== input.where.id || state.userId !== input.where.userId || state.swapsUsed >= input.where.swapsUsed.lt) {
            return { count: 0 };
          }
          state.swapsUsed += input.data.swapsUsed.increment;
          return { count: 1 };
        },
        async findUniqueOrThrow(input: any) {
          if (input.where.id !== state.id) throw new Error('missing');
          return { swapsUsed: state.swapsUsed };
        },
      },
    },
  };
}

test('[TEST-112] atomic reservation enforces the Free cap under concurrent attempts', async () => {
  const fake = trackerClient({ id: 'tracker_1', userId: 'owner_1', swapsUsed: 0 });
  const results = await Promise.allSettled(Array.from({ length: 10 }, () =>
    reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_1', userId: 'owner_1', cap: 3 }),
  ));
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 3);
  assert.equal(results.filter((item) => item.status === 'rejected').length, 7);
  assert.equal(fake.state.swapsUsed, 3);
  for (const result of results.filter((item): item is PromiseRejectedResult => item.status === 'rejected')) {
    assert.ok(result.reason instanceof SwapLimitReachedError);
    assert.equal(result.reason.cap, 3);
  }
});

test('[TEST-113] atomic reservation permits Premium through six and is owner-scoped', async () => {
  const fake = trackerClient({ id: 'tracker_2', userId: 'owner_1', swapsUsed: 3 });
  assert.equal(await reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_2', userId: 'owner_1', cap: 6 }), 4);
  assert.equal(await reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_2', userId: 'owner_1', cap: 6 }), 5);
  assert.equal(await reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_2', userId: 'owner_1', cap: 6 }), 6);
  await assert.rejects(
    () => reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_2', userId: 'owner_1', cap: 6 }),
    (error: unknown) => error instanceof SwapLimitReachedError && error.cap === 6,
  );
  await assert.rejects(
    () => reserveWeeklySwap(fake.client as any, { trackerId: 'tracker_2', userId: 'other_user', cap: 7 }),
    SwapLimitReachedError,
  );
  assert.equal(fake.state.swapsUsed, 6);
});
