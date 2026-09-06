import { PaymongoConfig } from '@/domain/paymongo-config.policy';

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_PROVIDER_CALL_BUDGET = 10;
const DEFAULT_JITTER_MS = 1_000;

export interface DisabledBillingProcessingWorkerConfig {
  enabled: false;
}

export interface EnabledBillingProcessingWorkerConfig {
  enabled: true;
  environment: 'TEST';
  pollIntervalMs: number;
  batchSize: number;
  concurrency: number;
  providerCallBudget: number;
  jitterMs: number;
}

export type BillingProcessingWorkerConfig =
  DisabledBillingProcessingWorkerConfig | EnabledBillingProcessingWorkerConfig;

export class BillingProcessingWorkerConfigurationError extends Error {
  readonly code = 'BILLING_PROCESSING_WORKER_CONFIGURATION_INVALID';

  constructor(readonly keys: readonly string[]) {
    super(`Billing processing worker configuration is invalid for: ${keys.join(', ')}.`);
    this.name = 'BillingProcessingWorkerConfigurationError';
  }
}

function parseSwitch(env: NodeJS.ProcessEnv): boolean {
  const value = env.BILLING_PROCESSING_WORKER_ENABLED?.trim() || 'false';
  if (value !== 'true' && value !== 'false') {
    throw new BillingProcessingWorkerConfigurationError(['BILLING_PROCESSING_WORKER_ENABLED']);
  }
  return value === 'true';
}

function boundedInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
  invalid: string[]
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    invalid.push(key);
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid.push(key);
    return fallback;
  }
  return value;
}

export function loadBillingProcessingWorkerConfig(
  env: NodeJS.ProcessEnv,
  paymongoConfig: PaymongoConfig
): BillingProcessingWorkerConfig {
  if (!parseSwitch(env)) return { enabled: false };

  const invalid: string[] = [];
  if (env.NODE_ENV === 'production') invalid.push('BILLING_PROCESSING_WORKER_ENABLED');
  if (env.PAYMONGO_ENVIRONMENT !== 'TEST') invalid.push('PAYMONGO_ENVIRONMENT');
  if (!paymongoConfig.webhook.enabled) invalid.push('PAYMONGO_WEBHOOK_ENABLED');
  if (!paymongoConfig.reconciliation.enabled) invalid.push('PAYMONGO_RECONCILIATION_ENABLED');

  const pollIntervalMs = boundedInteger(
    env,
    'BILLING_PROCESSING_WORKER_POLL_INTERVAL_MS',
    DEFAULT_POLL_INTERVAL_MS,
    1_000,
    300_000,
    invalid
  );
  const batchSize = boundedInteger(env, 'BILLING_PROCESSING_WORKER_BATCH_SIZE', DEFAULT_BATCH_SIZE, 1, 50, invalid);
  const concurrency = boundedInteger(env, 'BILLING_PROCESSING_WORKER_CONCURRENCY', DEFAULT_CONCURRENCY, 1, 8, invalid);
  const providerCallBudget = boundedInteger(
    env,
    'BILLING_PROCESSING_WORKER_PROVIDER_CALL_BUDGET',
    DEFAULT_PROVIDER_CALL_BUDGET,
    1,
    50,
    invalid
  );
  const jitterMs = boundedInteger(env, 'BILLING_PROCESSING_WORKER_JITTER_MS', DEFAULT_JITTER_MS, 0, 30_000, invalid);

  if (concurrency > batchSize) invalid.push('BILLING_PROCESSING_WORKER_CONCURRENCY');
  if (providerCallBudget > batchSize) invalid.push('BILLING_PROCESSING_WORKER_PROVIDER_CALL_BUDGET');
  if (jitterMs >= pollIntervalMs) invalid.push('BILLING_PROCESSING_WORKER_JITTER_MS');
  if (invalid.length > 0) {
    throw new BillingProcessingWorkerConfigurationError([...new Set(invalid)]);
  }

  return {
    enabled: true,
    environment: 'TEST',
    pollIntervalMs,
    batchSize,
    concurrency,
    providerCallBudget,
    jitterMs,
  };
}
