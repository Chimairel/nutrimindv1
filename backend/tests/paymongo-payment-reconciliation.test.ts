import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CheckoutReconciliationGateway,
  PaymentProjectionBinding,
  PaymentProjectionRepository,
  ReconciledPaymongoCheckout,
} from '../src/billing/contracts';
import {
  thirtyDaysFrom,
  PaymentReconciliationError,
  validatePaymongoPayment,
} from '../src/domain/paymongo-payment-reconciliation.policy';
import { PaymongoPaymentProjectionService } from '../src/services/paymongo-payment-projection.service';

const NOW = new Date('2026-09-06T14:00:00.000Z');

function binding(overrides: Partial<PaymentProjectionBinding> = {}): PaymentProjectionBinding {
  return {
    checkoutFound: true,
    processingId: 'processing_12345678', claimToken: 'claim_12345678', webhookEventId: 'webhook_12345678',
    providerEventId: 'evt_12345678', eventType: 'checkout_session.payment.paid', eventLivemode: false,
    eventProviderCreatedAt: new Date('2026-09-06T13:01:00.000Z'), eventReceivedAt: new Date('2026-09-06T13:01:01.000Z'),
    providerSessionId: 'cs_123456789', checkoutRequestId: 'checkout_12345678', checkoutUserId: 'user_12345678',
    userEligible: true, billingSubjectKey: 'subject_12345678', billingPriceId: 'price_12345678',
    productCode: 'PREMIUM', productStatus: 'ACTIVE', priceEnvironment: 'TEST', priceAmountMinor: 19900,
    priceCurrency: 'PHP', priceInterval: 'MONTH', priceIntervalCount: 1, checkoutStatus: 'SUCCEEDED',
    requestHash: 'a'.repeat(64), referenceNumber: 'nmco_12345678',
    checkoutCreatedAt: new Date('2026-09-06T12:00:00.000Z'), checkoutCompletedAt: new Date('2026-09-06T12:00:01.000Z'),
    latestProviderUpdatedAt: null,
    ...overrides,
  };
}

function evidence(overrides: Partial<ReconciledPaymongoCheckout> = {}): ReconciledPaymongoCheckout {
  return {
    provider: 'PAYMONGO', environment: 'TEST', livemode: false, providerSessionId: 'cs_123456789',
    referenceNumber: 'nmco_12345678', paymentStatus: 'PAID', paymentIntentStatus: 'SUCCEEDED',
    providerPaymentIntentId: 'pi_123456789', providerPaymentId: 'pay_12345678', amountMinor: 19900, currency: 'PHP',
    paidAt: new Date('2026-09-06T13:00:00.000Z'), providerUpdatedAt: new Date('2026-09-06T13:00:01.000Z'),
    ...overrides,
  };
}

function failureCode(fn: () => unknown): string {
  try { fn(); } catch (error) {
    assert.ok(error instanceof PaymentReconciliationError);
    return error.code;
  }
  assert.fail('Expected reconciliation to fail.');
}

test('[TEST-102] exact TEST paid evidence produces one fixed 30-day half-open period', () => {
  const result = validatePaymongoPayment(binding(), evidence(), NOW);
  assert.deepEqual(result, {
    effectiveFrom: new Date('2026-09-06T13:00:00.000Z'),
    effectiveUntil: new Date('2026-10-06T13:00:00.000Z'),
  });
  assert.equal(thirtyDaysFrom(new Date('2027-01-31T08:30:00.000Z')).toISOString(), '2027-03-02T08:30:00.000Z');
});

test('[TEST-102] local ownership, immutable request, and TEST price binding fail closed before retrieval', () => {
  assert.equal(failureCode(() => validatePaymongoPayment(binding({ checkoutFound: false }), evidence(), NOW)), 'UNKNOWN_CHECKOUT_SESSION');
  assert.equal(failureCode(() => validatePaymongoPayment(binding({ checkoutUserId: null }), evidence(), NOW)), 'CHECKOUT_OWNERSHIP_MISSING');
  assert.equal(failureCode(() => validatePaymongoPayment(binding({ requestHash: 'bad' }), evidence(), NOW)), 'CHECKOUT_REQUEST_INVALID');
  assert.equal(failureCode(() => validatePaymongoPayment(binding({ checkoutStatus: 'FAILED' }), evidence(), NOW)), 'CHECKOUT_NOT_COMPLETED');
  assert.equal(failureCode(() => validatePaymongoPayment(binding({ productCode: 'FREE' }), evidence(), NOW)), 'PRICE_BINDING_MISMATCH');
});

test('[TEST-102] provider session, reference, amount, currency, mode, and paid state must match exactly', () => {
  const cases: Array<[Partial<ReconciledPaymongoCheckout>, string]> = [
    [{ providerSessionId: 'cs_other_12345678' }, 'SESSION_MISMATCH'],
    [{ referenceNumber: 'nmco_other_12345678' }, 'REFERENCE_MISMATCH'],
    [{ amountMinor: 19899 }, 'AMOUNT_MISMATCH'],
    [{ currency: 'USD' }, 'CURRENCY_MISMATCH'],
    [{ livemode: true as false }, 'LIVE_MODE_REJECTED'],
    [{ paymentStatus: 'UNPAID' }, 'PAYMENT_NOT_SUCCEEDED'],
    [{ paymentIntentStatus: 'PROCESSING' }, 'PAYMENT_NOT_SUCCEEDED'],
  ];
  for (const [change, code] of cases) assert.equal(failureCode(() => validatePaymongoPayment(binding(), evidence(change), NOW)), code);
});

test('[TEST-102] impossible and stale provider timestamps are quarantined', () => {
  assert.equal(failureCode(() => validatePaymongoPayment(binding(), evidence({ paidAt: new Date('2026-09-07T00:00:00Z') }), NOW)), 'TIMESTAMP_INVALID');
  assert.equal(failureCode(() => validatePaymongoPayment(
    binding({ latestProviderUpdatedAt: new Date('2026-09-06T13:30:00Z') }), evidence(), NOW,
  )), 'STALE_PROVIDER_STATE');
});

class FakeRepository implements PaymentProjectionRepository {
  failures: Array<{ code: string; retryable: boolean }> = [];
  projections = 0;
  constructor(readonly bound: PaymentProjectionBinding = binding()) {}
  async claimNext() { return { decision: 'CLAIMED' as const, binding: this.bound }; }
  async project(_binding: PaymentProjectionBinding, _evidence: ReconciledPaymongoCheckout, period: { effectiveFrom: Date; effectiveUntil: Date }) {
    this.projections += 1;
    return {
      subscriptionId: 'sub_12345678', invoiceId: 'inv_12345678', paymentAttemptId: 'attempt_12345678',
      transactionId: 'transaction_12345678', entitlementGrantId: 'grant_12345678', ...period, replayed: this.projections > 1,
    };
  }
  async fail(_binding: PaymentProjectionBinding, failure: { code: string; retryable: boolean }) { this.failures.push(failure); }
}

test('[TEST-102] worker projects success and deterministic replay through the repository', async () => {
  const repository = new FakeRepository();
  const gateway: CheckoutReconciliationGateway = { async retrieveCheckoutSession() { return evidence(); } };
  const worker = new PaymongoPaymentProjectionService(repository, gateway, () => NOW);
  const first = await worker.processNext();
  const replay = await worker.processNext();
  assert.equal(first.decision, 'SUCCEEDED');
  assert.equal(replay.decision, 'SUCCEEDED');
  assert.equal(replay.decision === 'SUCCEEDED' && replay.projection.replayed, true);
});

test('[TEST-102] unknown checkout avoids provider retrieval and is durably quarantined', async () => {
  const repository = new FakeRepository(binding({ checkoutFound: false }));
  let calls = 0;
  const gateway: CheckoutReconciliationGateway = { async retrieveCheckoutSession() { calls += 1; return evidence(); } };
  const result = await new PaymongoPaymentProjectionService(repository, gateway, () => NOW).processNext();
  assert.deepEqual(result, { decision: 'QUARANTINED', code: 'UNKNOWN_CHECKOUT_SESSION' });
  assert.equal(calls, 0);
  assert.deepEqual(repository.failures, [{ code: 'UNKNOWN_CHECKOUT_SESSION', retryable: false }]);
});

test('[TEST-102] provider retrieval failures schedule retry without projection', async () => {
  const repository = new FakeRepository();
  const gateway: CheckoutReconciliationGateway = { async retrieveCheckoutSession() { throw new Error('private transport detail'); } };
  const result = await new PaymongoPaymentProjectionService(repository, gateway, () => NOW).processNext();
  assert.deepEqual(result, { decision: 'RETRY_SCHEDULED', code: 'PROVIDER_RECONCILIATION_UNAVAILABLE' });
  assert.equal(repository.projections, 0);
  assert.deepEqual(repository.failures, [{ code: 'PROVIDER_RECONCILIATION_UNAVAILABLE', retryable: true }]);
});

test('[TEST-126] lifecycle cancellation reaches retrieval and releases the durable claim for retry', async () => {
  const repository = new FakeRepository();
  const controller = new AbortController();
  let receivedSignal: AbortSignal | undefined;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const gateway: CheckoutReconciliationGateway = {
    async retrieveCheckoutSession(_sessionId, signal) {
      receivedSignal = signal;
      entered();
      await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
      throw new Error('private abort detail');
    },
  };
  const processing = new PaymongoPaymentProjectionService(repository, gateway, () => NOW)
    .processNext(controller.signal);
  await started;
  controller.abort();
  assert.deepEqual(await processing, {
    decision: 'RETRY_SCHEDULED', code: 'PROVIDER_RECONCILIATION_UNAVAILABLE',
  });
  assert.equal(receivedSignal, controller.signal);
  assert.deepEqual(repository.failures, [{ code: 'PROVIDER_RECONCILIATION_UNAVAILABLE', retryable: true }]);
});
