import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  BillingHttpRequest,
  BillingHttpTransport,
  CheckoutReconciliationGatewayError,
} from '../src/billing/contracts';
import { EnabledPaymongoReconciliationConfig, loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import {
  PaymongoReconciliationGateway,
  parsePaymongoCheckoutReconciliation,
} from '../src/services/paymongo-reconciliation-gateway.service';
import { BillingHttpResponseTooLargeError } from '../src/services/node-https-billing.transport';

const SESSION = 'cs_reconcile_12345678';

function config(): EnabledPaymongoReconciliationConfig {
  const loaded = loadPaymongoConfig({
    NODE_ENV: 'test', PAYMONGO_RECONCILIATION_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'r'.repeat(24)}`,
  });
  assert.equal(loaded.reconciliation.enabled, true);
  return loaded.reconciliation as EnabledPaymongoReconciliationConfig;
}

function response(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({
    data: {
      id: SESSION, type: 'checkout_session',
      attributes: {
        livemode: false, status: 'active', reference_number: 'nmco_reconcile_12345678',
        ignored_private_shape: { discard: true },
        payments: [{
          id: 'pay_reconcile_12345678', type: 'payment', attributes: {
            amount: 19_900, currency: 'PHP', livemode: false, status: 'paid',
            payment_intent_id: 'pi_reconcile_12345678', paid_at: 1_800_000_000, updated_at: 1_800_000_001,
          },
        }],
        payment_intent: {
          id: 'pi_reconcile_12345678', type: 'payment_intent', attributes: {
            amount: 19_900, currency: 'PHP', livemode: false, status: 'succeeded', updated_at: 1_800_000_001,
          },
        },
        ...overrides,
      },
    },
  }));
}

function transport(body = response(), status = 200, contentType = 'application/json; charset=utf-8') {
  let captured: BillingHttpRequest | undefined;
  let calls = 0;
  const adapter: BillingHttpTransport = {
    async send(request) {
      calls += 1;
      captured = request;
      return { status, body, headers: { 'content-type': contentType } };
    },
  };
  return { adapter, state: () => ({ captured, calls }) };
}

function errorCode(error: unknown, code: string, retryable: boolean): boolean {
  return error instanceof CheckoutReconciliationGatewayError && error.code === code && error.retryable === retryable;
}

test('[TEST-104] reconciliation uses one fixed GET v1 request with secret Basic auth and bounded transport', async () => {
  const fake = transport();
  const result = await new PaymongoReconciliationGateway(config(), fake.adapter).retrieveCheckoutSession(SESSION);
  const request = fake.state().captured!;
  assert.equal(fake.state().calls, 1);
  assert.equal(request.method, 'GET');
  assert.equal(request.url, `https://api.paymongo.com/v1/checkout_sessions/${SESSION}`);
  assert.equal(request.body, '');
  assert.equal(request.redirect, 'error');
  assert.equal(request.timeoutMs, 5_000);
  assert.equal(request.maxResponseBytes, 65_536);
  assert.equal(Buffer.from(request.headers.authorization.slice(6), 'base64').toString(), `${config().secretKey}:`);
  assert.deepEqual(Object.keys(result).sort(), [
    'amountMinor', 'currency', 'environment', 'livemode', 'paidAt', 'paymentIntentStatus', 'paymentStatus',
    'provider', 'providerPaymentId', 'providerPaymentIntentId', 'providerSessionId', 'providerUpdatedAt', 'referenceNumber',
  ].sort());
  assert.doesNotMatch(JSON.stringify(result), /ignored_private_shape|discard|authorization|billing|card/i);
});

test('[TEST-104] parser requires exact session, TEST mode, one paid payment, and succeeded matching intent', () => {
  assert.throws(() => parsePaymongoCheckoutReconciliation(response(), 'cs_different_12345678'),
    (error: unknown) => errorCode(error, 'PROVIDER_SESSION_MISMATCH', false));
  assert.throws(() => parsePaymongoCheckoutReconciliation(response({ livemode: true }), SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_LIVE_MODE_REJECTED', false));
  assert.throws(() => parsePaymongoCheckoutReconciliation(response({ payments: [] }), SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_PAYMENT_NOT_SUCCEEDED', false));
  assert.throws(() => parsePaymongoCheckoutReconciliation(response({
    payment_intent: { id: 'pi_reconcile_12345678', type: 'payment_intent', attributes: {
      amount: 19_900, currency: 'PHP', livemode: false, status: 'processing',
    } },
  }), SESSION), (error: unknown) => errorCode(error, 'PROVIDER_PAYMENT_NOT_SUCCEEDED', false));
});

test('[TEST-104] parser rejects malformed, hostile, contradictory, and oversized success responses', async () => {
  assert.throws(() => parsePaymongoCheckoutReconciliation(Buffer.from('not-json'), SESSION), /PROVIDER_RESPONSE_INVALID/);
  assert.throws(() => parsePaymongoCheckoutReconciliation(response({ reference_number: 'bad value' }), SESSION), /PROVIDER_RESPONSE_INVALID/);
  assert.throws(() => parsePaymongoCheckoutReconciliation(response({ payments: [
    { id: 'pay_reconcile_12345678', type: 'payment', attributes: {
      amount: 19_900, currency: 'USD', livemode: false, status: 'paid', payment_intent_id: 'pi_reconcile_12345678',
      paid_at: 1_800_000_000, updated_at: 1_800_000_001,
    } },
  ] }), SESSION), /PROVIDER_RESPONSE_INVALID/);
  const oversized = transport(Buffer.alloc(65_537));
  await assert.rejects(() => new PaymongoReconciliationGateway(config(), oversized.adapter).retrieveCheckoutSession(SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_RESPONSE_INVALID', false));
});

test('[TEST-104] authentication, unknown session, rejection, and transient failures have stable sanitized classes', async () => {
  for (const [status, code, retryable] of [
    [401, 'PROVIDER_AUTHENTICATION_FAILED', false], [403, 'PROVIDER_AUTHENTICATION_FAILED', false],
    [404, 'PROVIDER_CHECKOUT_NOT_FOUND', false], [422, 'PROVIDER_REQUEST_REJECTED', false],
    [408, 'PROVIDER_TEMPORARILY_UNAVAILABLE', true], [429, 'PROVIDER_TEMPORARILY_UNAVAILABLE', true],
    [503, 'PROVIDER_TEMPORARILY_UNAVAILABLE', true],
  ] as const) {
    const fake = transport(Buffer.from('{"private":"discard"}'), status);
    await assert.rejects(
      () => new PaymongoReconciliationGateway(config(), fake.adapter).retrieveCheckoutSession(SESSION),
      (error: unknown) => errorCode(error, code, retryable) && !String((error as Error).message).includes('discard'),
    );
  }
  const failedTransport: BillingHttpTransport = { async send() { throw new Error('private socket detail'); } };
  await assert.rejects(
    () => new PaymongoReconciliationGateway(config(), failedTransport).retrieveCheckoutSession(SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_TEMPORARILY_UNAVAILABLE', true),
  );
  const oversizedTransport: BillingHttpTransport = { async send() { throw new BillingHttpResponseTooLargeError(); } };
  await assert.rejects(
    () => new PaymongoReconciliationGateway(config(), oversizedTransport).retrieveCheckoutSession(SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_RESPONSE_INVALID', false),
  );
});

test('[TEST-104] unsafe origin, malformed ID, and non-JSON content fail before usable evidence', async () => {
  let calls = 0;
  const fake: BillingHttpTransport = { async send() { calls += 1; return { status: 200, body: response() }; } };
  const unsafe = { ...config(), apiOrigin: 'https://attacker.example' } as unknown as EnabledPaymongoReconciliationConfig;
  await assert.rejects(() => new PaymongoReconciliationGateway(unsafe, fake).retrieveCheckoutSession(SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_REQUEST_REJECTED', false));
  await assert.rejects(() => new PaymongoReconciliationGateway(config(), fake).retrieveCheckoutSession('../escape'),
    (error: unknown) => errorCode(error, 'PROVIDER_REQUEST_REJECTED', false));
  assert.equal(calls, 0);
  const wrongType = transport(response(), 200, 'text/html');
  await assert.rejects(() => new PaymongoReconciliationGateway(config(), wrongType.adapter).retrieveCheckoutSession(SESSION),
    (error: unknown) => errorCode(error, 'PROVIDER_RESPONSE_INVALID', false));
});

test('[TEST-104] runtime composition stays behind independent reconciliation and worker switches', () => {
  const sourceRoot = join(process.cwd(), 'src');
  const runtime = readFileSync(join(sourceRoot, 'billing', 'runtime.ts'), 'utf8');
  assert.match(runtime, /paymongoConfig\.reconciliation\.enabled/);
  assert.match(runtime, /new PaymongoReconciliationGateway\(/);
  assert.match(runtime, /new PaymongoPaymentProjectionService\(/);

  const nonWorkerSource = [
    readFileSync(join(sourceRoot, 'app.ts'), 'utf8'),
    readFileSync(join(sourceRoot, 'services', 'cron.service.ts'), 'utf8'),
    ...readdirSync(join(sourceRoot, 'routes'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(join(sourceRoot, 'routes', name), 'utf8')),
  ].join('\n');
  assert.doesNotMatch(nonWorkerSource, /paymongoPaymentProjectionProcessor|PaymongoReconciliationGateway/);
  const server = readFileSync(join(sourceRoot, 'server.ts'), 'utf8');
  assert.match(server, /billingProcessingWorker\.start\(\)/);
  assert.match(server, /billingProcessingWorker\.stop\(\)/);
  assert.doesNotMatch(server, /CronService/);
});

test('[TEST-126] reconciliation cancellation reaches the bounded transport request', async () => {
  const controller = new AbortController();
  const fake = transport();
  await new PaymongoReconciliationGateway(config(), fake.adapter).retrieveCheckoutSession(SESSION, controller.signal);
  assert.equal(fake.state().captured?.signal, controller.signal);
});
