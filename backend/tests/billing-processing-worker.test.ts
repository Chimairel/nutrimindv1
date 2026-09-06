import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBillingProcessingWorkerConfig } from '../src/domain/billing-processing-worker.policy';
import { loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import {
  BillingProcessingWorker,
  PaymentProjectionProcessor,
} from '../src/services/billing-processing-worker.service';

const enabledConfig = {
  enabled: true,
  environment: 'TEST',
  pollIntervalMs: 10_000,
  batchSize: 10,
  concurrency: 3,
  providerCallBudget: 4,
  jitterMs: 1_000,
} as const;

function enabledPaymongoConfig() {
  return loadPaymongoConfig({
    NODE_ENV: 'test',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_WEBHOOK_ENABLED: 'true',
    PAYMONGO_WEBHOOK_SECRET: `whsk_${'w'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET_VERSION: 'test-v1',
    PAYMONGO_RECONCILIATION_ENABLED: 'true',
    PAYMONGO_SECRET_KEY: `sk_test_${'r'.repeat(24)}`,
  });
}

function projection(replayed = false) {
  return {
    subscriptionId: 'subscription', invoiceId: 'invoice', paymentAttemptId: 'attempt',
    transactionId: 'transaction', entitlementGrantId: 'grant',
    effectiveFrom: new Date('2026-09-06T00:00:00Z'),
    effectiveUntil: new Date('2026-10-06T00:00:00Z'), replayed,
  };
}

test('[TEST-118] worker defaults disabled and ignores inactive tuning values', () => {
  const config = loadBillingProcessingWorkerConfig({
    BILLING_PROCESSING_WORKER_ENABLED: 'false',
    BILLING_PROCESSING_WORKER_BATCH_SIZE: 'private-stale-value',
  }, loadPaymongoConfig({}));
  assert.deepEqual(config, { enabled: false });
});

test('[TEST-118] enabled worker requires TEST webhook and reconciliation and rejects production', () => {
  const base = { BILLING_PROCESSING_WORKER_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST', NODE_ENV: 'test' };
  assert.throws(
    () => loadBillingProcessingWorkerConfig(base, loadPaymongoConfig({})),
    /PAYMONGO_WEBHOOK_ENABLED.*PAYMONGO_RECONCILIATION_ENABLED/,
  );
  assert.throws(
    () => loadBillingProcessingWorkerConfig({ ...base, NODE_ENV: 'production' }, enabledPaymongoConfig()),
    /BILLING_PROCESSING_WORKER_ENABLED/,
  );
});

test('[TEST-118] worker tuning is bounded and internally consistent', () => {
  const paymongo = enabledPaymongoConfig();
  assert.throws(() => loadBillingProcessingWorkerConfig({
    BILLING_PROCESSING_WORKER_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST', NODE_ENV: 'test',
    BILLING_PROCESSING_WORKER_CONCURRENCY: '9',
  }, paymongo), /BILLING_PROCESSING_WORKER_CONCURRENCY/);
  assert.throws(() => loadBillingProcessingWorkerConfig({
    BILLING_PROCESSING_WORKER_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST', NODE_ENV: 'test',
    BILLING_PROCESSING_WORKER_BATCH_SIZE: '2', BILLING_PROCESSING_WORKER_PROVIDER_CALL_BUDGET: '3',
  }, paymongo), /BILLING_PROCESSING_WORKER_PROVIDER_CALL_BUDGET/);
  assert.equal(loadBillingProcessingWorkerConfig({
    BILLING_PROCESSING_WORKER_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST', NODE_ENV: 'test',
  }, paymongo).enabled, true);
});

test('[TEST-119] disabled startup creates no timer and performs no work', async () => {
  let scheduled = 0;
  let calls = 0;
  const worker = new BillingProcessingWorker(
    { enabled: false },
    { async processNext() { calls += 1; return { decision: 'NO_WORK' }; } },
    { schedule() { scheduled += 1; return 1; }, cancel() {} },
  );
  assert.equal(worker.start(), false);
  assert.deepEqual(await worker.runOnce(), {
    outcome: 'SKIPPED_DISABLED', attempted: 0, succeeded: 0, replayed: 0,
    retryScheduled: 0, quarantined: 0, providerCallBudgetUpperBound: 0,
  });
  assert.equal(scheduled, 0);
  assert.equal(calls, 0);
});

test('[TEST-119] one process cannot overlap ticks', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const processor: PaymentProjectionProcessor = {
    async processNext() {
      calls += 1;
      await gate;
      return { decision: 'NO_WORK' };
    },
  };
  const worker = new BillingProcessingWorker(enabledConfig, processor);
  const first = worker.runOnce();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await worker.runOnce()).outcome, 'SKIPPED_OVERLAP');
  release();
  assert.equal((await first).outcome, 'COMPLETED');
  assert.equal(calls, enabledConfig.concurrency);
});

test('[TEST-120] batch and provider-call budget bound concurrent processing', async () => {
  let calls = 0;
  let active = 0;
  let maximumActive = 0;
  const processor: PaymentProjectionProcessor = {
    async processNext() {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return { decision: 'SUCCEEDED', projection: projection(calls === 2) };
    },
  };
  const result = await new BillingProcessingWorker(enabledConfig, processor).runOnce();
  assert.equal(calls, 4);
  assert.equal(maximumActive, 3);
  assert.equal(result.attempted, 4);
  assert.equal(result.succeeded, 4);
  assert.equal(result.providerCallBudgetUpperBound, 4);
});

test('[TEST-120] independent workers consume a shared durable-style queue once', async () => {
  let remaining = 6;
  let claims = 0;
  const processor: PaymentProjectionProcessor = {
    async processNext() {
      const claimed = remaining > 0;
      if (claimed) {
        remaining -= 1;
        claims += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return { decision: 'SUCCEEDED', projection: projection() };
      }
      return { decision: 'NO_WORK' };
    },
  };
  const config = { ...enabledConfig, providerCallBudget: 10 };
  const [left, right] = await Promise.all([
    new BillingProcessingWorker(config, processor).runOnce(),
    new BillingProcessingWorker(config, processor).runOnce(),
  ]);
  assert.equal(claims, 6);
  assert.equal(left.succeeded + right.succeeded, 6);
});

test('[TEST-121] outcomes distinguish retry, terminal quarantine, and replay', async () => {
  const results = [
    { decision: 'RETRY_SCHEDULED', code: 'PROVIDER_TEMPORARILY_UNAVAILABLE' } as const,
    { decision: 'QUARANTINED', code: 'PROVIDER_RESPONSE_INVALID' } as const,
    { decision: 'SUCCEEDED', projection: projection(true) } as const,
    { decision: 'NO_WORK' } as const,
  ];
  const result = await new BillingProcessingWorker(enabledConfig, {
    async processNext() { return results.shift() || { decision: 'NO_WORK' }; },
  }).runOnce();
  assert.equal(result.retryScheduled, 1);
  assert.equal(result.quarantined, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.replayed, 1);
});

test('[TEST-122] shutdown aborts an active run and leaves no scheduled timer', async () => {
  let scheduledCallback: (() => void) | null = null;
  let cancelled = 0;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const worker = new BillingProcessingWorker(enabledConfig, {
    async processNext(signal) {
      entered();
      await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
      return { decision: 'NO_WORK' };
    },
  }, {
    schedule(callback) {
      scheduledCallback = () => {
        scheduledCallback = null;
        callback();
      };
      return 1;
    },
    cancel() { cancelled += 1; scheduledCallback = null; },
  });
  assert.equal(worker.start(), true);
  (scheduledCallback as (() => void) | null)?.();
  await started;
  await worker.stop();
  assert.equal(worker.snapshot().lifecycle, 'STOPPED');
  assert.equal(worker.snapshot().lastRun?.outcome, 'ABORTED');
  assert.equal(scheduledCallback, null);
  assert.equal(cancelled, 0);
});

test('[TEST-123] worker logs contain fixed summaries and discard thrown private details', async () => {
  const records: unknown[] = [];
  const worker = new BillingProcessingWorker(enabledConfig, {
    async processNext() { throw new Error('sk_test_private card health payload'); },
  }, undefined, {
    info(record) { records.push(record); },
    error(record) { records.push(record); },
  });
  assert.equal((await worker.runOnce()).outcome, 'FAILED');
  const serialized = JSON.stringify(records);
  assert.match(serialized, /BILLING_WORKER_TICK_FAILED/);
  assert.doesNotMatch(serialized, /sk_test_private|card|health payload/);
});

test('[TEST-123] scheduler adds deterministic jitter and backs off after infrastructure failure', async () => {
  const delays: number[] = [];
  const callbacks: Array<() => void> = [];
  let failureLogged!: () => void;
  const logged = new Promise<void>((resolve) => { failureLogged = resolve; });
  const worker = new BillingProcessingWorker(enabledConfig, {
    async processNext() { throw new Error('database unavailable'); },
  }, {
    schedule(callback, delay) { callbacks.push(callback); delays.push(delay); return callbacks.length; },
    cancel() {},
  }, {
    info() {},
    error() { failureLogged(); },
  }, () => new Date('2026-09-06T12:00:00Z'), () => 0.5);
  worker.start();
  assert.deepEqual(delays, [0]);
  callbacks.shift()?.();
  await logged;
  while (delays.length < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delays[1], 20_500);
  await worker.stop();
});
