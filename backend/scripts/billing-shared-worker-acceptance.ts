import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  CheckoutReconciliationGateway,
  ReconciledPaymongoCheckout,
} from '../src/billing/contracts';
import { resolveBillingEntitlement } from '../src/domain/billing-entitlement.policy';
import { loadBillingProcessingWorkerConfig } from '../src/domain/billing-processing-worker.policy';
import { loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import { BillingProcessingWorker } from '../src/services/billing-processing-worker.service';
import {
  BillingOperationsStatusService,
  PrismaBillingOperationsRepository,
} from '../src/services/billing-operations-status.service';
import { PaymongoPaymentProjectionService } from '../src/services/paymongo-payment-projection.service';
import { PrismaPaymentProjectionRepository } from '../src/services/prisma-payment-projection.repository';

dotenv.config();

const EXPECTED_TARGET_FINGERPRINT = '6f48da70b1ce';
const PREFIX = 'shared_accept_01fa0c2';
const EMAIL = `${PREFIX}@example.invalid`;
const NOW = new Date('2026-12-10T00:00:00.000Z');
const ROLLBACK = Symbol('ROLLBACK_SHARED_ACCEPTANCE');
const BILLING_TABLES = [
  'ProviderCustomer', 'BillingProduct', 'BillingPrice', 'UserSubscription', 'BillingInvoice',
  'PaymentAttempt', 'BillingTransaction', 'BillingRefund', 'FinancialLedgerEntry',
  'ProviderWebhookEvent', 'WebhookEventProcessing', 'BillingReconciliationIssue',
  'BillingSubscriptionCancellation', 'EntitlementGrant', 'CompensationPolicy',
  'CompensationPeriod', 'NutritionistWorkCredit', 'CompensationStatement',
  'CompensationStatementWorkCredit', 'CompensationAdjustment', 'CompensationPayout',
  'CompensationPayoutEvent', 'BillingCheckoutRequest', 'BillingCheckoutAuditEvent',
] as const;
let stage = 'START';

class AcceptanceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AcceptanceError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code: string): never {
  throw new AcceptanceError(code);
}

function validateTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail('DATABASE_URL_MISSING');
  let parsed: URL;
  try { parsed = new URL(raw); } catch { fail('DATABASE_URL_INVALID'); }
  const fingerprint = sha256(parsed.hostname.toLowerCase()).slice(0, 12);
  if (parsed.protocol !== 'postgresql:' || !parsed.hostname.endsWith('.neon.tech') ||
      parsed.searchParams.get('sslmode') !== 'require' || parsed.pathname !== '/neondb' ||
      fingerprint !== EXPECTED_TARGET_FINGERPRINT) {
    fail('SHARED_DEVELOPMENT_TARGET_MISMATCH');
  }
  const paymongo = loadPaymongoConfig(process.env);
  const worker = loadBillingProcessingWorkerConfig(process.env, paymongo);
  if (paymongo.checkout.enabled || paymongo.webhook.enabled || paymongo.reconciliation.enabled || worker.enabled) {
    fail('BILLING_CAPABILITY_MUST_REMAIN_DISABLED');
  }
  return fingerprint;
}

function transactionClientShim(transaction: Prisma.TransactionClient): PrismaClient {
  return new Proxy(transaction as unknown as PrismaClient, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async (callback: (nested: Prisma.TransactionClient) => unknown) => callback(transaction);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function checkoutEvidence(
  providerSessionId: string,
  referenceNumber: string,
  paidAt: string,
  paymentSuffix: string,
): ReconciledPaymongoCheckout {
  const paid = new Date(paidAt);
  return {
    provider: 'PAYMONGO', environment: 'TEST', livemode: false,
    providerSessionId, referenceNumber, paymentStatus: 'PAID', paymentIntentStatus: 'SUCCEEDED',
    providerPaymentIntentId: `pi_${PREFIX}_${paymentSuffix}`,
    providerPaymentId: `pay_${PREFIX}_${paymentSuffix}`,
    amountMinor: 19900, currency: 'PHP', paidAt: paid,
    providerUpdatedAt: new Date(paid.getTime() + 1_000),
  };
}

async function assertBillingTablesEmpty(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const inventory = await transaction.$queryRawUnsafe<Array<{ table_name: string; row_count: number }>>(
      BILLING_TABLES.map((tableName) =>
        `SELECT '${tableName}' AS table_name, COUNT(*)::int AS row_count FROM "public"."${tableName}"`,
      ).join(' UNION ALL '),
    );
    assert.equal(inventory.length, BILLING_TABLES.length);
    for (const row of inventory) {
      assert.equal(row.row_count, 0, `${row.table_name} must be empty`);
    }
    assert.equal(await transaction.user.count({ where: { email: EMAIL } }), 0);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}

async function main(): Promise<void> {
  stage = 'VALIDATE_TARGET';
  const targetFingerprint = validateTarget();
  const prisma = new PrismaClient();
  let syntheticGatewayReads = 0;
  let rollbackVerified = false;
  const evidenceBySession = new Map<string, ReconciledPaymongoCheckout>();
  const gateway: CheckoutReconciliationGateway = {
    async retrieveCheckoutSession(providerSessionId) {
      syntheticGatewayReads += 1;
      const evidence = evidenceBySession.get(providerSessionId);
      if (!evidence) throw new Error('SYNTHETIC_RECONCILIATION_UNAVAILABLE');
      return evidence;
    },
  };

  try {
    stage = 'VERIFY_EMPTY_BASELINE';
    await assertBillingTablesEmpty(prisma);

    stage = 'VERIFY_DISABLED_STARTUP';
    let disabledScheduled = 0;
    const disabledWorker = new BillingProcessingWorker(
      { enabled: false }, null,
      { schedule() { disabledScheduled += 1; return 1; }, cancel() {} },
      { info() {}, error() {} }, () => NOW, () => 0,
    );
    assert.equal(disabledWorker.start(), false);
    assert.equal((await disabledWorker.runOnce()).outcome, 'SKIPPED_DISABLED');
    assert.equal(disabledScheduled, 0);

    stage = 'ROLLBACK_ONLY_WORKER_EXERCISE';
    try {
      await prisma.$transaction(async (transaction) => {
        stage = 'CREATE_SYNTHETIC_FOUNDATION';
        const client = transactionClientShim(transaction);
        const productId = `${PREFIX}_product`;
        const priceId = `${PREFIX}_price`;
        const userId = `${PREFIX}_user`;
        const subjectKey = `${PREFIX}_subject`;
        stage = 'CREATE_SYNTHETIC_USER';
        await transaction.user.create({ data: {
          id: userId, name: 'Shared Billing Acceptance', email: EMAIL,
          passwordHash: 'synthetic-disabled-login', role: 'USER',
        } });
        stage = 'CREATE_SYNTHETIC_PRODUCT';
        await transaction.billingProduct.create({ data: {
          id: productId, code: 'PREMIUM', displayName: 'Synthetic Premium',
          status: 'ACTIVE', featureSetVersion: `${PREFIX}_v1`,
        } });
        stage = 'CREATE_SYNTHETIC_PRICE';
        await transaction.billingPrice.create({ data: {
          id: priceId, productId, provider: 'PAYMONGO', environment: 'TEST', currency: 'PHP',
          amountMinor: 19900, interval: 'MONTH', intervalCount: 1, version: 1, isActive: true,
        } });

        const createCheckout = async (suffix: string, sessionId: string, referenceNumber: string) => {
          await transaction.billingCheckoutRequest.create({ data: {
            id: `${PREFIX}_checkout_${suffix}`, userId, billingSubjectKey: subjectKey, billingPriceId: priceId,
            provider: 'PAYMONGO', environment: 'TEST', requestIdempotencyKey: `${PREFIX}_request_${suffix}`,
            requestHash: sha256(`${PREFIX}:checkout:${suffix}`),
            providerIdempotencyKey: `${PREFIX}_provider_${suffix}`, referenceNumber,
            status: 'SUCCEEDED', attemptCount: 1, providerSessionId: sessionId,
            checkoutUrl: `https://checkout.paymongo.com/${sessionId}`, completedAt: new Date('2026-09-06T12:00:01.000Z'),
          } });
        };
        const createEvent = async (
          suffix: string,
          sessionId: string,
          processing: Prisma.WebhookEventProcessingCreateWithoutWebhookEventInput,
          providerCreatedAt = new Date('2026-09-06T13:01:00Z'),
        ) => transaction.providerWebhookEvent.create({ data: {
          id: `${PREFIX}_event_${suffix}`, provider: 'PAYMONGO', environment: 'TEST',
          providerEventId: `${PREFIX}_provider_event_${suffix}`,
          eventType: 'checkout_session.payment.paid', livemode: false,
          payloadHash: sha256(`${PREFIX}:event:${suffix}`),
          sanitizedPayload: { schemaVersion: 1, resource: { id: sessionId, type: 'checkout_session' } },
          signatureKeyVersion: `${PREFIX}_key_v1`, providerCreatedAt,
          receivedAt: new Date(providerCreatedAt.getTime() + 1_000), processing: { create: processing },
        } });
        const makeWorker = () => {
          const processor = new PaymongoPaymentProjectionService(
            new PrismaPaymentProjectionRepository(client, () => NOW), gateway, () => NOW,
          );
          return new BillingProcessingWorker({
            enabled: true, environment: 'TEST', pollIntervalMs: 10_000,
            batchSize: 1, concurrency: 1, providerCallBudget: 1, jitterMs: 1_000,
          }, processor, undefined, { info() {}, error() {} }, () => NOW, () => 0);
        };

        stage = 'CREATE_EXPIRED_LEASE_FIXTURE';
        const sessionOne = `cs_${PREFIX}_session_one`;
        const referenceOne = `${PREFIX}_reference_one`;
        await createCheckout('one', sessionOne, referenceOne);
        await createEvent('expired', sessionOne, {
          id: `${PREFIX}_processing_expired`, handlerVersion: `${PREFIX}_stale_worker`, status: 'PROCESSING',
          attemptCount: 1, lockedAt: new Date('2026-12-09T23:00:00Z'),
          claimTokenHash: 'a'.repeat(64), claimExpiresAt: new Date('2026-12-09T23:01:00Z'),
        });
        evidenceBySession.set(sessionOne, checkoutEvidence(
          sessionOne, referenceOne, '2026-09-06T13:00:00Z', 'one',
        ));

        stage = 'READ_PREPROCESSING_OPERATIONS';
        const operationsBefore = await new BillingOperationsStatusService(
          new PrismaBillingOperationsRepository(client), () => makeWorker().snapshot(), () => NOW,
        ).getStatus();
        assert.equal(operationsBefore.queue.processing, 1);
        assert.doesNotMatch(JSON.stringify(operationsBefore), /sanitizedPayload|providerResourceId|billingSubjectKey|userId/);

        stage = 'RECOVER_EXPIRED_LEASE';
        const recovered = await makeWorker().runOnce();
        assert.equal(recovered.succeeded, 1);
        assert.equal((await transaction.webhookEventProcessing.findUniqueOrThrow({
          where: { id: `${PREFIX}_processing_expired` },
        })).attemptCount, 2);

        stage = 'PROCESS_RESTART_REPLAY';
        await createEvent('replay', sessionOne, {
          id: `${PREFIX}_processing_replay`, handlerVersion: `${PREFIX}_restart`, status: 'PENDING',
        });
        const replayed = await makeWorker().runOnce();
        assert.equal(replayed.succeeded, 1);
        assert.equal(replayed.replayed, 1);
        assert.deepEqual({
          subscriptions: await transaction.userSubscription.count(),
          invoices: await transaction.billingInvoice.count(),
          attempts: await transaction.paymentAttempt.count(),
          transactions: await transaction.billingTransaction.count(),
          ledger: await transaction.financialLedgerEntry.count(),
          grants: await transaction.entitlementGrant.count(),
        }, { subscriptions: 1, invoices: 1, attempts: 1, transactions: 1, ledger: 2, grants: 1 });

        stage = 'PROCESS_DEAD_LETTER';
        await createEvent('unknown', `cs_${PREFIX}_missing_session`, {
          id: `${PREFIX}_processing_unknown`, handlerVersion: `${PREFIX}_dead_letter`, status: 'PENDING',
        });
        const callsBeforeUnknown = syntheticGatewayReads;
        const deadLetter = await makeWorker().runOnce();
        assert.equal(deadLetter.quarantined, 1);
        assert.equal(syntheticGatewayReads, callsBeforeUnknown);
        const deadLetterRow = await transaction.webhookEventProcessing.findUniqueOrThrow({
          where: { id: `${PREFIX}_processing_unknown` },
        });
        assert.equal(deadLetterRow.status, 'FAILED');
        assert.equal(deadLetterRow.nextAttemptAt, null);

        stage = 'PROCESS_RETRY_RECOVERY';
        const sessionRetry = `cs_${PREFIX}_session_retry`;
        const referenceRetry = `${PREFIX}_reference_retry`;
        await createCheckout('retry', sessionRetry, referenceRetry);
        await createEvent('retry', sessionRetry, {
          id: `${PREFIX}_processing_retry`, handlerVersion: `${PREFIX}_retry`, status: 'PENDING',
        }, new Date('2026-10-07T13:01:00Z'));
        stage = 'SCHEDULE_RETRY';
        const retryScheduled = await makeWorker().runOnce();
        assert.equal(retryScheduled.retryScheduled, 1);
        stage = 'VERIFY_RETRY_ROW';
        const failedRetry = await transaction.webhookEventProcessing.findUniqueOrThrow({
          where: { id: `${PREFIX}_processing_retry` },
        });
        assert.equal(failedRetry.status, 'FAILED');
        assert.ok(failedRetry.nextAttemptAt);
        await transaction.webhookEventProcessing.update({
          where: { id: failedRetry.id }, data: { nextAttemptAt: new Date(NOW.getTime() - 1) },
        });
        evidenceBySession.set(sessionRetry, checkoutEvidence(
          sessionRetry, referenceRetry, '2026-10-07T13:00:00Z', 'retry',
        ));
        stage = 'RECOVER_RETRY_AFTER_RESTART';
        const retryRecovered = await makeWorker().runOnce();
        if (retryRecovered.succeeded !== 1) {
          if (retryRecovered.retryScheduled === 1) fail('RETRY_RECOVERY_RESCHEDULED');
          if (retryRecovered.quarantined === 1) fail('RETRY_RECOVERY_QUARANTINED');
          if (retryRecovered.attempted === 1) fail('RETRY_RECOVERY_NO_WORK');
          fail('RETRY_RECOVERY_WORKER_FAILED');
        }
        assert.equal(retryRecovered.succeeded, 1);

        stage = 'VERIFY_FINANCIAL_PROJECTION';
        const postings = await transaction.financialLedgerEntry.findMany();
        assert.equal(postings.length, 4);
        for (const batchKey of new Set(postings.map((row) => row.batchKey))) {
          const batch = postings.filter((row) => row.batchKey === batchKey);
          assert.equal(batch.length, 2);
          assert.equal(batch.reduce(
            (sum, row) => sum + (row.direction === 'DEBIT' ? row.amountMinor : -row.amountMinor), 0,
          ), 0);
        }
        const grants = await transaction.entitlementGrant.findMany({ orderBy: { effectiveFrom: 'asc' } });
        assert.equal(grants.length, 2);
        assert.equal(grants[0].effectiveUntil.getTime() - grants[0].effectiveFrom.getTime(), 30 * 24 * 60 * 60 * 1_000);
        assert.ok(grants[0].effectiveUntil <= grants[1].effectiveFrom);
        const firstSubscription = await transaction.userSubscription.findFirstOrThrow({
          where: { sourceCheckoutRequestId: `${PREFIX}_checkout_one` },
        });
        const firstInvoice = await transaction.billingInvoice.findUniqueOrThrow({
          where: { sourceCheckoutRequestId: `${PREFIX}_checkout_one` },
        });
        assert.equal(resolveBillingEntitlement({
          at: new Date(grants[0].effectiveUntil.getTime() - 1),
          grants: [{ ...grants[0], invoiceStatus: firstInvoice.status }],
          subscriptions: [{ id: firstSubscription.id, status: firstSubscription.status }],
        }).tier, 'PREMIUM');
        assert.equal(resolveBillingEntitlement({
          at: grants[0].effectiveUntil,
          grants: [{ ...grants[0], invoiceStatus: firstInvoice.status }],
          subscriptions: [{ id: firstSubscription.id, status: firstSubscription.status }],
        }).tier, 'FREE');

        stage = 'READ_FINAL_OPERATIONS';
        const finalWorker = makeWorker();
        const operationsAfter = await new BillingOperationsStatusService(
          new PrismaBillingOperationsRepository(client), () => finalWorker.snapshot(), () => NOW,
        ).getStatus();
        assert.equal(operationsAfter.queue.processing, 0);
        assert.equal(operationsAfter.queue.retryable, 0);
        assert.equal(operationsAfter.queue.deadLetter, 1);
        assert.equal(operationsAfter.recent.succeeded, 3);
        assert.equal(operationsAfter.openReconciliationIssues, 1);
        assert.doesNotMatch(JSON.stringify(operationsAfter),
          /sanitizedPayload|providerResourceId|billingSubjectKey|userId|example\.invalid/);

        stage = 'VERIFY_GRACEFUL_SHUTDOWN';
        let scheduled = 0;
        let cancelled = 0;
        const stoppable = new BillingProcessingWorker({
          enabled: true, environment: 'TEST', pollIntervalMs: 10_000,
          batchSize: 1, concurrency: 1, providerCallBudget: 1, jitterMs: 1_000,
        }, new PaymongoPaymentProjectionService(
          new PrismaPaymentProjectionRepository(client, () => NOW), gateway, () => NOW,
        ), {
          schedule() { scheduled += 1; return `${PREFIX}_timer`; },
          cancel() { cancelled += 1; },
        }, { info() {}, error() {} }, () => NOW, () => 0);
        assert.equal(stoppable.start(), true);
        await stoppable.stop();
        assert.equal(scheduled, 1);
        assert.equal(cancelled, 1);
        assert.equal(stoppable.snapshot().lifecycle, 'STOPPED');

        throw ROLLBACK;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 300_000 });
      fail('ROLLBACK_SENTINEL_NOT_THROWN');
    } catch (error) {
      if (error !== ROLLBACK) throw error;
      rollbackVerified = true;
    }

    stage = 'VERIFY_ZERO_RESIDUE';
    await assertBillingTablesEmpty(prisma);
    assert.equal(rollbackVerified, true);
    process.stdout.write(JSON.stringify({
      success: true,
      targetFingerprint,
      runtimeCapabilitiesDisabled: true,
      providerNetworkCalls: 0,
      syntheticGatewayReads,
      disabledStartupVerified: true,
      expiredLeaseRecoveredAfterRestart: true,
      replayWithoutDuplicateProjection: true,
      retryRecoveredAfterRestart: true,
      deadLetterVisible: true,
      balancedLedgerVerified: true,
      boundedEntitlementsVerified: true,
      privacySafeOperationsAggregateVerified: true,
      gracefulShutdownVerified: true,
      rollbackVerified,
      residueRows: 0,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const code = error instanceof AcceptanceError ? error.code : 'SHARED_WORKER_ACCEPTANCE_FAILED';
  const infrastructureCode = error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : error instanceof Prisma.PrismaClientInitializationError
      ? error.errorCode || 'PRISMA_INITIALIZATION_FAILED'
      : error instanceof Prisma.PrismaClientUnknownRequestError
        ? 'PRISMA_UNKNOWN_REQUEST_FAILED'
        : null;
  const assertion = error instanceof assert.AssertionError
    ? {
      actual: ['string', 'number', 'boolean'].includes(typeof error.actual) ? error.actual : null,
      expected: ['string', 'number', 'boolean'].includes(typeof error.expected) ? error.expected : null,
    }
    : null;
  process.stderr.write(`${JSON.stringify({ success: false, code, stage, infrastructureCode, assertion })}\n`);
  process.exitCode = 1;
});
