import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260906230000_paymongo_payment_projection/migration.sql'), 'utf8');
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

test('[TEST-103] one migration models Checkout as non-renewing access without fake provider objects', () => {
  assert.match(schema, /ONE_TIME_ACCESS_PERIOD/);
  assert.match(schema, /NON_RENEWING/);
  assert.match(migration, /UserSubscription_collection_shape/);
  assert.match(migration, /BillingInvoice_collection_shape/);
  assert.match(migration, /"providerCustomerRecordId" DROP NOT NULL/);
  assert.match(migration, /"providerInvoiceId" DROP NOT NULL/);
  assert.doesNotMatch(migration, /^\s*(INSERT|DELETE|TRUNCATE)\b/im);
});

test('[TEST-103] worker claims use expiring opaque hashes and terminal failures remain reconcilable', () => {
  assert.match(schema, /claimTokenHash\s+String\?/);
  assert.match(schema, /claimExpiresAt\s+DateTime\?/);
  assert.match(migration, /WebhookEventProcessing_claim_shape/);
  assert.match(schema, /model BillingReconciliationIssue/);
});

test('[TEST-103] each payment batch has one debit and one credit posting identity', () => {
  assert.match(schema, /enum BillingLedgerDirection/);
  assert.match(schema, /enum BillingLedgerAccount/);
  assert.match(migration, /FinancialLedgerEntry_posting_shape/);
  assert.match(migration, /FinancialLedgerEntry_balanced_posting_key/);
  assert.match(migration, /FinancialLedgerEntry_append_only/);
});
