import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { BillingHttpRequest, BillingHttpResponse, BillingHttpTransport } from '@/billing/contracts';
import { loadPaymongoConfig } from '@/domain/paymongo-config.policy';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '@/services/billing-checkout-boundary.service';
import { NodeHttpsBillingTransport } from '@/services/node-https-billing.transport';
import { PaymongoGateway } from '@/services/paymongo-gateway.service';
import { PrismaCheckoutIntentRepository } from '@/services/prisma-checkout-intent.repository';

const PRODUCT_ID = 'billing_product_premium_sandbox_demo_v1';
const PRICE_ID = 'billing_price_premium_monthly_test_199_v1';
const ACCEPTANCE_USER_ID = 'paymongo_sandbox_acceptance_user';
const WRONG_ROLE_USER_ID = 'paymongo_sandbox_acceptance_admin';

function assertLocalDatabase(): void {
  const value = process.env.DATABASE_URL || '';
  const parsed = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('Sandbox checkout acceptance requires a loopback PostgreSQL database.');
  }
}

class CountingTransport implements BillingHttpTransport {
  calls = 0;
  constructor(private readonly inner: BillingHttpTransport) {}
  async send(request: BillingHttpRequest): Promise<BillingHttpResponse> {
    this.calls += 1;
    if (this.calls > 1) throw new Error('Provider call budget exceeded.');
    return this.inner.send(request);
  }
}

async function ensureExactCatalogue(prisma: PrismaClient): Promise<void> {
  const product = await prisma.billingProduct.findUnique({ where: { code: 'PREMIUM' } });
  if (!product) {
    await prisma.billingProduct.create({
      data: {
        id: PRODUCT_ID,
        code: 'PREMIUM',
        displayName: 'Premium monthly sandbox demo',
        description: 'Sandbox-only placeholder; not an approved commercial price.',
        status: 'ACTIVE',
        featureSetVersion: 'sandbox-demo-v1',
      },
    });
  } else {
    assert.deepEqual(
      { id: product.id, displayName: product.displayName, status: product.status, featureSetVersion: product.featureSetVersion },
      { id: PRODUCT_ID, displayName: 'Premium monthly sandbox demo', status: 'ACTIVE', featureSetVersion: 'sandbox-demo-v1' },
    );
  }
  const price = await prisma.billingPrice.findUnique({ where: { id: PRICE_ID } });
  if (!price) {
    await prisma.billingPrice.create({
      data: {
        id: PRICE_ID,
        productId: PRODUCT_ID,
        provider: 'PAYMONGO',
        environment: 'TEST',
        currency: 'PHP',
        amountMinor: 19_900,
        interval: 'MONTH',
        intervalCount: 1,
        version: 1,
        isActive: true,
      },
    });
  } else {
    assert.deepEqual(
      {
        productId: price.productId, provider: price.provider, environment: price.environment,
        currency: price.currency, amountMinor: price.amountMinor, interval: price.interval,
        intervalCount: price.intervalCount, version: price.version, isActive: price.isActive,
      },
      {
        productId: PRODUCT_ID, provider: 'PAYMONGO', environment: 'TEST', currency: 'PHP',
        amountMinor: 19_900, interval: 'MONTH', intervalCount: 1, version: 1, isActive: true,
      },
    );
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--acknowledge-one-provider-call')) {
    throw new Error('The explicit one-provider-call acknowledgement flag is required.');
  }
  assertLocalDatabase();
  const config = loadPaymongoConfig(process.env);
  if (!config.checkout.enabled) throw new Error('Sandbox checkout is not enabled for this process.');
  const webhookAcceptance = process.argv.includes('--webhook-acceptance');
  if (config.webhook.enabled !== webhookAcceptance) {
    throw new Error(webhookAcceptance ? 'Webhook intake must be enabled for this acceptance.' : 'Webhook intake must remain disabled for this acceptance.');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.createMany({
      data: [
        { id: ACCEPTANCE_USER_ID, name: 'Sandbox Acceptance User', email: 'paymongo-user@example.invalid', passwordHash: 'not-authenticatable', role: 'USER', emailVerified: true },
        { id: WRONG_ROLE_USER_ID, name: 'Sandbox Acceptance Admin', email: 'paymongo-admin@example.invalid', passwordHash: 'not-authenticatable', role: 'ADMIN', emailVerified: true },
      ],
      skipDuplicates: true,
    });
    await ensureExactCatalogue(prisma);
    const repository = new PrismaCheckoutIntentRepository(prisma);
    assert.equal(await repository.findEligiblePrice({ userId: WRONG_ROLE_USER_ID, priceCode: 'PREMIUM', environment: 'TEST' }), null);
    assert.equal(await repository.findEligiblePrice({ userId: 'unknown-user', priceCode: 'PREMIUM', environment: 'TEST' }), null);

    const collisionKey = `acceptance-collision-${randomUUID()}`;
    const collisionClaim = await repository.claim({ userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: collisionKey, requestHash: 'a'.repeat(64) });
    assert.equal(collisionClaim.decision, 'CREATE');
    const collision = await repository.claim({ userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: collisionKey, requestHash: 'b'.repeat(64) });
    assert.equal(collision.decision, 'CONFLICT');

    const retryKey = `acceptance-retry-${randomUUID()}`;
    const firstClaim = await repository.claim({ userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: retryKey, requestHash: 'c'.repeat(64) });
    assert.equal(firstClaim.decision, 'CREATE');
    if (firstClaim.decision !== 'CREATE') throw new Error('Expected initial claim.');
    await repository.release({
      userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: retryKey,
      claimToken: firstClaim.claimToken, failureCode: 'PROVIDER_TEMPORARILY_UNAVAILABLE',
    });
    const reclaimed = await repository.claim({ userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: retryKey, requestHash: 'c'.repeat(64) });
    assert.equal(reclaimed.decision, 'CREATE');
    if (reclaimed.decision !== 'CREATE') throw new Error('Expected reclaimed request.');
    assert.equal(reclaimed.providerIdempotencyKey, firstClaim.providerIdempotencyKey);
    assert.equal(reclaimed.referenceNumber, firstClaim.referenceNumber);
    assert.notEqual(reclaimed.claimToken, firstClaim.claimToken);
    await repository.release({
      userId: ACCEPTANCE_USER_ID, priceId: PRICE_ID, requestIdempotencyKey: retryKey,
      claimToken: reclaimed.claimToken, failureCode: 'PROVIDER_REQUEST_REJECTED:ACCEPTANCE_TERMINAL',
    });

    const transport = new CountingTransport(new NodeHttpsBillingTransport());
    const boundary = new BillingCheckoutBoundary(config.checkout, repository, new PaymongoGateway(config.checkout, transport));
    const providerKey = `acceptance-provider-${randomUUID()}`;
    let providerOutcome = 'SUCCEEDED';
    let sessionId: string | undefined;
    let checkoutUrl: string | undefined;
    try {
      const first = await boundary.create({ userId: ACCEPTANCE_USER_ID, priceCode: 'PREMIUM', requestIdempotencyKey: providerKey });
      assert.equal(first.livemode, false);
      assert.equal(first.entitlementGranted, false);
      sessionId = first.providerSessionId;
      checkoutUrl = first.checkoutUrl;
      const replay = await boundary.create({ userId: ACCEPTANCE_USER_ID, priceCode: 'PREMIUM', requestIdempotencyKey: providerKey });
      assert.equal(replay.providerSessionId, first.providerSessionId);
      assert.equal(replay.entitlementGranted, false);
    } catch (error) {
      assert.ok(error instanceof CheckoutBoundaryError);
      providerOutcome = error.code;
      await assert.rejects(
        () => boundary.create({ userId: ACCEPTANCE_USER_ID, priceCode: 'PREMIUM', requestIdempotencyKey: providerKey }),
        (replayError: unknown) => replayError instanceof CheckoutBoundaryError && replayError.code === error.code,
      );
    }
    assert.equal(transport.calls, 1);

    const persisted = await prisma.billingCheckoutRequest.findFirstOrThrow({
      where: { userId: ACCEPTANCE_USER_ID, requestIdempotencyKey: providerKey },
      include: { auditEvents: true },
    });
    const configuredSecret = process.env.PAYMONGO_SECRET_KEY || '';
    assert.ok(configuredSecret.length > 0);
    assert.equal(JSON.stringify(persisted).includes(configuredSecret), false);
    assert.equal(persisted.environment, 'TEST');
    assert.equal(persisted.attemptCount, 1);
    assert.equal(persisted.auditEvents.some((event) => event.eventType === 'REPLAYED') || persisted.status === 'FAILED' || persisted.status === 'RETRYABLE', true);
    const projections = {
      subscriptions: await prisma.userSubscription.count(),
      invoices: await prisma.billingInvoice.count(),
      attempts: await prisma.paymentAttempt.count(),
      transactions: await prisma.billingTransaction.count(),
      ledgerEntries: await prisma.financialLedgerEntry.count(),
      entitlements: await prisma.entitlementGrant.count(),
    };
    assert.deepEqual(projections, { subscriptions: 0, invoices: 0, attempts: 0, transactions: 0, ledgerEntries: 0, entitlements: 0 });

    process.stdout.write(`${JSON.stringify({
      providerCalls: transport.calls,
      providerOutcome,
      providerSessionId: sessionId,
      ...(webhookAcceptance ? { checkoutUrl } : {}),
      persistedStatus: persisted.status,
      persistedFailureCode: persisted.failureCode,
      auditEventCount: persisted.auditEvents.length,
      exactReplayAvoidedSecondProviderCall: true,
      wrongRoleDenied: true,
      unknownUserDenied: true,
      retryReusedProviderIdempotencyKey: true,
      configuredSecretAbsentFromPersistence: true,
      projections,
    }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const code = error instanceof CheckoutBoundaryError ? error.code : 'SANDBOX_ACCEPTANCE_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
