import { PaymongoPaymentMethod } from '@/billing/contracts';

export const PAYMONGO_API_ORIGIN = 'https://api.paymongo.com' as const;
export const PAYMONGO_CHECKOUT_ORIGIN = 'https://checkout.paymongo.com' as const;
export const PAYMONGO_HTTP_TIMEOUT_MS = 5_000;
export const PAYMONGO_MAX_RESPONSE_BYTES = 64 * 1024;
export const PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES = 64 * 1024;
export const PAYMONGO_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const SECRET_KEY_PATTERN = /^sk_test_[A-Za-z0-9_-]{24,247}$/;
const WEBHOOK_SECRET_PATTERN = /^whsk_[A-Za-z0-9_-]{24,250}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ALLOWED_PAYMENT_METHODS = new Set<PaymongoPaymentMethod>(['card', 'paymaya']);

export interface DisabledPaymongoCheckoutConfig {
  enabled: false;
  environment: 'TEST';
}

export interface EnabledPaymongoCheckoutConfig {
  enabled: true;
  environment: 'TEST';
  apiOrigin: typeof PAYMONGO_API_ORIGIN;
  checkoutOrigin: typeof PAYMONGO_CHECKOUT_ORIGIN;
  secretKey: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  paymentMethods: readonly PaymongoPaymentMethod[];
  httpTimeoutMs: typeof PAYMONGO_HTTP_TIMEOUT_MS;
  maxResponseBytes: typeof PAYMONGO_MAX_RESPONSE_BYTES;
}

export type PaymongoCheckoutConfig = DisabledPaymongoCheckoutConfig | EnabledPaymongoCheckoutConfig;

export interface DisabledPaymongoReconciliationConfig {
  enabled: false;
  environment: 'TEST';
}

export interface EnabledPaymongoReconciliationConfig {
  enabled: true;
  environment: 'TEST';
  apiOrigin: typeof PAYMONGO_API_ORIGIN;
  secretKey: string;
  httpTimeoutMs: typeof PAYMONGO_HTTP_TIMEOUT_MS;
  maxResponseBytes: typeof PAYMONGO_MAX_RESPONSE_BYTES;
}

export type PaymongoReconciliationConfig = DisabledPaymongoReconciliationConfig | EnabledPaymongoReconciliationConfig;

export interface DisabledPaymongoWebhookConfig {
  enabled: false;
  environment: 'TEST';
}

export interface EnabledPaymongoWebhookConfig {
  enabled: true;
  environment: 'TEST';
  webhookSecret: string;
  webhookSecretVersion: string;
  webhookBodyLimitBytes: typeof PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES;
  signatureToleranceSeconds: typeof PAYMONGO_SIGNATURE_TOLERANCE_SECONDS;
}

export type PaymongoWebhookConfig = DisabledPaymongoWebhookConfig | EnabledPaymongoWebhookConfig;

export interface PaymongoConfig {
  environment: 'TEST';
  checkout: PaymongoCheckoutConfig;
  reconciliation: PaymongoReconciliationConfig;
  webhook: PaymongoWebhookConfig;
}

export class PaymongoConfigurationError extends Error {
  readonly code = 'PAYMONGO_CONFIGURATION_INVALID';

  constructor(readonly keys: readonly string[]) {
    super(`PayMongo configuration is invalid for: ${keys.join(', ')}.`);
    this.name = 'PaymongoConfigurationError';
  }
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password && !parsed.hash
    );
  } catch {
    return false;
  }
}

function parseSwitch(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = env[key]?.trim() || 'false';
  if (value !== 'true' && value !== 'false') throw new PaymongoConfigurationError([key]);
  return value === 'true';
}

function parsePaymentMethods(value: string): readonly PaymongoPaymentMethod[] | null {
  const methods = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    methods.length === 0 ||
    new Set(methods).size !== methods.length ||
    methods.some((method) => !ALLOWED_PAYMENT_METHODS.has(method as PaymongoPaymentMethod))
  ) {
    return null;
  }
  return methods as PaymongoPaymentMethod[];
}

export function loadPaymongoConfig(env: NodeJS.ProcessEnv): PaymongoConfig {
  const checkoutEnabled = parseSwitch(env, 'PAYMONGO_INTEGRATION_ENABLED');
  const reconciliationEnabled = parseSwitch(env, 'PAYMONGO_RECONCILIATION_ENABLED');
  const webhookEnabled = parseSwitch(env, 'PAYMONGO_WEBHOOK_ENABLED');
  if (!checkoutEnabled && !reconciliationEnabled && !webhookEnabled) {
    return {
      environment: 'TEST',
      checkout: { enabled: false, environment: 'TEST' },
      reconciliation: { enabled: false, environment: 'TEST' },
      webhook: { enabled: false, environment: 'TEST' },
    };
  }

  const invalid: string[] = [];
  if (env.NODE_ENV === 'production') {
    if (checkoutEnabled) invalid.push('PAYMONGO_INTEGRATION_ENABLED');
    if (reconciliationEnabled) invalid.push('PAYMONGO_RECONCILIATION_ENABLED');
    if (webhookEnabled) invalid.push('PAYMONGO_WEBHOOK_ENABLED');
  }
  if (env.PAYMONGO_ENVIRONMENT !== 'TEST') invalid.push('PAYMONGO_ENVIRONMENT');

  let checkout: PaymongoCheckoutConfig = { enabled: false, environment: 'TEST' };
  if (checkoutEnabled) {
    const secretKey = env.PAYMONGO_SECRET_KEY?.trim() || '';
    const checkoutSuccessUrl = env.PAYMONGO_CHECKOUT_SUCCESS_URL?.trim() || '';
    const checkoutCancelUrl = env.PAYMONGO_CHECKOUT_CANCEL_URL?.trim() || '';
    const paymentMethods = parsePaymentMethods(env.PAYMONGO_CHECKOUT_PAYMENT_METHODS?.trim() || '');
    if (!SECRET_KEY_PATTERN.test(secretKey)) invalid.push('PAYMONGO_SECRET_KEY');
    if (!isSafeHttpsUrl(checkoutSuccessUrl)) invalid.push('PAYMONGO_CHECKOUT_SUCCESS_URL');
    if (!isSafeHttpsUrl(checkoutCancelUrl)) invalid.push('PAYMONGO_CHECKOUT_CANCEL_URL');
    if (!paymentMethods) invalid.push('PAYMONGO_CHECKOUT_PAYMENT_METHODS');
    if (invalid.length === 0) {
      checkout = {
        enabled: true,
        environment: 'TEST',
        apiOrigin: PAYMONGO_API_ORIGIN,
        checkoutOrigin: PAYMONGO_CHECKOUT_ORIGIN,
        secretKey,
        checkoutSuccessUrl,
        checkoutCancelUrl,
        paymentMethods: paymentMethods!,
        httpTimeoutMs: PAYMONGO_HTTP_TIMEOUT_MS,
        maxResponseBytes: PAYMONGO_MAX_RESPONSE_BYTES,
      };
    }
  }

  let reconciliation: PaymongoReconciliationConfig = { enabled: false, environment: 'TEST' };
  if (reconciliationEnabled) {
    const secretKey = env.PAYMONGO_SECRET_KEY?.trim() || '';
    if (!SECRET_KEY_PATTERN.test(secretKey)) invalid.push('PAYMONGO_SECRET_KEY');
    if (invalid.length === 0) {
      reconciliation = {
        enabled: true,
        environment: 'TEST',
        apiOrigin: PAYMONGO_API_ORIGIN,
        secretKey,
        httpTimeoutMs: PAYMONGO_HTTP_TIMEOUT_MS,
        maxResponseBytes: PAYMONGO_MAX_RESPONSE_BYTES,
      };
    }
  }

  let webhook: PaymongoWebhookConfig = { enabled: false, environment: 'TEST' };
  if (webhookEnabled) {
    const webhookSecret = env.PAYMONGO_WEBHOOK_SECRET?.trim() || '';
    const webhookSecretVersion = env.PAYMONGO_WEBHOOK_SECRET_VERSION?.trim() || '';
    if (!WEBHOOK_SECRET_PATTERN.test(webhookSecret)) invalid.push('PAYMONGO_WEBHOOK_SECRET');
    if (!VERSION_PATTERN.test(webhookSecretVersion)) invalid.push('PAYMONGO_WEBHOOK_SECRET_VERSION');
    if (invalid.length === 0) {
      webhook = {
        enabled: true,
        environment: 'TEST',
        webhookSecret,
        webhookSecretVersion,
        webhookBodyLimitBytes: PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES,
        signatureToleranceSeconds: PAYMONGO_SIGNATURE_TOLERANCE_SECONDS,
      };
    }
  }

  if (invalid.length > 0) throw new PaymongoConfigurationError([...new Set(invalid)]);
  return { environment: 'TEST', checkout, reconciliation, webhook };
}
