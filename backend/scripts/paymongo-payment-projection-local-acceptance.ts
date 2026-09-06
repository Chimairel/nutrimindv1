import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CheckoutReconciliationGateway, ReconciledPaymongoCheckout } from '../src/billing/contracts';
import { resolveBillingEntitlement } from '../src/domain/billing-entitlement.policy';
import { PaymongoPaymentProjectionService } from '../src/services/paymongo-payment-projection.service';
import { PrismaPaymentProjectionRepository } from '../src/services/prisma-payment-projection.repository';

const database = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55447') {
  throw new Error('Local payment projection acceptance requires 127.0.0.1:55447.');
}

const prisma = new PrismaClient();
const NOW = new Date('2026-12-10T00:00:00.000Z');
const evidenceBySession = new Map<string, ReconciledPaymongoCheckout>();
let providerCalls = 0;
const gateway: CheckoutReconciliationGateway = {
  async retrieveCheckoutSession(providerSessionId) {
    providerCalls += 1;
    const evidence = evidenceBySession.get(providerSessionId);
    if (!evidence) throw new Error('synthetic missing provider fixture');
    return evidence;
  },
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function evidence(session: string, reference: string, paidAt: string, paymentId: string): ReconciledPaymongoCheckout {
  const paid = new Date(paidAt);
  return {
    provider: 'PAYMONGO', environment: 'TEST', livemode: false,
    providerSessionId: session, referenceNumber: reference,
    paymentStatus: 'PAID', paymentIntentStatus: 'SUCCEEDED',
    providerPaymentIntentId: `pi_${paymentId.slice(4)}`,
    providerPaymentId: paymentId, amountMinor: 19900, currency: 'PHP',
    paidAt: paid, providerUpdatedAt: new Date(paid.getTime() + 1_000),
  };
}

async function createCheckout(userId: string, priceId: string, suffix: string, sessionId: string, reference: string) {
  return prisma.billingCheckoutRequest.create({ data: {
    userId, billingSubjectKey: 'subject_acceptance_12345678', billingPriceId: priceId,
    provider: 'PAYMONGO', environment: 'TEST', requestIdempotencyKey: `request_${suffix}_12345678`,
    requestHash: sha256(`checkout:${suffix}`), providerIdempotencyKey: `nm_checkout_${suffix}_12345678`,
    referenceNumber: reference, status: 'SUCCEEDED', attemptCount: 1,
    providerSessionId: sessionId, checkoutUrl: `https://checkout.paymongo.com/${sessionId}`,
    completedAt: new Date('2026-09-06T12:00:01.000Z'),
  } });
}

async function createEvent(suffix: string, sessionId: string, createdAt: Date, processing?: {
  status: 'PROCESSING'; lockedAt: Date; claimTokenHash: string; claimExpiresAt: Date;
}) {
  return prisma.providerWebhookEvent.create({ data: {
    provider: 'PAYMONGO', environment: 'TEST', providerEventId: `evt_${suffix}_12345678`,
    eventType: 'checkout_session.payment.paid', livemode: false, payloadHash: sha256(`event:${suffix}`),
    sanitizedPayload: { schemaVersion: 1, resource: { id: sessionId, type: 'checkout_session' } },
    signatureKeyVersion: 'acceptance-v1', providerCreatedAt: createdAt, receivedAt: new Date(createdAt.getTime() + 1_000),
    processing: { create: processing ? { handlerVersion: 'expired-fixture', ...processing } : { handlerVersion: 'paymongo-inbox-v1' } },
  } });
}

async function main() {
  const user = await prisma.user.create({ data: {
    name: 'Projection Acceptance', email: 'projection-acceptance@example.invalid', passwordHash: 'synthetic-not-a-login', role: 'USER',
  } });
  const product = await prisma.billingProduct.create({ data: {
    code: 'PREMIUM', displayName: 'Premium', status: 'ACTIVE', featureSetVersion: 'acceptance-v1',
  } });
  const price = await prisma.billingPrice.create({ data: {
    productId: product.id, provider: 'PAYMONGO', environment: 'TEST', currency: 'PHP', amountMinor: 19900,
    interval: 'MONTH', intervalCount: 1, version: 1, isActive: true,
  } });

  const session1 = 'cs_acceptance_one_12345678';
  const ref1 = 'nmco_acceptance_one_12345678';
  await createCheckout(user.id, price.id, 'a', session1, ref1);
  await createEvent('a', session1, new Date('2026-09-06T13:01:00Z'));
  evidenceBySession.set(session1, evidence(session1, ref1, '2026-09-06T13:00:00Z', 'pay_acceptance_one_12345678'));

  const workers = [1, 2].map(() => new PaymongoPaymentProjectionService(
    new PrismaPaymentProjectionRepository(prisma, () => NOW), gateway, () => NOW,
  ));
  const concurrent = await Promise.all(workers.map((worker) => worker.processNext()));
  assert.deepEqual(concurrent.map((result) => result.decision).sort(), ['NO_WORK', 'SUCCEEDED']);
  assert.equal(await prisma.userSubscription.count(), 1);
  assert.equal(await prisma.billingInvoice.count(), 1);
  assert.equal(await prisma.paymentAttempt.count(), 1);
  assert.equal(await prisma.billingTransaction.count(), 1);
  assert.equal(await prisma.entitlementGrant.count(), 1);
  const postings = await prisma.financialLedgerEntry.findMany({ orderBy: { direction: 'asc' } });
  assert.equal(postings.length, 2);
  assert.equal(postings.reduce((balance, row) => balance + (row.direction === 'DEBIT' ? row.amountMinor : -row.amountMinor), 0), 0);
  assert.deepEqual(new Set(postings.map((row) => row.account)), new Set(['CASH_CLEARING', 'DEFERRED_REVENUE']));

  await createEvent('b', session1, new Date('2026-09-06T13:02:00Z'));
  const replay = await workers[0].processNext();
  assert.equal(replay.decision, 'SUCCEEDED');
  assert.equal(replay.decision === 'SUCCEEDED' && replay.projection.replayed, true);
  assert.deepEqual({
    subscriptions: await prisma.userSubscription.count(), invoices: await prisma.billingInvoice.count(),
    attempts: await prisma.paymentAttempt.count(), transactions: await prisma.billingTransaction.count(),
    ledger: await prisma.financialLedgerEntry.count(), grants: await prisma.entitlementGrant.count(),
  }, { subscriptions: 1, invoices: 1, attempts: 1, transactions: 1, ledger: 2, grants: 1 });

  const session2 = 'cs_acceptance_two_12345678';
  const ref2 = 'nmco_acceptance_two_12345678';
  await createCheckout(user.id, price.id, 'c', session2, ref2);
  await createEvent('c', session2, new Date('2026-10-07T13:01:00Z'), {
    status: 'PROCESSING', lockedAt: new Date('2026-10-07T12:00:00Z'), claimTokenHash: 'c'.repeat(64),
    claimExpiresAt: new Date('2026-10-07T12:01:00Z'),
  });
  evidenceBySession.set(session2, evidence(session2, ref2, '2026-10-07T13:00:00Z', 'pay_acceptance_two_12345678'));
  assert.equal((await workers[0].processNext()).decision, 'SUCCEEDED');
  assert.equal(await prisma.userSubscription.count(), 2);

  const overlapSession = 'cs_acceptance_overlap_12345678';
  const overlapReference = 'nmco_acceptance_overlap_12345678';
  await createCheckout(user.id, price.id, 'g', overlapSession, overlapReference);
  await createEvent('g', overlapSession, new Date('2026-10-20T13:01:00Z'));
  evidenceBySession.set(overlapSession, evidence(
    overlapSession, overlapReference, '2026-10-20T13:00:00Z', 'pay_acceptance_overlap_12345678',
  ));
  assert.deepEqual(await workers[0].processNext(), { decision: 'QUARANTINED', code: 'PAYMENT_PERIOD_OVERLAP' });
  assert.equal(await prisma.userSubscription.count(), 2);

  const session3 = 'cs_acceptance_three_12345678';
  const ref3 = 'nmco_acceptance_three_12345678';
  await createCheckout(user.id, price.id, 'd', session3, ref3);
  await createEvent('d', session3, new Date('2026-11-08T13:01:00Z'));
  evidenceBySession.set(session3, evidence(session3, ref3, '2026-11-08T13:00:00Z', 'pay_acceptance_two_12345678'));
  const beforeConflict = {
    subscriptions: await prisma.userSubscription.count(), invoices: await prisma.billingInvoice.count(),
    attempts: await prisma.paymentAttempt.count(), transactions: await prisma.billingTransaction.count(),
    ledger: await prisma.financialLedgerEntry.count(), grants: await prisma.entitlementGrant.count(),
  };
  assert.deepEqual(await workers[0].processNext(), { decision: 'QUARANTINED', code: 'REPLAY_CONFLICT' });
  assert.deepEqual({
    subscriptions: await prisma.userSubscription.count(), invoices: await prisma.billingInvoice.count(),
    attempts: await prisma.paymentAttempt.count(), transactions: await prisma.billingTransaction.count(),
    ledger: await prisma.financialLedgerEntry.count(), grants: await prisma.entitlementGrant.count(),
  }, beforeConflict);

  const unknownSession = 'cs_unknown_acceptance_12345678';
  await createEvent('e', unknownSession, new Date('2026-12-01T13:01:00Z'));
  const callsBeforeUnknown = providerCalls;
  assert.deepEqual(await workers[0].processNext(), { decision: 'QUARANTINED', code: 'UNKNOWN_CHECKOUT_SESSION' });
  assert.equal(providerCalls, callsBeforeUnknown);
  assert.equal(await prisma.billingReconciliationIssue.count(), 3);

  const session4 = 'cs_acceptance_retry_12345678';
  const ref4 = 'nmco_acceptance_retry_12345678';
  await createCheckout(user.id, price.id, 'f', session4, ref4);
  const retryEvent = await createEvent('f', session4, new Date('2026-12-09T13:01:00Z'));
  assert.deepEqual(await workers[0].processNext(), {
    decision: 'RETRY_SCHEDULED', code: 'PROVIDER_RECONCILIATION_UNAVAILABLE',
  });
  const failedWork = await prisma.webhookEventProcessing.findUniqueOrThrow({ where: { webhookEventId: retryEvent.id } });
  assert.equal(failedWork.status, 'FAILED');
  assert.ok(failedWork.nextAttemptAt);
  assert.equal(await prisma.billingReconciliationIssue.count(), 3);
  await prisma.webhookEventProcessing.update({
    where: { id: failedWork.id }, data: { nextAttemptAt: new Date(NOW.getTime() - 1) },
  });
  evidenceBySession.set(session4, evidence(session4, ref4, '2026-12-09T13:00:00Z', 'pay_acceptance_retry_12345678'));
  assert.equal((await workers[0].processNext()).decision, 'SUCCEEDED');

  const subscription = await prisma.userSubscription.findFirstOrThrow({ orderBy: { currentPeriodStart: 'asc' } });
  assert.equal(subscription.collectionMode, 'ONE_TIME_ACCESS_PERIOD');
  assert.equal(subscription.status, 'NON_RENEWING');
  assert.equal(subscription.renewsAutomatically, false);
  assert.equal(subscription.cancelAtPeriodEnd, false);
  assert.equal(await prisma.billingSubscriptionCancellation.count(), 0);
  assert.equal(await prisma.billingRefund.count(), 0);
  const invoice = await prisma.billingInvoice.findUniqueOrThrow({ where: { sourceCheckoutRequestId: subscription.sourceCheckoutRequestId! } });
  const grant = await prisma.entitlementGrant.findFirstOrThrow({ where: { invoiceId: invoice.id } });
  assert.equal(resolveBillingEntitlement({
    at: new Date(grant.effectiveUntil.getTime() - 1),
    grants: [{ ...grant, invoiceStatus: invoice.status }],
    subscriptions: [{ id: subscription.id, status: subscription.status }],
  }).tier, 'PREMIUM');
  assert.equal(resolveBillingEntitlement({
    at: grant.effectiveUntil,
    grants: [{ ...grant, invoiceStatus: invoice.status }],
    subscriptions: [{ id: subscription.id, status: subscription.status }],
  }).tier, 'FREE');

  await assert.rejects(() => prisma.userSubscription.update({
    where: { id: subscription.id }, data: { renewsAutomatically: true },
  }));
  const succeededWork = await prisma.webhookEventProcessing.findFirstOrThrow({ where: { status: 'SUCCEEDED' } });
  await assert.rejects(() => prisma.webhookEventProcessing.update({
    where: { id: succeededWork.id }, data: { claimTokenHash: 'f'.repeat(64) },
  }));
  await assert.rejects(() => prisma.financialLedgerEntry.update({
    where: { id: postings[0].id }, data: { amountMinor: postings[0].amountMinor + 1 },
  }));
  const imbalanced = await prisma.$queryRaw<Array<{ batchKey: string }>>`
    SELECT "batchKey" FROM "FinancialLedgerEntry"
    WHERE "batchKey" IS NOT NULL
    GROUP BY "batchKey"
    HAVING SUM(CASE WHEN "direction" = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END) <> 0
  `;
  const overlapping = await prisma.$queryRaw<Array<{ leftId: string }>>`
    SELECT left_grant.id AS "leftId"
    FROM "EntitlementGrant" left_grant
    JOIN "EntitlementGrant" right_grant
      ON left_grant."billingSubjectKey" = right_grant."billingSubjectKey"
     AND left_grant.id < right_grant.id
     AND left_grant."revokedAt" IS NULL AND right_grant."revokedAt" IS NULL
     AND left_grant."effectiveFrom" < right_grant."effectiveUntil"
     AND left_grant."effectiveUntil" > right_grant."effectiveFrom"
  `;
  assert.deepEqual(imbalanced, []);
  assert.deepEqual(overlapping, []);

  process.stdout.write(JSON.stringify({
    concurrent: concurrent.map((result) => result.decision).sort(), replay: true, expiredClaimRecovered: true,
    rollbackVerified: true, durableRetryRecovered: true, overlapRejected: true,
    balancedBatches: 3, reconciliationIssues: 3, refunds: 0, constraintProbesRejected: 3, providerCalls,
  }));
}

main().finally(() => prisma.$disconnect());
