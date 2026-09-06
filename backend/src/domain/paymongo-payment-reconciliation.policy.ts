import { PaymentProjectionBinding, ReconciledPaymongoCheckout } from '@/billing/contracts';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,190}$/;
const SESSION_ID = /^cs_[A-Za-z0-9_-]{8,188}$/;
const HASH = /^[0-9a-f]{64}$/;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const PREMIUM_ACCESS_DURATION_DAYS = 30;
const PREMIUM_ACCESS_DURATION_MS = PREMIUM_ACCESS_DURATION_DAYS * 24 * 60 * 60 * 1000;

export type ReconciliationFailureCode =
  | 'EVENT_NOT_SUPPORTED'
  | 'LIVE_MODE_REJECTED'
  | 'UNKNOWN_CHECKOUT_SESSION'
  | 'CHECKOUT_OWNERSHIP_MISSING'
  | 'CHECKOUT_REQUEST_INVALID'
  | 'CHECKOUT_NOT_COMPLETED'
  | 'PRICE_BINDING_MISMATCH'
  | 'REFERENCE_MISMATCH'
  | 'SESSION_MISMATCH'
  | 'PAYMENT_NOT_SUCCEEDED'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'TIMESTAMP_INVALID'
  | 'STALE_PROVIDER_STATE'
  | 'PAYMENT_PERIOD_OVERLAP'
  | 'REPLAY_CONFLICT';

export class PaymentReconciliationError extends Error {
  constructor(readonly code: ReconciliationFailureCode) {
    super(code);
    this.name = 'PaymentReconciliationError';
  }
}

function validDate(value: Date | null): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function thirtyDaysFrom(start: Date): Date {
  if (!validDate(start)) throw new PaymentReconciliationError('TIMESTAMP_INVALID');
  return new Date(start.getTime() + PREMIUM_ACCESS_DURATION_MS);
}

export function validatePaymongoPayment(
  binding: PaymentProjectionBinding,
  evidence: ReconciledPaymongoCheckout,
  now: Date,
): { effectiveFrom: Date; effectiveUntil: Date } {
  validateLocalPaymentBinding(binding);
  if (evidence.provider !== 'PAYMONGO' || evidence.livemode || evidence.environment !== 'TEST') {
    throw new PaymentReconciliationError('LIVE_MODE_REJECTED');
  }
  if (evidence.providerSessionId !== binding.providerSessionId) throw new PaymentReconciliationError('SESSION_MISMATCH');
  if (evidence.referenceNumber !== binding.referenceNumber) throw new PaymentReconciliationError('REFERENCE_MISMATCH');
  if (evidence.paymentStatus !== 'PAID' || evidence.paymentIntentStatus !== 'SUCCEEDED' ||
      !ID.test(evidence.providerPaymentId) || !ID.test(evidence.providerPaymentIntentId)) {
    throw new PaymentReconciliationError('PAYMENT_NOT_SUCCEEDED');
  }
  if (evidence.amountMinor !== binding.priceAmountMinor) throw new PaymentReconciliationError('AMOUNT_MISMATCH');
  if (evidence.currency !== 'PHP' || binding.priceCurrency !== 'PHP') throw new PaymentReconciliationError('CURRENCY_MISMATCH');
  if (!validDate(evidence.paidAt) || !validDate(evidence.providerUpdatedAt) || !validDate(now) ||
      evidence.paidAt.getTime() < binding.checkoutCreatedAt.getTime() - CLOCK_SKEW_MS ||
      evidence.paidAt.getTime() < binding.checkoutCompletedAt!.getTime() - CLOCK_SKEW_MS ||
      evidence.paidAt.getTime() > now.getTime() + CLOCK_SKEW_MS ||
      evidence.providerUpdatedAt.getTime() < evidence.paidAt.getTime() ||
      evidence.providerUpdatedAt.getTime() > now.getTime() + CLOCK_SKEW_MS ||
      binding.eventProviderCreatedAt.getTime() < evidence.paidAt.getTime() - CLOCK_SKEW_MS ||
      binding.eventProviderCreatedAt.getTime() > binding.eventReceivedAt.getTime() + CLOCK_SKEW_MS) {
    throw new PaymentReconciliationError('TIMESTAMP_INVALID');
  }
  if (binding.latestProviderUpdatedAt && evidence.providerUpdatedAt < binding.latestProviderUpdatedAt) {
    throw new PaymentReconciliationError('STALE_PROVIDER_STATE');
  }
  return { effectiveFrom: new Date(evidence.paidAt), effectiveUntil: thirtyDaysFrom(evidence.paidAt) };
}

export function validateLocalPaymentBinding(binding: PaymentProjectionBinding): void {
  if (binding.eventType !== 'checkout_session.payment.paid') throw new PaymentReconciliationError('EVENT_NOT_SUPPORTED');
  if (binding.eventLivemode || binding.priceEnvironment !== 'TEST') {
    throw new PaymentReconciliationError('LIVE_MODE_REJECTED');
  }
  if (!binding.checkoutFound || !binding.providerSessionId || !SESSION_ID.test(binding.providerSessionId)) {
    throw new PaymentReconciliationError('UNKNOWN_CHECKOUT_SESSION');
  }
  if (!binding.checkoutUserId || !binding.userEligible || !binding.billingSubjectKey) {
    throw new PaymentReconciliationError('CHECKOUT_OWNERSHIP_MISSING');
  }
  if (!HASH.test(binding.requestHash) || !ID.test(binding.referenceNumber)) {
    throw new PaymentReconciliationError('CHECKOUT_REQUEST_INVALID');
  }
  if (binding.checkoutStatus !== 'SUCCEEDED' || !validDate(binding.checkoutCompletedAt)) {
    throw new PaymentReconciliationError('CHECKOUT_NOT_COMPLETED');
  }
  if (!validDate(binding.checkoutCreatedAt) || !validDate(binding.eventProviderCreatedAt) || !validDate(binding.eventReceivedAt)) {
    throw new PaymentReconciliationError('TIMESTAMP_INVALID');
  }
  if (binding.checkoutCompletedAt.getTime() < binding.checkoutCreatedAt.getTime() - CLOCK_SKEW_MS) {
    throw new PaymentReconciliationError('TIMESTAMP_INVALID');
  }
  if (binding.productCode !== 'PREMIUM' ||
      binding.priceInterval !== 'MONTH' || binding.priceIntervalCount !== 1 || binding.priceAmountMinor <= 0) {
    throw new PaymentReconciliationError('PRICE_BINDING_MISMATCH');
  }
}
