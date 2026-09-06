import { Buffer } from 'node:buffer';
import {
  BillingHttpRequest,
  BillingHttpTransport,
  CheckoutReconciliationGateway,
  CheckoutReconciliationGatewayError,
  ReconciledPaymongoCheckout,
} from '@/billing/contracts';
import { EnabledPaymongoReconciliationConfig, PAYMONGO_API_ORIGIN } from '@/domain/paymongo-config.policy';
import { BillingHttpResponseTooLargeError } from '@/services/node-https-billing.transport';

const SESSION_ID = /^cs_[A-Za-z0-9_-]{8,188}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9_-]{8,187}$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9_-]{8,188}$/;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,190}$/;
const RETRIEVAL_PREFIX = '/v1/checkout_sessions/';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponse();
  }
  return value as JsonObject;
}

function invalidResponse(): CheckoutReconciliationGatewayError {
  return new CheckoutReconciliationGatewayError('PROVIDER_RESPONSE_INVALID', false);
}

function epochSeconds(value: unknown): Date {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 4_102_444_800) throw invalidResponse();
  return new Date(Number(value) * 1_000);
}

function assertRetrievalUrl(url: string, sessionId: string): void {
  const parsed = new URL(url);
  if (
    parsed.origin !== PAYMONGO_API_ORIGIN ||
    parsed.pathname !== `${RETRIEVAL_PREFIX}${sessionId}` ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new CheckoutReconciliationGatewayError('PROVIDER_REQUEST_REJECTED', false);
  }
}

export function parsePaymongoCheckoutReconciliation(
  body: Uint8Array,
  requestedSessionId: string
): ReconciledPaymongoCheckout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw invalidResponse();
  }
  const data = object(object(parsed).data);
  if (data.type !== 'checkout_session' || typeof data.id !== 'string' || !SESSION_ID.test(data.id))
    throw invalidResponse();
  if (data.id !== requestedSessionId) {
    throw new CheckoutReconciliationGatewayError('PROVIDER_SESSION_MISMATCH', false);
  }
  const attributes = object(data.attributes);
  if (attributes.livemode !== false) {
    throw new CheckoutReconciliationGatewayError('PROVIDER_LIVE_MODE_REJECTED', false);
  }
  if (
    !REFERENCE.test(String(attributes.reference_number || '')) ||
    (attributes.status !== 'active' && attributes.status !== 'expired') ||
    !Array.isArray(attributes.payments)
  ) {
    throw invalidResponse();
  }
  const paidPayments = attributes.payments.filter((value) => {
    try {
      return object(object(value).attributes).status === 'paid';
    } catch {
      return false;
    }
  });
  if (paidPayments.length === 0) {
    throw new CheckoutReconciliationGatewayError('PROVIDER_PAYMENT_NOT_SUCCEEDED', false);
  }
  if (paidPayments.length !== 1) throw invalidResponse();
  const payment = object(paidPayments[0]);
  const paymentAttributes = object(payment.attributes);
  const intent = object(attributes.payment_intent);
  const intentAttributes = object(intent.attributes);
  if (
    payment.type !== 'payment' ||
    typeof payment.id !== 'string' ||
    !PAYMENT_ID.test(payment.id) ||
    intent.type !== 'payment_intent' ||
    typeof intent.id !== 'string' ||
    !PAYMENT_INTENT_ID.test(intent.id) ||
    paymentAttributes.livemode !== false ||
    intentAttributes.livemode !== false ||
    paymentAttributes.status !== 'paid' ||
    paymentAttributes.payment_intent_id !== intent.id ||
    !Number.isSafeInteger(paymentAttributes.amount) ||
    Number(paymentAttributes.amount) <= 0 ||
    paymentAttributes.currency !== 'PHP' ||
    intentAttributes.amount !== paymentAttributes.amount ||
    intentAttributes.currency !== paymentAttributes.currency
  ) {
    throw invalidResponse();
  }
  if (intentAttributes.status !== 'succeeded') {
    throw new CheckoutReconciliationGatewayError('PROVIDER_PAYMENT_NOT_SUCCEEDED', false);
  }
  return {
    provider: 'PAYMONGO',
    environment: 'TEST',
    livemode: false,
    providerSessionId: data.id,
    referenceNumber: String(attributes.reference_number),
    paymentStatus: 'PAID',
    paymentIntentStatus: 'SUCCEEDED',
    providerPaymentIntentId: intent.id,
    providerPaymentId: payment.id,
    amountMinor: Number(paymentAttributes.amount),
    currency: 'PHP',
    paidAt: epochSeconds(paymentAttributes.paid_at),
    providerUpdatedAt: epochSeconds(paymentAttributes.updated_at),
  };
}

export class PaymongoReconciliationGateway implements CheckoutReconciliationGateway {
  constructor(
    private readonly config: EnabledPaymongoReconciliationConfig,
    private readonly transport: BillingHttpTransport
  ) {}

  async retrieveCheckoutSession(providerSessionId: string, signal?: AbortSignal): Promise<ReconciledPaymongoCheckout> {
    if (!SESSION_ID.test(providerSessionId)) {
      throw new CheckoutReconciliationGatewayError('PROVIDER_REQUEST_REJECTED', false);
    }
    const url = `${this.config.apiOrigin}${RETRIEVAL_PREFIX}${providerSessionId}`;
    assertRetrievalUrl(url, providerSessionId);
    const request: BillingHttpRequest = {
      method: 'GET',
      url,
      headers: {
        accept: 'application/json',
        authorization: `Basic ${Buffer.from(`${this.config.secretKey}:`, 'utf8').toString('base64')}`,
      },
      body: '',
      timeoutMs: this.config.httpTimeoutMs,
      maxResponseBytes: this.config.maxResponseBytes,
      redirect: 'error',
      signal,
    };
    let response;
    try {
      response = await this.transport.send(request);
    } catch (error) {
      if (error instanceof BillingHttpResponseTooLargeError) throw invalidResponse();
      throw new CheckoutReconciliationGatewayError('PROVIDER_TEMPORARILY_UNAVAILABLE', true);
    }
    if (response.body.byteLength > this.config.maxResponseBytes) throw invalidResponse();
    if (response.status === 401 || response.status === 403) {
      throw new CheckoutReconciliationGatewayError('PROVIDER_AUTHENTICATION_FAILED', false);
    }
    if (response.status === 404) throw new CheckoutReconciliationGatewayError('PROVIDER_CHECKOUT_NOT_FOUND', false);
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new CheckoutReconciliationGatewayError('PROVIDER_TEMPORARILY_UNAVAILABLE', true);
    }
    if (response.status !== 200) throw new CheckoutReconciliationGatewayError('PROVIDER_REQUEST_REJECTED', false);
    const contentType = response.headers?.['content-type'] || '';
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw invalidResponse();
    return parsePaymongoCheckoutReconciliation(response.body, providerSessionId);
  }
}
