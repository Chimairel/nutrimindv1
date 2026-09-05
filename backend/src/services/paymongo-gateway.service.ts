import { Buffer } from 'node:buffer';
import {
  BillingGateway,
  BillingHttpRequest,
  BillingHttpTransport,
  HostedCheckoutRequest,
  HostedCheckoutSession,
} from '@/billing/contracts';
import { EnabledPaymongoConfig, PAYMONGO_API_ORIGIN } from '@/domain/paymongo-config.policy';
import { assertPositiveMoney } from '@/domain/billing-money.policy';

const CHECKOUT_PATH = '/v2/checkout_sessions';
const PROVIDER_ID_PATTERN = /^cs_[A-Za-z0-9_-]{8,191}$/;
const OUTBOUND_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$/;
const SAFE_ITEM_NAME_PATTERN = /^[^\u0000-\u001f\u007f]{1,120}$/;

export type PaymongoGatewayErrorCode =
  | 'PROVIDER_CONFIGURATION_ERROR'
  | 'PROVIDER_REQUEST_REJECTED'
  | 'PROVIDER_TEMPORARILY_UNAVAILABLE'
  | 'PROVIDER_RESPONSE_INVALID';

export class PaymongoGatewayError extends Error {
  constructor(readonly code: PaymongoGatewayErrorCode) {
    super(code);
    this.name = 'PaymongoGatewayError';
  }
}

function assertExactProviderUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.origin !== PAYMONGO_API_ORIGIN || parsed.pathname !== CHECKOUT_PATH || parsed.search || parsed.hash) {
    throw new PaymongoGatewayError('PROVIDER_CONFIGURATION_ERROR');
  }
}

function parseCheckoutResponse(body: Uint8Array, checkoutOrigin: string): HostedCheckoutSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object') throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  const data = (parsed as Record<string, unknown>).data;
  if (!data || typeof data !== 'object') throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  const record = data as Record<string, unknown>;
  const attributes = record.attributes;
  if (record.type !== 'checkout_session' || !PROVIDER_ID_PATTERN.test(String(record.id || '')) || !attributes || typeof attributes !== 'object') {
    throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  }
  const values = attributes as Record<string, unknown>;
  if (values.livemode !== false || typeof values.checkout_url !== 'string') {
    throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  }
  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(values.checkout_url);
  } catch {
    throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  }
  if (checkoutUrl.protocol !== 'https:' || checkoutUrl.origin !== checkoutOrigin || checkoutUrl.username || checkoutUrl.password) {
    throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
  }
  return {
    provider: 'PAYMONGO',
    environment: 'TEST',
    providerSessionId: String(record.id),
    checkoutUrl: checkoutUrl.toString(),
    livemode: false,
    entitlementGranted: false,
  };
}

export class PaymongoGateway implements BillingGateway {
  constructor(
    private readonly config: EnabledPaymongoConfig,
    private readonly transport: BillingHttpTransport,
  ) {}

  async createHostedCheckout(request: HostedCheckoutRequest): Promise<HostedCheckoutSession> {
    assertPositiveMoney(request.item, 'PHP');
    if (!OUTBOUND_ID_PATTERN.test(request.idempotencyKey) ||
        !OUTBOUND_ID_PATTERN.test(request.referenceNumber) ||
        !SAFE_ITEM_NAME_PATTERN.test(request.item.name) ||
        request.successUrl !== this.config.checkoutSuccessUrl ||
        request.cancelUrl !== this.config.checkoutCancelUrl ||
        request.paymentMethods.length === 0 ||
        request.paymentMethods.some((method) => method !== 'card' && method !== 'paymaya')) {
      throw new PaymongoGatewayError('PROVIDER_CONFIGURATION_ERROR');
    }
    const url = `${this.config.apiOrigin}${CHECKOUT_PATH}`;
    assertExactProviderUrl(url);
    const transportRequest: BillingHttpRequest = {
      method: 'POST',
      url,
      headers: {
        accept: 'application/json',
        authorization: `Basic ${Buffer.from(`${this.config.secretKey}:`, 'utf8').toString('base64')}`,
        'content-type': 'application/json',
        'idempotency-key': request.idempotencyKey,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              name: request.item.name,
              amount: request.item.amountMinor,
              currency: request.item.currency,
              quantity: 1,
            }],
            payment_method_types: [...request.paymentMethods],
            success_url: request.successUrl,
            cancel_url: request.cancelUrl,
            reference_number: request.referenceNumber,
          },
        },
      }),
      timeoutMs: this.config.httpTimeoutMs,
      maxResponseBytes: this.config.maxResponseBytes,
      redirect: 'error',
    };

    let response;
    try {
      response = await this.transport.send(transportRequest);
    } catch {
      throw new PaymongoGatewayError('PROVIDER_TEMPORARILY_UNAVAILABLE');
    }
    if (response.body.byteLength > this.config.maxResponseBytes) {
      throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
    }
    if (response.status === 401 || response.status === 403) {
      throw new PaymongoGatewayError('PROVIDER_CONFIGURATION_ERROR');
    }
    if (response.status === 400 || response.status === 409 || response.status === 422) {
      throw new PaymongoGatewayError('PROVIDER_REQUEST_REJECTED');
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new PaymongoGatewayError('PROVIDER_TEMPORARILY_UNAVAILABLE');
    }
    if (response.status < 200 || response.status > 209) {
      throw new PaymongoGatewayError('PROVIDER_RESPONSE_INVALID');
    }
    return parseCheckoutResponse(response.body, this.config.checkoutOrigin);
  }
}
