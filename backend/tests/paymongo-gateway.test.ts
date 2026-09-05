import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingHttpRequest, BillingHttpTransport, HostedCheckoutRequest } from '../src/billing/contracts';
import { EnabledPaymongoConfig, loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import { PaymongoGateway, PaymongoGatewayError } from '../src/services/paymongo-gateway.service';

function config(): EnabledPaymongoConfig {
  const value = loadPaymongoConfig({
    NODE_ENV: 'test',
    PAYMONGO_INTEGRATION_ENABLED: 'true',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'a'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET: `whsk_${'b'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET_VERSION: 'sandbox-v1',
    PAYMONGO_CHECKOUT_SUCCESS_URL: 'https://nutrimind.example.invalid/billing/success',
    PAYMONGO_CHECKOUT_CANCEL_URL: 'https://nutrimind.example.invalid/billing/cancel',
  });
  assert.equal(value.enabled, true);
  return value as EnabledPaymongoConfig;
}

const request: HostedCheckoutRequest = {
  idempotencyKey: 'nutrimind:checkout:intent_1:v1',
  referenceNumber: 'billing_subject_opaque_1',
  item: { name: 'Premium sandbox', amountMinor: 19_900, currency: 'PHP' },
  paymentMethods: ['card', 'paymaya'],
  successUrl: 'https://nutrimind.example.invalid/billing/success',
  cancelUrl: 'https://nutrimind.example.invalid/billing/cancel',
};

const response = (overrides: Record<string, unknown> = {}) => Buffer.from(JSON.stringify({
  data: {
    id: 'cs_synthetic_checkout_123',
    type: 'checkout_session',
    attributes: {
      checkout_url: 'https://checkout.paymongo.com/synthetic-session',
      livemode: false,
      ...overrides,
    },
  },
}));

test('[TEST-086] adapter emits only fixed HTTPS v2 checkout requests with bounded transport controls', async () => {
  let captured: BillingHttpRequest | undefined;
  const transport: BillingHttpTransport = {
    async send(value) {
      captured = value;
      return { status: 200, body: response() };
    },
  };
  const result = await new PaymongoGateway(config(), transport).createHostedCheckout(request);
  assert.equal(captured?.url, 'https://api.paymongo.com/v2/checkout_sessions');
  assert.equal(captured?.redirect, 'error');
  assert.equal(captured?.timeoutMs, 5_000);
  assert.equal(captured?.maxResponseBytes, 65_536);
  assert.equal(captured?.headers['idempotency-key'], request.idempotencyKey);
  assert.equal(Buffer.from(captured!.headers.authorization.slice(6), 'base64').toString(), `${config().secretKey}:`);
  const body = JSON.parse(captured!.body);
  assert.deepEqual(body.data.attributes.payment_method_types, ['card', 'paymaya']);
  assert.equal(body.data.attributes.line_items[0].amount, 19_900);
  assert.equal(JSON.stringify(body).includes('userId'), false);
  assert.equal(result.entitlementGranted, false);
  assert.equal(result.livemode, false);
});

test('[TEST-086] adapter rejects an overridden API origin before invoking transport', async () => {
  let calls = 0;
  const unsafe = { ...config(), apiOrigin: 'https://attacker.example' } as unknown as EnabledPaymongoConfig;
  const gateway = new PaymongoGateway(unsafe, { async send() { calls += 1; throw new Error('must not run'); } });
  await assert.rejects(() => gateway.createHostedCheckout(request), (error: unknown) =>
    error instanceof PaymongoGatewayError && error.code === 'PROVIDER_CONFIGURATION_ERROR');
  assert.equal(calls, 0);
});

test('[TEST-086] adapter rejects checkout URL origin surprises and live responses', async () => {
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { return { status: 200, body: response({ checkout_url: 'https://attacker.example/session' }) }; } }).createHostedCheckout(request),
    /PROVIDER_RESPONSE_INVALID/,
  );
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { return { status: 200, body: response({ livemode: true }) }; } }).createHostedCheckout(request),
    /PROVIDER_RESPONSE_INVALID/,
  );
});

test('[TEST-086] adapter maps provider errors without retaining raw error detail', async () => {
  const sensitiveBody = Buffer.from('{"errors":[{"detail":"secret provider diagnostic"}]}');
  let caught: unknown;
  try {
    await new PaymongoGateway(config(), { async send() { return { status: 400, body: sensitiveBody }; } }).createHostedCheckout(request);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PaymongoGatewayError);
  assert.equal(caught.code, 'PROVIDER_REQUEST_REJECTED');
  assert.doesNotMatch(caught.message, /secret provider diagnostic/);
});

test('[TEST-086] adapter maps transport failures and retryable statuses to one sanitized category', async () => {
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { throw new Error('socket details'); } }).createHostedCheckout(request),
    (error: unknown) => error instanceof PaymongoGatewayError && error.code === 'PROVIDER_TEMPORARILY_UNAVAILABLE',
  );
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { return { status: 503, body: Buffer.from('provider internals') }; } }).createHostedCheckout(request),
    /PROVIDER_TEMPORARILY_UNAVAILABLE/,
  );
});

test('[TEST-086] adapter rejects oversized and malformed successful responses', async () => {
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { return { status: 200, body: Buffer.alloc(65_537) }; } }).createHostedCheckout(request),
    /PROVIDER_RESPONSE_INVALID/,
  );
  await assert.rejects(
    () => new PaymongoGateway(config(), { async send() { return { status: 200, body: Buffer.from('not json') }; } }).createHostedCheckout(request),
    /PROVIDER_RESPONSE_INVALID/,
  );
});
