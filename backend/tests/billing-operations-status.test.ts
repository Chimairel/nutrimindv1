import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  BillingOperationsRepository,
  BillingOperationsStatusService,
} from '../src/services/billing-operations-status.service';

const NOW = new Date('2026-09-06T12:00:00.000Z');

test('[TEST-124] admin billing status is aggregate, bounded, and privacy allowlisted', async () => {
  let recentSinceMs = 0;
  const repository: BillingOperationsRepository = {
    async readCounts(since) {
      recentSinceMs = since.getTime();
      return {
        pending: 4,
        processing: 2,
        failed: 5,
        retryable: 3,
        deadLetter: 2,
        recentSucceeded: 7,
        recentFailed: 1,
        openReconciliationIssues: 2,
        oldestPendingCreatedAt: new Date('2026-09-06T11:57:30.000Z'),
      };
    },
  };
  const service = new BillingOperationsStatusService(
    repository,
    () => ({
      enabled: true,
      lifecycle: 'IDLE',
      lastRunStartedAt: '2026-09-06T11:59:00.000Z',
      lastRunCompletedAt: '2026-09-06T11:59:01.000Z',
      lastRun: {
        outcome: 'COMPLETED',
        attempted: 3,
        succeeded: 2,
        replayed: 0,
        retryScheduled: 1,
        quarantined: 0,
        providerCallBudgetUpperBound: 3,
      },
    }),
    () => NOW
  );
  const status = await service.getStatus();
  assert.equal(new Date(recentSinceMs).toISOString(), '2026-09-05T12:00:00.000Z');
  assert.equal(status.queue.oldestPendingAgeSeconds, 150);
  assert.deepEqual(Object.keys(status).sort(), [
    'environment',
    'observedAt',
    'openReconciliationIssues',
    'queue',
    'recent',
    'worker',
  ]);
  assert.deepEqual(Object.keys(status.queue).sort(), [
    'deadLetter',
    'failed',
    'oldestPendingAgeSeconds',
    'pending',
    'processing',
    'retryable',
  ]);
  assert.doesNotMatch(JSON.stringify(status), /payload|secret|paymentId|card|userId|health|ledger/i);
});

test('[TEST-124] future-skewed or absent pending timestamps never produce unsafe ages', async () => {
  for (const oldestPendingCreatedAt of [new Date('2026-09-07T00:00:00Z'), null]) {
    const service = new BillingOperationsStatusService(
      {
        async readCounts() {
          return {
            pending: 0,
            processing: 0,
            failed: 0,
            retryable: 0,
            deadLetter: 0,
            recentSucceeded: 0,
            recentFailed: 0,
            openReconciliationIssues: 0,
            oldestPendingCreatedAt,
          };
        },
      },
      () => ({
        enabled: false,
        lifecycle: 'STOPPED',
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        lastRun: null,
      }),
      () => NOW
    );
    const status = await service.getStatus();
    assert.equal(status.queue.oldestPendingAgeSeconds, oldestPendingCreatedAt ? 0 : null);
  }
});

test('[TEST-125] billing operations route remains behind global authentication and ADMIN role checks', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'routes', 'admin.routes.ts'), 'utf8');
  const authentication = source.indexOf('router.use(authenticate)');
  const authorization = source.indexOf("router.use(requireRole('ADMIN'))");
  const billingStatus = source.indexOf("router.get('/billing-operations'");
  assert.ok(authentication >= 0);
  assert.ok(authorization > authentication);
  assert.ok(billingStatus > authorization);
  assert.doesNotMatch(source.slice(billingStatus), /sanitizedPayload|providerResourceId|billingSubjectKey|userId/);
});
