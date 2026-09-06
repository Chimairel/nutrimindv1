import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAYMONGO_API_ORIGIN,
  PAYMONGO_CHECKOUT_ORIGIN,
  PaymongoConfigurationError,
  loadPaymongoConfig,
} from '../src/domain/paymongo-config.policy';

const validCheckoutEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  PAYMONGO_INTEGRATION_ENABLED: 'true',
  PAYMONGO_ENVIRONMENT: 'TEST',
  PAYMONGO_SECRET_KEY: `sk_${'test'}_${'a'.repeat(24)}`,
  PAYMONGO_CHECKOUT_PAYMENT_METHODS: 'card,paymaya',
  PAYMONGO_CHECKOUT_SUCCESS_URL: 'https://nutrimind.example.invalid/billing/success',
  PAYMONGO_CHECKOUT_CANCEL_URL: 'https://nutrimind.example.invalid/billing/cancel',
});

const validWebhookEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  PAYMONGO_WEBHOOK_ENABLED: 'true',
  PAYMONGO_ENVIRONMENT: 'TEST',
  PAYMONGO_WEBHOOK_SECRET: `whsk_${'b'.repeat(24)}`,
  PAYMONGO_WEBHOOK_SECRET_VERSION: 'sandbox-v1',
});

test('[TEST-085] PayMongo capabilities default independently to disabled without secrets', () => {
  assert.deepEqual(loadPaymongoConfig({ NODE_ENV: 'production' }), {
    environment: 'TEST',
    checkout: { enabled: false, environment: 'TEST' },
    reconciliation: { enabled: false, environment: 'TEST' },
    webhook: { enabled: false, environment: 'TEST' },
  });
});

test('[TEST-085] enabled checkout fixes origins, methods, mode, timeout, and response limit', () => {
  const config = loadPaymongoConfig(validCheckoutEnvironment());
  assert.equal(config.checkout.enabled, true);
  assert.equal(config.webhook.enabled, false);
  assert.equal(config.reconciliation.enabled, false);
  if (!config.checkout.enabled) return;
  assert.equal(config.checkout.apiOrigin, PAYMONGO_API_ORIGIN);
  assert.equal(config.checkout.checkoutOrigin, PAYMONGO_CHECKOUT_ORIGIN);
  assert.deepEqual(config.checkout.paymentMethods, ['card', 'paymaya']);
  assert.equal(config.checkout.httpTimeoutMs, 5_000);
  assert.equal(config.checkout.maxResponseBytes, 65_536);
});

test('[TEST-085] webhook capability can be enabled without checkout credentials', () => {
  const config = loadPaymongoConfig(validWebhookEnvironment());
  assert.equal(config.checkout.enabled, false);
  assert.equal(config.webhook.enabled, true);
  if (!config.webhook.enabled) return;
  assert.equal(config.webhook.webhookBodyLimitBytes, 65_536);
  assert.equal(config.webhook.signatureToleranceSeconds, 300);
});

test('[TEST-104] reconciliation can be enabled independently with only the TEST secret', () => {
  const config = loadPaymongoConfig({
    NODE_ENV: 'test', PAYMONGO_RECONCILIATION_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'r'.repeat(24)}`,
  });
  assert.equal(config.checkout.enabled, false);
  assert.equal(config.webhook.enabled, false);
  assert.equal(config.reconciliation.enabled, true);
  if (!config.reconciliation.enabled) return;
  assert.equal(config.reconciliation.apiOrigin, PAYMONGO_API_ORIGIN);
  assert.equal(config.reconciliation.httpTimeoutMs, 5_000);
  assert.equal(config.reconciliation.maxResponseBytes, 65_536);
});

test('[TEST-085] malformed switches, live mode, and production enablement fail closed', () => {
  assert.throws(() => loadPaymongoConfig({ PAYMONGO_INTEGRATION_ENABLED: 'yes' }), PaymongoConfigurationError);
  assert.throws(() => loadPaymongoConfig({ ...validCheckoutEnvironment(), PAYMONGO_ENVIRONMENT: 'LIVE' }), /PAYMONGO_ENVIRONMENT/);
  assert.throws(() => loadPaymongoConfig({ ...validCheckoutEnvironment(), NODE_ENV: 'production' }), /PAYMONGO_INTEGRATION_ENABLED/);
  assert.throws(() => loadPaymongoConfig({ ...validWebhookEnvironment(), NODE_ENV: 'production' }), /PAYMONGO_WEBHOOK_ENABLED/);
  assert.throws(() => loadPaymongoConfig({
    PAYMONGO_RECONCILIATION_ENABLED: 'true', PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'r'.repeat(24)}`, NODE_ENV: 'production',
  }), /PAYMONGO_RECONCILIATION_ENABLED/);
});

test('[TEST-085] weak keys, unsupported methods, and unsafe URLs are rejected by key name only', () => {
  const fakeSecret = `sk_${'live'}_${'sensitive-do-not-echo'}`;
  let caught: unknown;
  try {
    loadPaymongoConfig({
      ...validCheckoutEnvironment(),
      PAYMONGO_SECRET_KEY: fakeSecret,
      PAYMONGO_CHECKOUT_PAYMENT_METHODS: 'card,gcash',
      PAYMONGO_CHECKOUT_SUCCESS_URL: 'http://localhost:3000/billing/success',
      PAYMONGO_CHECKOUT_CANCEL_URL: 'https://user:password@example.invalid/cancel',
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PaymongoConfigurationError);
  assert.match(caught.message, /PAYMONGO_SECRET_KEY/);
  assert.match(caught.message, /PAYMONGO_CHECKOUT_PAYMENT_METHODS/);
  assert.match(caught.message, /PAYMONGO_CHECKOUT_SUCCESS_URL/);
  assert.doesNotMatch(caught.message, /sensitive-do-not-echo|password/);
});

test('[TEST-085] disabled capabilities ignore stale provider settings and remain inert', () => {
  assert.deepEqual(loadPaymongoConfig({
    PAYMONGO_INTEGRATION_ENABLED: 'false',
    PAYMONGO_WEBHOOK_ENABLED: 'false',
    PAYMONGO_ENVIRONMENT: 'LIVE',
    PAYMONGO_SECRET_KEY: 'stale-value',
  }), {
    environment: 'TEST',
    checkout: { enabled: false, environment: 'TEST' },
    reconciliation: { enabled: false, environment: 'TEST' },
    webhook: { enabled: false, environment: 'TEST' },
  });
});
