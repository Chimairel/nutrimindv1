import { CLINICAL_NUTRITION_POLICY_VERSION } from './clinical-nutrition.policy';

const PLACEHOLDER_PATTERN = /^(change|replace|example|your_|password|secret)/i;

export interface ProductionConfigIssue {
  key: string;
  reason: string;
}

export function validateProductionConfig(env: NodeJS.ProcessEnv): ProductionConfigIssue[] {
  if (env.NODE_ENV !== 'production') return [];
  const issues: ProductionConfigIssue[] = [];
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET', 'CORS_ORIGINS', 'CLINICAL_POLICY_APPROVED_VERSION'];
  for (const key of required) {
    const value = env[key]?.trim();
    if (!value) issues.push({ key, reason: 'is required in production' });
    else if (PLACEHOLDER_PATTERN.test(value)) issues.push({ key, reason: 'still contains a placeholder value' });
  }
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET']) {
    const value = env[key]?.trim();
    if (value && value.length < 32) issues.push({ key, reason: 'must contain at least 32 characters' });
  }
  if (env.CORS_ORIGINS?.split(',').some((origin) => origin.trim() === '*')) {
    issues.push({ key: 'CORS_ORIGINS', reason: 'must not allow wildcard origins with credentials' });
  }
  if (
    env.CLINICAL_POLICY_APPROVED_VERSION &&
    env.CLINICAL_POLICY_APPROVED_VERSION !== CLINICAL_NUTRITION_POLICY_VERSION
  ) {
    issues.push({
      key: 'CLINICAL_POLICY_APPROVED_VERSION',
      reason: `must exactly match ${CLINICAL_NUTRITION_POLICY_VERSION}`,
    });
  }
  return issues;
}

export function assertProductionConfig(env: NodeJS.ProcessEnv): void {
  const issues = validateProductionConfig(env);
  if (issues.length > 0) {
    throw new Error(`Unsafe production configuration: ${issues.map((issue) => `${issue.key} ${issue.reason}`).join('; ')}`);
  }
}
