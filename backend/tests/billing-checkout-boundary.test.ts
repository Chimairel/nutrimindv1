import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BillingGateway,
  CheckoutIntentClaim,
  CheckoutIntentRepository,
  HostedCheckoutRequest,
  HostedCheckoutSession,
} from '../src/billing/contracts';
import { EnabledPaymongoConfig, loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '../src/services/billing-checkout-boundary.service';

function enabledConfig(): EnabledPaymongoConfig {
  return loadPaymongoConfig({
    NODE_ENV: 'test',
    PAYMONGO_INTEGRATION_ENABLED: 'true',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'a'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET: `whsk_${'b'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET_VERSION: 'sandbox-v1',
    PAYMONGO_CHECKOUT_SUCCESS_URL: 'https://nutrimind.example.invalid/billing/success',
    PAYMONGO_CHECKOUT_CANCEL_URL: 'https://nutrimind.example.invalid/billing/cancel',
  }) as EnabledPaymongoConfig;
}

const session: HostedCheckoutSession = {
  provider: 'PAYMONGO',
  environment: 'TEST',
  providerSessionId: 'cs_synthetic_12345678',
  checkoutUrl: 'https://checkout.paymongo.com/synthetic-session',
  livemode: false,
  entitlementGranted: false,
};

class FakeCheckoutRepository implements CheckoutIntentRepository {
  claimDecision: CheckoutIntentClaim = {
    decision: 'CREATE',
    referenceNumber: 'opaque_subject_1',
    providerIdempotencyKey: 'nutrimind:checkout:opaque_1:v1',
  };
  price = {
    id: 'price_1',
    productCode: 'PREMIUM',
    displayName: 'Premium sandbox',
    amountMinor: 19_900,
    currency: 'PHP' as const,
    environment: 'TEST' as const,
    active: true as const,
  };
  seenUserId?: string;
  completed = 0;
  released = 0;
  async findEligiblePrice(input: { userId: string }) {
    this.seenUserId = input.userId;
    return this.price;
  }
  async claim() { return this.claimDecision; }
  async complete() { this.completed += 1; }
  async release() { this.released += 1; }
}

class FakeGateway implements BillingGateway {
  calls = 0;
  request?: HostedCheckoutRequest;
  async createHostedCheckout(request: HostedCheckoutRequest) {
    this.calls += 1;
    this.request = request;
    return session;
  }
}

const input = { userId: 'user_owner_1', priceCode: 'PREMIUM', requestIdempotencyKey: 'request-key-1234' };

test('[TEST-087] disabled checkout fails before repository or gateway access', async () => {
  const repository = new FakeCheckoutRepository();
  const gateway = new FakeGateway();
  const service = new BillingCheckoutBoundary({ enabled: false, environment: 'TEST' }, repository, gateway);
  await assert.rejects(() => service.create(input), (error: unknown) =>
    error instanceof CheckoutBoundaryError && error.code === 'PAYMENTS_UNAVAILABLE');
  assert.equal(repository.seenUserId, undefined);
  assert.equal(gateway.calls, 0);
});

test('[TEST-087] checkout is owner-scoped, idempotent, and never grants entitlement', async () => {
  const repository = new FakeCheckoutRepository();
  const gateway = new FakeGateway();
  const result = await new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input);
  assert.equal(repository.seenUserId, input.userId);
  assert.equal(gateway.calls, 1);
  assert.equal(gateway.request?.idempotencyKey, 'nutrimind:checkout:opaque_1:v1');
  assert.equal(gateway.request?.referenceNumber, 'opaque_subject_1');
  assert.deepEqual(gateway.request?.paymentMethods, ['card', 'paymaya']);
  assert.equal(repository.completed, 1);
  assert.equal(result.entitlementGranted, false);
});

test('[TEST-087] an exact local replay returns the stored session without a provider call', async () => {
  const repository = new FakeCheckoutRepository();
  repository.claimDecision = { decision: 'REPLAY', session: { ...session } };
  const gateway = new FakeGateway();
  const result = await new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input);
  assert.equal(gateway.calls, 0);
  assert.equal(repository.completed, 0);
  assert.equal(result.providerSessionId, session.providerSessionId);
  assert.equal(result.entitlementGranted, false);
});

test('[TEST-087] an idempotency-key payload collision fails closed', async () => {
  const repository = new FakeCheckoutRepository();
  repository.claimDecision = { decision: 'CONFLICT' };
  const gateway = new FakeGateway();
  await assert.rejects(() => new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input),
    (error: unknown) => error instanceof CheckoutBoundaryError && error.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT');
  assert.equal(gateway.calls, 0);
});

test('[TEST-087] unavailable prices and malformed identifiers fail without a provider call', async () => {
  const repository = new FakeCheckoutRepository();
  const gateway = new FakeGateway();
  repository.price = null as never;
  await assert.rejects(() => new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input), /CHECKOUT_PRICE_UNAVAILABLE/);
  await assert.rejects(() => new BillingCheckoutBoundary(enabledConfig(), new FakeCheckoutRepository(), gateway).create({
    ...input,
    requestIdempotencyKey: 'short',
  }), /CHECKOUT_REQUEST_INVALID/);
  assert.equal(gateway.calls, 0);
});

test('[TEST-087] provider or repository failures are sanitized and release the claimed intent', async () => {
  const repository = new FakeCheckoutRepository();
  const gateway: BillingGateway = { async createHostedCheckout() { throw new Error('sensitive provider body'); } };
  let caught: unknown;
  try {
    await new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof CheckoutBoundaryError);
  assert.equal(caught.code, 'CHECKOUT_TEMPORARILY_UNAVAILABLE');
  assert.doesNotMatch(caught.message, /sensitive provider body/);
  assert.equal(repository.released, 1);
});

test('[TEST-087] a gateway cannot smuggle a live or entitlement-granting response through checkout', async () => {
  const repository = new FakeCheckoutRepository();
  const gateway: BillingGateway = {
    async createHostedCheckout() {
      return { ...session, entitlementGranted: true } as unknown as HostedCheckoutSession;
    },
  };
  await assert.rejects(() => new BillingCheckoutBoundary(enabledConfig(), repository, gateway).create(input),
    /CHECKOUT_TEMPORARILY_UNAVAILABLE/);
  assert.equal(repository.completed, 0);
  assert.equal(repository.released, 1);
});
