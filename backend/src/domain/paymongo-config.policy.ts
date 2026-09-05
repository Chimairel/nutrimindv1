export const PAYMONGO_API_ORIGIN = 'https://api.paymongo.com' as const;
export const PAYMONGO_CHECKOUT_ORIGIN = 'https://checkout.paymongo.com' as const;
export const PAYMONGO_HTTP_TIMEOUT_MS = 5_000;
export const PAYMONGO_MAX_RESPONSE_BYTES = 64 * 1024;
export const PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES = 64 * 1024;
export const PAYMONGO_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const SECRET_KEY_PATTERN = /^sk_test_[A-Za-z0-9_-]{24,247}$/;
const WEBHOOK_SECRET_PATTERN = /^whsk_[A-Za-z0-9_-]{24,250}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface DisabledPaymongoConfig {
  enabled: false;
  environment: 'TEST';
}

export interface EnabledPaymongoConfig {
  enabled: true;
  environment: 'TEST';
  apiOrigin: typeof PAYMONGO_API_ORIGIN;
  checkoutOrigin: typeof PAYMONGO_CHECKOUT_ORIGIN;
  secretKey: string;
  webhookSecret: string;
  webhookSecretVersion: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  httpTimeoutMs: typeof PAYMONGO_HTTP_TIMEOUT_MS;
  maxResponseBytes: typeof PAYMONGO_MAX_RESPONSE_BYTES;
  webhookBodyLimitBytes: typeof PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES;
  signatureToleranceSeconds: typeof PAYMONGO_SIGNATURE_TOLERANCE_SECONDS;
}

export type PaymongoConfig = DisabledPaymongoConfig | EnabledPaymongoConfig;

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
    return parsed.protocol === 'https:' &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash;
  } catch {
    return false;
  }
}

export function loadPaymongoConfig(env: NodeJS.ProcessEnv): PaymongoConfig {
  const enabledValue = env.PAYMONGO_INTEGRATION_ENABLED?.trim() || 'false';
  if (enabledValue !== 'true' && enabledValue !== 'false') {
    throw new PaymongoConfigurationError(['PAYMONGO_INTEGRATION_ENABLED']);
  }
  if (enabledValue === 'false') return { enabled: false, environment: 'TEST' };

  const invalid: string[] = [];
  if (env.NODE_ENV === 'production') invalid.push('PAYMONGO_INTEGRATION_ENABLED');
  if (env.PAYMONGO_ENVIRONMENT !== 'TEST') invalid.push('PAYMONGO_ENVIRONMENT');

  const secretKey = env.PAYMONGO_SECRET_KEY?.trim() || '';
  const webhookSecret = env.PAYMONGO_WEBHOOK_SECRET?.trim() || '';
  const webhookSecretVersion = env.PAYMONGO_WEBHOOK_SECRET_VERSION?.trim() || '';
  const checkoutSuccessUrl = env.PAYMONGO_CHECKOUT_SUCCESS_URL?.trim() || '';
  const checkoutCancelUrl = env.PAYMONGO_CHECKOUT_CANCEL_URL?.trim() || '';

  if (!SECRET_KEY_PATTERN.test(secretKey)) invalid.push('PAYMONGO_SECRET_KEY');
  if (!WEBHOOK_SECRET_PATTERN.test(webhookSecret)) invalid.push('PAYMONGO_WEBHOOK_SECRET');
  if (!VERSION_PATTERN.test(webhookSecretVersion)) invalid.push('PAYMONGO_WEBHOOK_SECRET_VERSION');
  if (!isSafeHttpsUrl(checkoutSuccessUrl)) invalid.push('PAYMONGO_CHECKOUT_SUCCESS_URL');
  if (!isSafeHttpsUrl(checkoutCancelUrl)) invalid.push('PAYMONGO_CHECKOUT_CANCEL_URL');

  if (invalid.length > 0) throw new PaymongoConfigurationError([...new Set(invalid)]);

  return {
    enabled: true,
    environment: 'TEST',
    apiOrigin: PAYMONGO_API_ORIGIN,
    checkoutOrigin: PAYMONGO_CHECKOUT_ORIGIN,
    secretKey,
    webhookSecret,
    webhookSecretVersion,
    checkoutSuccessUrl,
    checkoutCancelUrl,
    httpTimeoutMs: PAYMONGO_HTTP_TIMEOUT_MS,
    maxResponseBytes: PAYMONGO_MAX_RESPONSE_BYTES,
    webhookBodyLimitBytes: PAYMONGO_WEBHOOK_BODY_LIMIT_BYTES,
    signatureToleranceSeconds: PAYMONGO_SIGNATURE_TOLERANCE_SECONDS,
  };
}
