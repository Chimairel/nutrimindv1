import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Request, Response } from 'express';
import {
  createPaymongoWebhookHandler,
  createPaymongoWebhookRouter,
  paymongoRawBodyErrorHandler,
  paymongoRawBodyParser,
} from '../src/routes/paymongo-webhook.routes';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '../src/services/billing-checkout-boundary.service';
import { PaymongoWebhookBoundary, WebhookBoundaryError } from '../src/services/paymongo-webhook-boundary.service';

async function loadBillingRoutes() {
  process.env.JWT_SECRET = `synthetic-${'j'.repeat(48)}`;
  process.env.JWT_REFRESH_SECRET = `synthetic-${'r'.repeat(48)}`;
  return import('../src/routes/billing.routes');
}

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { state, response };
}

test('[TEST-089] checkout route returns a stable disabled response without secret or provider detail', async () => {
  const { createCheckoutHandler } = await loadBillingRoutes();
  const service = { async create() { throw new CheckoutBoundaryError('PAYMENTS_UNAVAILABLE'); } } as unknown as BillingCheckoutBoundary;
  const handler = createCheckoutHandler(service);
  const { state, response } = responseRecorder();
  const request = {
    user: { userId: 'user_1', email: 'synthetic@example.invalid', role: 'USER' },
    body: { priceCode: 'PREMIUM' },
    header(name: string) { return name.toLowerCase() === 'idempotency-key' ? 'request-key-1234' : undefined; },
  } as unknown as Request;
  await handler(request, response, () => undefined);
  assert.equal(state.status, 503);
  assert.deepEqual(state.body, {
    success: false,
    error: 'Payments are currently unavailable.',
    errorCode: 'PAYMENTS_UNAVAILABLE',
  });
});

test('[TEST-089] successful checkout route responses explicitly deny redirect-based entitlement', async () => {
  const { createCheckoutHandler } = await loadBillingRoutes();
  const service = { async create() {
    return {
      provider: 'PAYMONGO', environment: 'TEST', providerSessionId: 'cs_synthetic_12345678',
      checkoutUrl: 'https://checkout.paymongo.com/synthetic', livemode: false, entitlementGranted: false,
    };
  } } as unknown as BillingCheckoutBoundary;
  const { state, response } = responseRecorder();
  const request = {
    user: { userId: 'user_1', email: 'synthetic@example.invalid', role: 'USER' },
    body: { priceCode: 'PREMIUM' },
    header() { return 'request-key-1234'; },
  } as unknown as Request;
  await createCheckoutHandler(service)(request, response, () => undefined);
  assert.equal(state.status, 201);
  assert.equal((state.body as { data: { entitlementGranted: boolean } }).data.entitlementGranted, false);
});

test('[TEST-089] checkout route requires an authenticated owner and request idempotency key', async () => {
  const { createCheckoutHandler } = await loadBillingRoutes();
  let calls = 0;
  const service = { async create() { calls += 1; throw new Error('must not run'); } } as unknown as BillingCheckoutBoundary;
  for (const request of [
    { user: undefined, body: { priceCode: 'PREMIUM' }, header() { return 'request-key-1234'; } },
    { user: { userId: 'user_1' }, body: { priceCode: 'PREMIUM' }, header() { return undefined; } },
  ]) {
    const { state, response } = responseRecorder();
    await createCheckoutHandler(service)(request as unknown as Request, response, () => undefined);
    assert.equal(state.status, 400);
    assert.equal((state.body as { errorCode: string }).errorCode, 'CHECKOUT_REQUEST_INVALID');
  }
  assert.equal(calls, 0);
});

test('[TEST-089] billing router orders authentication, USER authorization, and readiness before checkout', async () => {
  const { createBillingRouter } = await loadBillingRoutes();
  const noop = ((_request: Request, _response: Response, next: () => void) => next()) as never;
  const router = createBillingRouter({
    checkoutService: { async create() { throw new Error('unused'); } } as unknown as BillingCheckoutBoundary,
    authenticate: noop,
    authorizeUser: noop,
    requirePrerequisites: noop,
  });
  const stack = (router as unknown as { stack: Array<{ route?: { path: string }; name?: string }> }).stack;
  assert.equal(stack.length, 4);
  assert.equal(stack[3].route?.path, '/subscriptions');
});

test('[TEST-089] webhook route rejects non-JSON and absent raw-body authentication before service work', async () => {
  let calls = 0;
  const service = { async ingest() { calls += 1; throw new Error('must not run'); } } as unknown as PaymongoWebhookBoundary;
  for (const request of [
    { body: Buffer.from('{}'), header(name: string) { return name === 'content-type' ? 'text/plain' : 'signature'; } },
    { body: {}, header(name: string) { return name === 'content-type' ? 'application/json' : 'signature'; } },
  ]) {
    const { state, response } = responseRecorder();
    await createPaymongoWebhookHandler(service)(request as unknown as Request, response, () => undefined);
    assert.ok(state.status === 415 || state.status === 401);
  }
  assert.equal(calls, 0);
});

test('[TEST-089] webhook route maps accepted, duplicate, quarantined, and conflict outcomes safely', async () => {
  const cases = [
    [{ decision: 'INSERTED', knownEvent: true, entitlementGranted: false }, 202, 'ACCEPTED_PENDING'],
    [{ decision: 'DUPLICATE', knownEvent: true, entitlementGranted: false }, 200, 'DUPLICATE'],
    [{ decision: 'OUT_OF_ORDER', knownEvent: true, entitlementGranted: false }, 202, 'QUARANTINED'],
  ] as const;
  for (const [result, status, expectedStatus] of cases) {
    const service = { async ingest() { return result; } } as unknown as PaymongoWebhookBoundary;
    const { state, response } = responseRecorder();
    const request = {
      body: Buffer.from('{}'),
      header(name: string) { return name === 'content-type' ? 'application/json; charset=utf-8' : 'signed'; },
    } as unknown as Request;
    await createPaymongoWebhookHandler(service)(request, response, () => undefined);
    assert.equal(state.status, status);
    assert.equal((state.body as { status: string }).status, expectedStatus);
    assert.equal((state.body as { entitlementGranted: boolean }).entitlementGranted, false);
  }
  const conflict = { async ingest() { throw new WebhookBoundaryError('WEBHOOK_EVENT_CONFLICT'); } } as unknown as PaymongoWebhookBoundary;
  const { state, response } = responseRecorder();
  await createPaymongoWebhookHandler(conflict)({
    body: Buffer.from('{}'), header(name: string) { return name === 'content-type' ? 'application/json' : 'signed'; },
  } as unknown as Request, response, () => undefined);
  assert.equal(state.status, 409);
});

test('[TEST-089] raw parser is route-scoped before the webhook handler and before global JSON parsing', () => {
  const router = createPaymongoWebhookRouter({ async ingest() { throw new Error('unused'); } } as unknown as PaymongoWebhookBoundary);
  const layers = (router as unknown as { stack: Array<{ route: { stack: Array<{ handle: unknown }> } }> }).stack[0].route.stack;
  assert.equal(layers[0].handle, paymongoRawBodyParser);
  const appSource = readFileSync('src/app.ts', 'utf8');
  assert.ok(appSource.indexOf("app.use('/api/webhooks/paymongo'") < appSource.indexOf("app.use(express.json"));
});

test('[TEST-089] oversized raw-body parser failures use a sanitized 413 contract', () => {
  const { state, response } = responseRecorder();
  paymongoRawBodyErrorHandler(
    { type: 'entity.too.large', message: 'raw body detail' },
    {} as Request,
    response,
    () => undefined,
  );
  assert.equal(state.status, 413);
  assert.deepEqual(state.body, {
    success: false,
    error: 'Webhook body is too large.',
    errorCode: 'WEBHOOK_BODY_TOO_LARGE',
  });
});
