import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAYMONGO_API_ORIGIN,
  PAYMONGO_CHECKOUT_ORIGIN,
  PaymongoConfigurationError,
  loadPaymongoConfig,
} from '../src/domain/paymongo-config.policy';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  PAYMONGO_INTEGRATION_ENABLED: 'true',
  PAYMONGO_ENVIRONMENT: 'TEST',
  PAYMONGO_SECRET_KEY: `sk_${'test'}_${'a'.repeat(24)}`,
  PAYMONGO_WEBHOOK_SECRET: `whsk_${'b'.repeat(24)}`,
  PAYMONGO_WEBHOOK_SECRET_VERSION: 'sandbox-v1',
  PAYMONGO_CHECKOUT_SUCCESS_URL: 'https://nutrimind.example.invalid/billing/success',
  PAYMONGO_CHECKOUT_CANCEL_URL: 'https://nutrimind.example.invalid/billing/cancel',
});

test('[TEST-085] PayMongo integration defaults to disabled without requiring secrets', () => {
  assert.deepEqual(loadPaymongoConfig({ NODE_ENV: 'production' }), { enabled: false, environment: 'TEST' });
});

test('[TEST-085] enabled sandbox configuration fixes origins, mode, timeouts, and limits', () => {
  const config = loadPaymongoConfig(validEnvironment());
  assert.equal(config.enabled, true);
  if (!config.enabled) return;
  assert.equal(config.environment, 'TEST');
  assert.equal(config.apiOrigin, PAYMONGO_API_ORIGIN);
  assert.equal(config.checkoutOrigin, PAYMONGO_CHECKOUT_ORIGIN);
  assert.equal(config.httpTimeoutMs, 5_000);
  assert.equal(config.maxResponseBytes, 65_536);
  assert.equal(config.webhookBodyLimitBytes, 65_536);
  assert.equal(config.signatureToleranceSeconds, 300);
});

test('[TEST-085] malformed enable switches and live mode fail closed', () => {
  assert.throws(() => loadPaymongoConfig({ PAYMONGO_INTEGRATION_ENABLED: 'yes' }), PaymongoConfigurationError);
  assert.throws(() => loadPaymongoConfig({ ...validEnvironment(), PAYMONGO_ENVIRONMENT: 'LIVE' }), /PAYMONGO_ENVIRONMENT/);
});

test('[TEST-085] production cannot enable the sandbox-only Phase 3A boundary', () => {
  assert.throws(
    () => loadPaymongoConfig({ ...validEnvironment(), NODE_ENV: 'production' }),
    /PAYMONGO_INTEGRATION_ENABLED/,
  );
});

test('[TEST-085] missing, weak, placeholder, or unsafe URL configuration is rejected by key name only', () => {
  const fakeSecret = `sk_${'live'}_${'sensitive-do-not-echo'}`;
  let caught: unknown;
  try {
    loadPaymongoConfig({
      ...validEnvironment(),
      PAYMONGO_SECRET_KEY: fakeSecret,
      PAYMONGO_WEBHOOK_SECRET: 'placeholder',
      PAYMONGO_CHECKOUT_SUCCESS_URL: 'http://localhost:3000/billing/success',
      PAYMONGO_CHECKOUT_CANCEL_URL: 'https://user:password@example.invalid/cancel',
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof PaymongoConfigurationError);
  assert.match(caught.message, /PAYMONGO_SECRET_KEY/);
  assert.match(caught.message, /PAYMONGO_WEBHOOK_SECRET/);
  assert.match(caught.message, /PAYMONGO_CHECKOUT_SUCCESS_URL/);
  assert.doesNotMatch(caught.message, /sensitive-do-not-echo|password/);
});

test('[TEST-085] disabled mode ignores stale provider settings and remains inert', () => {
  assert.deepEqual(loadPaymongoConfig({
    PAYMONGO_INTEGRATION_ENABLED: 'false',
    PAYMONGO_ENVIRONMENT: 'LIVE',
    PAYMONGO_SECRET_KEY: 'stale-value',
  }), { enabled: false, environment: 'TEST' });
});
