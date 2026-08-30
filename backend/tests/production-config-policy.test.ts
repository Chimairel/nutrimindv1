import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductionConfig } from '../src/domain/production-config.policy';

test('[TEST-062] development configuration is not subjected to production-only gates', () => {
  assert.deepEqual(validateProductionConfig({ NODE_ENV: 'development' }), []);
});

test('[TEST-063] production fails closed on absent, short, placeholder, or wildcard security configuration', () => {
  const issues = validateProductionConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'example-database',
    JWT_SECRET: 'short',
    JWT_REFRESH_SECRET: 'replace-me',
    CRON_SECRET: 'also-short',
    CORS_ORIGINS: '*',
  });
  assert.ok(issues.length >= 6);
  assert.ok(issues.some((issue) => issue.key === 'CORS_ORIGINS'));
  assert.ok(issues.some((issue) => issue.key === 'CLINICAL_POLICY_APPROVED_VERSION'));
});

test('[TEST-064] production accepts exact origins, strong secrets, and the signed policy version', () => {
  assert.deepEqual(validateProductionConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://service:strong-value@database.invalid/nutrimind',
    JWT_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    CRON_SECRET: 'c'.repeat(64),
    CORS_ORIGINS: 'https://nutrimind.example.invalid',
    CLINICAL_POLICY_APPROVED_VERSION: 'NUTRIMIND_CLINICAL_DRAFT_V1',
  }), []);
});
