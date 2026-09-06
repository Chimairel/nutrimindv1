import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  BillingHttpRequest,
  BillingHttpResponse,
  BillingHttpTransport,
  CheckoutReconciliationGateway,
  ReconciledPaymongoCheckout,
} from '../src/billing/contracts';
import { resolveBillingEntitlement } from '../src/domain/billing-entitlement.policy';
import { loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import { NodeHttpsBillingTransport } from '../src/services/node-https-billing.transport';
import { PaymongoPaymentProjectionService } from '../src/services/paymongo-payment-projection.service';
import { PrismaPaymentProjectionRepository } from '../src/services/prisma-payment-projection.repository';
import { PaymongoReconciliationGateway } from '../src/services/paymongo-reconciliation-gateway.service';

const SESSION_ID = 'cs_2c030de77711f9285b90547f';
const REFERENCE = 'nmco_ca452ab1fbdb50918247b039f9a99a0b';
const EVENT_ID = 'evt_aF8YduaEpB1vLvC1NRM9rc8z';
const EXPECTED_AMOUNT_MINOR = 19_900;

dotenv.config();
const database = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55448') {
  throw new Error('Provider reconciliation acceptance requires the task-owned database on 127.0.0.1:55448.');
}
const loaded = loadPaymongoConfig({
  NODE_ENV: 'test',
  PAYMONGO_RECONCILIATION_ENABLED: 'true',
  PAYMONGO_ENVIRONMENT: 'TEST',
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
});
if (!loaded.reconciliation.enabled) throw new Error('TEST reconciliation configuration is unavailable.');

class OneRequestTransport implements BillingHttpTransport {
  count = 0;
  readonly inner = new NodeHttpsBillingTransport();
  async send(request: BillingHttpRequest): Promise<BillingHttpResponse> {
    this.count += 1;
    if (this.count > 1) throw new Error('Provider request budget exceeded.');
    return this.inner.send(request);
  }
}

const prisma = new PrismaClient();

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function seedAcceptanceBinding() {
  const user = await prisma.user.create({
    data: {
      name: 'Provider Reconciliation Acceptance',
      email: 'provider-reconciliation@example.invalid',
      passwordHash: 'synthetic-not-a-login',
      role: 'USER',
    },
  });
  const product = await prisma.billingProduct.create({
    data: {
      code: 'PREMIUM',
      displayName: 'Premium',
      status: 'ACTIVE',
      featureSetVersion: 'provider-acceptance-v1',
    },
  });
  const price = await prisma.billingPrice.create({
    data: {
      productId: product.id,
      provider: 'PAYMONGO',
      environment: 'TEST',
      currency: 'PHP',
      amountMinor: EXPECTED_AMOUNT_MINOR,
      interval: 'MONTH',
      intervalCount: 1,
      version: 1,
      isActive: true,
    },
  });
  const requestHash = hash(
    JSON.stringify({
      fixture: 'reconstructed-phase-3b-binding',
      provider: 'PAYMONGO',
      environment: 'TEST',
      priceId: price.id,
      productCode: 'PREMIUM',
      amountMinor: EXPECTED_AMOUNT_MINOR,
      currency: 'PHP',
      paymentMethods: ['card'],
      referenceNumber: REFERENCE,
    })
  );
  await prisma.billingCheckoutRequest.create({
    data: {
      userId: user.id,
      billingSubjectKey: 'subject_provider_acceptance_12345678',
      billingPriceId: price.id,
      provider: 'PAYMONGO',
      environment: 'TEST',
      requestIdempotencyKey: 'provider-acceptance-request-12345678',
      requestHash,
      providerIdempotencyKey: 'provider-acceptance-key-12345678',
      referenceNumber: REFERENCE,
      status: 'SUCCEEDED',
      attemptCount: 1,
      providerSessionId: SESSION_ID,
      checkoutUrl: `https://checkout.paymongo.com/${SESSION_ID}`,
      completedAt: new Date('2026-09-06T05:01:00.000Z'),
      createdAt: new Date('2026-09-06T05:00:00.000Z'),
    },
  });
  const fixtureTime = new Date();
  await prisma.providerWebhookEvent.create({
    data: {
      provider: 'PAYMONGO',
      environment: 'TEST',
      providerEventId: EVENT_ID,
      eventType: 'checkout_session.payment.paid',
      livemode: false,
      payloadHash: hash(
        JSON.stringify({ fixture: 'sanitized-accepted-event-reconstruction', eventId: EVENT_ID, sessionId: SESSION_ID })
      ),
      sanitizedPayload: {
        schemaVersion: 1,
        fixtureKind: 'LOCAL_ACCEPTANCE_RECONSTRUCTION_NOT_PROVIDER_DELIVERY',
        event: { id: EVENT_ID, type: 'checkout_session.payment.paid', livemode: false },
        resource: { id: SESSION_ID, type: 'checkout_session' },
      },
      signatureKeyVersion: 'acceptance-reconstruction-v1',
      providerCreatedAt: fixtureTime,
      receivedAt: fixtureTime,
      processing: { create: { handlerVersion: 'paymongo-inbox-v1', status: 'PENDING' } },
    },
  });
}

async function main() {
  await seedAcceptanceBinding();
  const transport = new OneRequestTransport();
  const providerGateway = new PaymongoReconciliationGateway(loaded.reconciliation, transport);
  let captured: ReconciledPaymongoCheckout | undefined;
  const gateway: CheckoutReconciliationGateway = {
    async retrieveCheckoutSession(sessionId) {
      captured = await providerGateway.retrieveCheckoutSession(sessionId);
      return captured;
    },
  };
  const processor = new PaymongoPaymentProjectionService(new PrismaPaymentProjectionRepository(prisma), gateway);
  const first = await processor.processNext();
  if (first.decision !== 'SUCCEEDED') {
    const financeRows = await Promise.all([
      prisma.userSubscription.count(),
      prisma.billingInvoice.count(),
      prisma.paymentAttempt.count(),
      prisma.billingTransaction.count(),
      prisma.financialLedgerEntry.count(),
      prisma.entitlementGrant.count(),
    ]);
    assert.deepEqual(financeRows, [0, 0, 0, 0, 0, 0]);
    process.stdout.write(
      JSON.stringify({ acceptance: 'SANITIZED_GAP', code: first.code, providerRequests: transport.count })
    );
    process.exitCode = 2;
    return;
  }
  assert.ok(captured);
  assert.equal(captured.providerSessionId, SESSION_ID);
  assert.equal(captured.referenceNumber, REFERENCE);
  assert.equal(captured.amountMinor, EXPECTED_AMOUNT_MINOR);
  assert.equal(captured.currency, 'PHP');
  assert.equal(captured.livemode, false);

  const second = await processor.processNext();
  assert.deepEqual(second, { decision: 'NO_WORK' });
  assert.equal(transport.count, 1);

  const [subscription, invoice, attempt, transaction, grant, ledger] = await Promise.all([
    prisma.userSubscription.findFirstOrThrow(),
    prisma.billingInvoice.findFirstOrThrow(),
    prisma.paymentAttempt.findFirstOrThrow(),
    prisma.billingTransaction.findFirstOrThrow(),
    prisma.entitlementGrant.findFirstOrThrow(),
    prisma.financialLedgerEntry.findMany(),
  ]);
  assert.deepEqual(
    {
      subscriptions: await prisma.userSubscription.count(),
      invoices: await prisma.billingInvoice.count(),
      attempts: await prisma.paymentAttempt.count(),
      transactions: await prisma.billingTransaction.count(),
      ledger: await prisma.financialLedgerEntry.count(),
      grants: await prisma.entitlementGrant.count(),
    },
    { subscriptions: 1, invoices: 1, attempts: 1, transactions: 1, ledger: 2, grants: 1 }
  );
  assert.equal(subscription.collectionMode, 'ONE_TIME_ACCESS_PERIOD');
  assert.equal(subscription.status, 'NON_RENEWING');
  assert.equal(subscription.renewsAutomatically, false);
  assert.equal(subscription.providerCustomerRecordId, null);
  assert.equal(subscription.providerSubscriptionId, null);
  assert.equal(invoice.providerInvoiceId, null);
  assert.equal(attempt.providerPaymentId, captured.providerPaymentId);
  assert.equal(transaction.providerPaymentId, captured.providerPaymentId);
  assert.equal(
    ledger.reduce((sum, entry) => sum + (entry.direction === 'DEBIT' ? entry.amountMinor : -entry.amountMinor), 0),
    0
  );
  assert.deepEqual(new Set(ledger.map((entry) => entry.account)), new Set(['CASH_CLEARING', 'DEFERRED_REVENUE']));

  const grantEvidence = [{ ...grant, invoiceStatus: invoice.status }];
  const subscriptionEvidence = [{ id: subscription.id, status: subscription.status }];
  assert.equal(
    resolveBillingEntitlement({
      at: new Date(grant.effectiveUntil.getTime() - 1),
      grants: grantEvidence,
      subscriptions: subscriptionEvidence,
    }).tier,
    'PREMIUM'
  );
  assert.equal(
    resolveBillingEntitlement({
      at: grant.effectiveUntil,
      grants: grantEvidence,
      subscriptions: subscriptionEvidence,
    }).tier,
    'FREE'
  );
  assert.equal(resolveBillingEntitlement({ at: new Date(), grants: [], subscriptions: [] }).tier, 'FREE');

  const unrelatedCounts = await Promise.all([
    prisma.providerCustomer.count(),
    prisma.billingSubscriptionCancellation.count(),
    prisma.billingRefund.count(),
    prisma.nutritionistWorkCredit.count(),
    prisma.compensationStatement.count(),
    prisma.compensationPayout.count(),
  ]);
  assert.deepEqual(unrelatedCounts, [0, 0, 0, 0, 0, 0]);

  process.stdout.write(
    JSON.stringify({
      acceptance: 'SUCCEEDED',
      providerRequests: transport.count,
      evidence: {
        sessionId: captured.providerSessionId,
        referenceNumber: captured.referenceNumber,
        paymentId: captured.providerPaymentId,
        paymentIntentId: captured.providerPaymentIntentId,
        paymentStatus: captured.paymentStatus,
        paymentIntentStatus: captured.paymentIntentStatus,
        amountMinor: captured.amountMinor,
        currency: captured.currency,
        livemode: captured.livemode,
        paidAt: captured.paidAt.toISOString(),
        providerUpdatedAt: captured.providerUpdatedAt.toISOString(),
      },
      projection: { subscriptions: 1, invoices: 1, attempts: 1, transactions: 1, ledger: 2, grants: 1 },
      replay: { decision: second.decision, providerRequestsAfterReplay: transport.count },
      entitlement: { activeBeforeExclusiveEnd: 'PREMIUM', atExclusiveEnd: 'FREE', browserReturnWithoutGrant: 'FREE' },
      unrelated: { providerCustomers: 0, cancellations: 0, refunds: 0, workCredits: 0, statements: 0, payouts: 0 },
    })
  );
}

main()
  .catch((error: unknown) => {
    const code =
      error instanceof Error && /^[A-Z0-9_]{1,64}$/.test(error.message) ? error.message : 'ACCEPTANCE_FAILED';
    process.stdout.write(JSON.stringify({ acceptance: 'SANITIZED_GAP', code }));
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
