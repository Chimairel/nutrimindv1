import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260905180000_billing_foundation/migration.sql'),
  'utf8',
);

const requiredModels = [
  'BillingProduct',
  'BillingPrice',
  'ProviderCustomer',
  'UserSubscription',
  'BillingSubscriptionCancellation',
  'BillingInvoice',
  'PaymentAttempt',
  'BillingTransaction',
  'BillingRefund',
  'ProviderWebhookEvent',
  'WebhookEventProcessing',
  'FinancialLedgerEntry',
  'EntitlementGrant',
  'BillingReconciliationIssue',
  'NutritionistWorkCredit',
  'CompensationPolicy',
  'CompensationPeriod',
  'CompensationStatement',
  'CompensationStatementWorkCredit',
  'CompensationAdjustment',
  'CompensationPayout',
  'CompensationPayoutEvent',
];

test('[TEST-079] billing foundation schema contains every bounded persistence aggregate', () => {
  for (const model of requiredModels) {
    assert.match(schema, new RegExp(`model ${model} \\{`), `missing ${model}`);
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`), `migration missing ${model}`);
  }
  assert.match(schema, /amountMinor\s+Int/);
  assert.match(schema, /currency\s+String\s+@db\.Char\(3\)/);
  assert.doesNotMatch(schema, /cardNumber|cardCvc|cvv|secretKey|webhookSecret/i);
});

test('[TEST-079] billing migration is additive and carries idempotency and integrity constraints', () => {
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/im);
  assert.doesNotMatch(migration, /ALTER TABLE "(User|NutritionistProfile|MealPlan|MealLibrary)"/);
  assert.match(migration, /ProviderWebhookEvent_provider_environment_providerEventId_key/);
  assert.match(migration, /FinancialLedgerEntry_provider_environment_sourceKey_key/);
  assert.match(migration, /NutritionistWorkCredit_sourceActionKey_key/);
  assert.match(migration, /ProviderWebhookEvent_environment_matches_livemode/);
  assert.match(migration, /FinancialLedgerEntry_signed_amount/);
  assert.match(migration, /NutritionistWorkCredit_entry_shape/);
  assert.match(migration, /CompensationPayout_distinct_actors/);
  assert.match(migration, /CompensationPayout_terminal_reference/);
  assert.match(migration, /BillingTransaction_paymentAttemptId_key/);
  assert.match(migration, /BillingPrice_one_active_product_environment_key/);
  assert.match(migration, /UserSubscription_one_current_user_environment_key/);
  assert.match(migration, /WHERE "isActive" = true AND "activeUntil" IS NULL/);
  assert.match(migration, /"status" IN \('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'UNPAID'\)/);
  assert.doesNotMatch(migration, /"endedAt"/);
});

test('[TEST-079] finance evidence is preserved through restrictive or nullable ownership relations', () => {
  assert.match(migration, /ProviderCustomer_userId_fkey[\s\S]*?ON DELETE SET NULL/);
  assert.match(migration, /EntitlementGrant_userId_fkey[\s\S]*?ON DELETE SET NULL/);
  assert.match(migration, /NutritionistWorkCredit_nutritionistProfileId_fkey[\s\S]*?ON DELETE RESTRICT/);
  assert.match(migration, /FinancialLedgerEntry_providerWebhookEventId_fkey[\s\S]*?ON DELETE RESTRICT/);
});
