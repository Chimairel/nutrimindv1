\set ON_ERROR_STOP on

-- Local disposable PostgreSQL rehearsal only. Every probe runs in one transaction
-- and is rolled back. The script contains synthetic identifiers and no credentials.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_constraint(
  statement_text text,
  expected_state text,
  expected_constraint text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  actual_constraint text;
  actual_state text;
BEGIN
  EXECUTE statement_text;
  RAISE EXCEPTION 'Expected SQLSTATE % from constraint %, but statement succeeded',
    expected_state, expected_constraint;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_constraint = CONSTRAINT_NAME;
    actual_state := SQLSTATE;
    IF actual_state <> expected_state OR actual_constraint <> expected_constraint THEN
      RAISE EXCEPTION 'Expected SQLSTATE % / %, received % / %',
        expected_state, expected_constraint, actual_state, actual_constraint;
    END IF;
END;
$$;

INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "emailVerified",
  "tosAccepted", "onboardingDone", "createdAt", "updatedAt", "isSuspended"
) VALUES
  ('probe-owner-001', 'Synthetic Billing Owner', 'owner@billing-probe.invalid', 'synthetic-not-a-login-hash', 'USER', true, true, true, '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', false),
  ('probe-admin-001', 'Synthetic Admin One', 'admin1@billing-probe.invalid', 'synthetic-not-a-login-hash', 'ADMIN', true, true, true, '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', false),
  ('probe-admin-002', 'Synthetic Admin Two', 'admin2@billing-probe.invalid', 'synthetic-not-a-login-hash', 'ADMIN', true, true, true, '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', false),
  ('probe-admin-003', 'Synthetic Admin Three', 'admin3@billing-probe.invalid', 'synthetic-not-a-login-hash', 'ADMIN', true, true, true, '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', false),
  ('probe-admin-004', 'Synthetic Admin Four', 'admin4@billing-probe.invalid', 'synthetic-not-a-login-hash', 'ADMIN', true, true, true, '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', false);

INSERT INTO "BillingProduct" (
  "id", "code", "displayName", "status", "featureSetVersion", "updatedAt"
) VALUES (
  'probe-product-001', 'PROBE_PREMIUM', 'Synthetic Premium', 'ACTIVE', 'probe-v1', '2026-09-05T00:00:00Z'
);

INSERT INTO "BillingPrice" (
  "id", "productId", "provider", "environment", "providerPlanId", "currency",
  "amountMinor", "interval", "version", "isActive", "activeFrom"
) VALUES
  ('probe-price-test-001', 'probe-product-001', 'PAYMONGO', 'TEST', 'plan_same_across_env', 'PHP', 19900, 'MONTH', 1, true, '2026-09-01T00:00:00Z'),
  ('probe-price-live-001', 'probe-product-001', 'PAYMONGO', 'LIVE', 'plan_same_across_env', 'PHP', 19900, 'MONTH', 1, true, '2026-09-01T00:00:00Z');

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingPrice" ("id", "productId", "provider", "environment", "providerPlanId", "currency", "amountMinor", "interval", "version", "isActive") VALUES ('probe-price-invalid-amount', 'probe-product-001', 'PAYMONGO', 'TEST', 'plan_invalid_amount', 'PHP', 0, 'MONTH', 2, false)$sql$,
  '23514', 'BillingPrice_amount_positive'
);
SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingPrice" ("id", "productId", "provider", "environment", "providerPlanId", "currency", "amountMinor", "interval", "version", "isActive") VALUES ('probe-price-invalid-currency', 'probe-product-001', 'PAYMONGO', 'TEST', 'plan_invalid_currency', 'php', 19900, 'MONTH', 2, false)$sql$,
  '23514', 'BillingPrice_currency_iso'
);
SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingPrice" ("id", "productId", "provider", "environment", "providerPlanId", "currency", "amountMinor", "interval", "version", "isActive") VALUES ('probe-price-overlap', 'probe-product-001', 'PAYMONGO', 'TEST', 'plan_overlap', 'PHP', 29900, 'MONTH', 2, true)$sql$,
  '23505', 'BillingPrice_one_active_product_environment_key'
);

INSERT INTO "ProviderCustomer" (
  "id", "userId", "billingSubjectKey", "provider", "environment", "providerCustomerId", "updatedAt"
) VALUES
  ('probe-customer-test-001', 'probe-owner-001', 'subject-probe-001', 'PAYMONGO', 'TEST', 'customer_same_across_env', '2026-09-05T00:00:00Z'),
  ('probe-customer-live-001', 'probe-owner-001', 'subject-probe-001', 'PAYMONGO', 'LIVE', 'customer_same_across_env', '2026-09-05T00:00:00Z');

INSERT INTO "UserSubscription" (
  "id", "userId", "billingSubjectKey", "providerCustomerRecordId", "billingPriceId",
  "provider", "environment", "providerSubscriptionId", "creationIdempotencyKey", "status",
  "currentPeriodStart", "currentPeriodEnd", "stateVersion", "updatedAt"
) VALUES (
  'probe-subscription-001', 'probe-owner-001', 'subject-probe-001', 'probe-customer-test-001',
  'probe-price-test-001', 'PAYMONGO', 'TEST', 'subscription-probe-001',
  'subscription-create-probe-001', 'ACTIVE', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 1,
  '2026-09-05T00:00:00Z'
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "UserSubscription" ("id", "userId", "billingSubjectKey", "providerCustomerRecordId", "billingPriceId", "provider", "environment", "providerSubscriptionId", "creationIdempotencyKey", "status", "updatedAt") VALUES ('probe-subscription-overlap', 'probe-owner-001', 'subject-probe-001', 'probe-customer-test-001', 'probe-price-test-001', 'PAYMONGO', 'TEST', 'subscription-probe-overlap', 'subscription-create-probe-overlap', 'PAST_DUE', '2026-09-05T00:00:00Z')$sql$,
  '23505', 'UserSubscription_one_current_user_environment_key'
);

INSERT INTO "BillingSubscriptionCancellation" (
  "id", "subscriptionId", "requestedByUserId", "idempotencyKey"
) VALUES (
  'probe-cancellation-001', 'probe-subscription-001', 'probe-owner-001', 'cancel-probe-001'
);

INSERT INTO "BillingInvoice" (
  "id", "subscriptionId", "provider", "environment", "providerInvoiceId", "status", "currency",
  "amountDueMinor", "amountPaidMinor", "amountRefundedMinor", "servicePeriodStart", "servicePeriodEnd", "updatedAt"
) VALUES (
  'probe-invoice-001', 'probe-subscription-001', 'PAYMONGO', 'TEST', 'invoice-probe-001', 'PAID', 'PHP',
  19900, 19900, 1000, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', '2026-09-05T00:00:00Z'
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingInvoice" ("id", "subscriptionId", "provider", "environment", "providerInvoiceId", "currency", "amountDueMinor", "amountPaidMinor", "amountRefundedMinor", "updatedAt") VALUES ('probe-invoice-invalid', 'probe-subscription-001', 'PAYMONGO', 'TEST', 'invoice-probe-invalid', 'PHP', 19900, 10000, 10001, '2026-09-05T00:00:00Z')$sql$,
  '23514', 'BillingInvoice_amounts_valid'
);

INSERT INTO "PaymentAttempt" (
  "id", "subscriptionId", "invoiceId", "provider", "environment", "idempotencyKey",
  "providerPaymentIntentId", "providerPaymentId", "status", "amountMinor", "currency", "updatedAt"
) VALUES (
  'probe-attempt-001', 'probe-subscription-001', 'probe-invoice-001', 'PAYMONGO', 'TEST', 'payment-probe-001',
  'intent-probe-001', 'payment-probe-001', 'SUCCEEDED', 19900, 'PHP', '2026-09-05T00:00:00Z'
);

INSERT INTO "BillingTransaction" (
  "id", "invoiceId", "paymentAttemptId", "provider", "environment", "providerPaymentId", "amountMinor", "currency", "paidAt"
) VALUES (
  'probe-transaction-001', 'probe-invoice-001', 'probe-attempt-001', 'PAYMONGO', 'TEST', 'payment-probe-001', 19900, 'PHP', '2026-09-05T00:00:00Z'
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingTransaction" ("id", "invoiceId", "paymentAttemptId", "provider", "environment", "providerPaymentId", "amountMinor", "currency", "paidAt") VALUES ('probe-transaction-duplicate-attempt', 'probe-invoice-001', 'probe-attempt-001', 'PAYMONGO', 'TEST', 'payment-probe-002', 19900, 'PHP', '2026-09-05T00:00:00Z')$sql$,
  '23505', 'BillingTransaction_paymentAttemptId_key'
);

INSERT INTO "BillingRefund" (
  "id", "invoiceId", "transactionId", "requestedByUserId", "approvedByAdminId", "provider",
  "environment", "providerRefundId", "idempotencyKey", "status", "amountMinor", "currency",
  "reasonCode", "approvedAt", "completedAt"
) VALUES (
  'probe-refund-001', 'probe-invoice-001', 'probe-transaction-001', 'probe-owner-001', 'probe-admin-002',
  'PAYMONGO', 'TEST', 'refund-probe-001', 'refund-request-probe-001', 'SUCCEEDED', 1000, 'PHP',
  'SYNTHETIC_PROBE', '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z'
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "BillingRefund" ("id", "invoiceId", "transactionId", "provider", "environment", "idempotencyKey", "amountMinor", "currency", "reasonCode") VALUES ('probe-refund-duplicate', 'probe-invoice-001', 'probe-transaction-001', 'PAYMONGO', 'TEST', 'refund-request-probe-001', 100, 'PHP', 'SYNTHETIC_PROBE')$sql$,
  '23505', 'BillingRefund_provider_environment_idempotencyKey_key'
);

INSERT INTO "ProviderWebhookEvent" (
  "id", "provider", "environment", "providerEventId", "eventType", "livemode",
  "payloadHash", "sanitizedPayload", "signatureKeyVersion"
) VALUES
  ('probe-webhook-test-001', 'PAYMONGO', 'TEST', 'event_same_across_env', 'payment.paid', false, repeat('a', 64), '{"synthetic":true}'::jsonb, 'probe-key-v1'),
  ('probe-webhook-live-001', 'PAYMONGO', 'LIVE', 'event_same_across_env', 'payment.paid', true, repeat('b', 64), '{"synthetic":true}'::jsonb, 'probe-key-v1');

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "ProviderWebhookEvent" ("id", "provider", "environment", "providerEventId", "eventType", "livemode", "payloadHash", "sanitizedPayload", "signatureKeyVersion") VALUES ('probe-webhook-duplicate', 'PAYMONGO', 'TEST', 'event_same_across_env', 'payment.paid', false, repeat('c', 64), '{}'::jsonb, 'probe-key-v1')$sql$,
  '23505', 'ProviderWebhookEvent_provider_environment_providerEventId_key'
);
SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "ProviderWebhookEvent" ("id", "provider", "environment", "providerEventId", "eventType", "livemode", "payloadHash", "sanitizedPayload", "signatureKeyVersion") VALUES ('probe-webhook-invalid-mode', 'PAYMONGO', 'TEST', 'event-invalid-mode', 'payment.paid', true, repeat('d', 64), '{}'::jsonb, 'probe-key-v1')$sql$,
  '23514', 'ProviderWebhookEvent_environment_matches_livemode'
);
SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "ProviderWebhookEvent" ("id", "provider", "environment", "providerEventId", "eventType", "livemode", "payloadHash", "sanitizedPayload", "signatureKeyVersion") VALUES ('probe-webhook-invalid-hash', 'PAYMONGO', 'TEST', 'event-invalid-hash', 'payment.paid', false, 'NOT-A-HASH', '{}'::jsonb, 'probe-key-v1')$sql$,
  '23514', 'ProviderWebhookEvent_payload_hash_sha256'
);

INSERT INTO "WebhookEventProcessing" (
  "id", "webhookEventId", "status", "attemptCount", "handlerVersion", "updatedAt"
) VALUES (
  'probe-webhook-processing-001', 'probe-webhook-test-001', 'SUCCEEDED', 1, 'probe-handler-v1', '2026-09-05T00:00:00Z'
);

INSERT INTO "FinancialLedgerEntry" (
  "id", "provider", "environment", "sourceKey", "entryType", "amountMinor", "currency",
  "invoiceId", "transactionId", "providerWebhookEventId", "reasonCode"
) VALUES
  ('probe-ledger-charge-001', 'PAYMONGO', 'TEST', 'ledger-charge-probe-001', 'CHARGE', 19900, 'PHP', 'probe-invoice-001', 'probe-transaction-001', 'probe-webhook-test-001', 'PAYMENT_SETTLED'),
  ('probe-ledger-refund-001', 'PAYMONGO', 'TEST', 'ledger-refund-probe-001', 'REFUND', -1000, 'PHP', 'probe-invoice-001', 'probe-transaction-001', 'probe-webhook-test-001', 'REFUND_SETTLED');

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "FinancialLedgerEntry" ("id", "provider", "environment", "sourceKey", "entryType", "amountMinor", "currency", "reasonCode") VALUES ('probe-ledger-invalid-sign', 'PAYMONGO', 'TEST', 'ledger-invalid-sign', 'REFUND', 100, 'PHP', 'SYNTHETIC_PROBE')$sql$,
  '23514', 'FinancialLedgerEntry_signed_amount'
);

INSERT INTO "EntitlementGrant" (
  "id", "userId", "billingSubjectKey", "subscriptionId", "invoiceId", "entitlementKey",
  "source", "sourceKey", "effectiveFrom", "effectiveUntil", "grantVersion"
) VALUES (
  'probe-entitlement-001', 'probe-owner-001', 'subject-probe-001', 'probe-subscription-001', 'probe-invoice-001',
  'PREMIUM', 'PAID_INVOICE', 'invoice-probe-001:premium:v1', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 1
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "EntitlementGrant" ("id", "billingSubjectKey", "entitlementKey", "source", "sourceKey", "effectiveFrom", "effectiveUntil") VALUES ('probe-entitlement-invalid-range', 'subject-invalid', 'PREMIUM', 'ADMIN_ADJUSTMENT', 'invalid-range', '2026-10-01T00:00:00Z', '2026-09-01T00:00:00Z')$sql$,
  '23514', 'EntitlementGrant_effective_range'
);

INSERT INTO "BillingReconciliationIssue" (
  "id", "provider", "environment", "resourceType", "providerResourceId", "issueCode", "severity"
) VALUES (
  'probe-reconciliation-001', 'PAYMONGO', 'TEST', 'invoice', 'invoice-probe-001', 'SYNTHETIC_MISMATCH', 'LOW'
);

INSERT INTO "NutritionistWorkCredit" (
  "id", "nutritionistProfileId", "entryType", "creditKind", "sourceActionKey", "sourceEntityType",
  "sourceEntityId", "sourceOutcome", "unitsMillis", "policyVersion", "earnedAt", "reversesCreditId", "reasonCode"
) VALUES
  ('probe-credit-award-001', 'rehearsal-rnd-profile-001', 'AWARD', 'ORDINARY_PLAN_REVIEW', 'review-probe-001', 'MealPlan', 'meal-plan-probe-001', 'REJECTED', 1000, 'probe-policy-v1', '2026-09-05T00:00:00Z', NULL, 'ELIGIBLE_REVIEW'),
  ('probe-credit-reversal-001', 'rehearsal-rnd-profile-001', 'REVERSAL', 'ORDINARY_PLAN_REVIEW', 'review-probe-001:reverse', 'MealPlan', 'meal-plan-probe-001', 'REJECTED', -1000, 'probe-policy-v1', '2026-09-05T01:00:00Z', 'probe-credit-award-001', 'CORRECTION');

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "NutritionistWorkCredit" ("id", "nutritionistProfileId", "entryType", "creditKind", "sourceActionKey", "sourceEntityType", "sourceEntityId", "sourceOutcome", "unitsMillis", "policyVersion", "earnedAt", "reasonCode") VALUES ('probe-credit-invalid-shape', 'rehearsal-rnd-profile-001', 'REVERSAL', 'ORDINARY_PLAN_REVIEW', 'review-invalid-reversal', 'MealPlan', 'meal-plan-invalid', 'REJECTED', 1000, 'probe-policy-v1', '2026-09-05T00:00:00Z', 'CORRECTION')$sql$,
  '23514', 'NutritionistWorkCredit_entry_shape'
);

INSERT INTO "CompensationPolicy" (
  "id", "version", "status", "currency", "baseRetainerMinor", "workloadUnitCapMillis",
  "workloadBands", "effectiveFrom", "approvedAt"
) VALUES (
  'probe-comp-policy-001', 'probe-policy-v1', 'ACTIVE', 'PHP', 1000000, 10000,
  '[{"minimumUnitsMillis":0,"allowanceMinor":0},{"minimumUnitsMillis":10000,"allowanceMinor":200000}]'::jsonb,
  '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z'
);

INSERT INTO "CompensationPeriod" (
  "id", "policyId", "periodStart", "periodEnd", "status", "updatedAt"
) VALUES (
  'probe-comp-period-001', 'probe-comp-policy-001', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 'APPROVED', '2026-09-05T00:00:00Z'
);

INSERT INTO "CompensationStatement" (
  "id", "periodId", "nutritionistProfileId", "status", "currency", "creditedUnitsMillis",
  "cappedUnitsMillis", "baseRetainerMinor", "workloadAllowanceMinor", "adjustmentMinor", "grossMinor",
  "calculatedAt", "reviewedByAdminId", "reviewedAt", "approvedByAdminId", "approvedAt", "updatedAt"
) VALUES (
  'probe-comp-statement-001', 'probe-comp-period-001', 'rehearsal-rnd-profile-001', 'APPROVED', 'PHP',
  1000, 1000, 1000000, 0, 10000, 1010000, '2026-09-05T00:00:00Z', 'probe-admin-001',
  '2026-09-05T01:00:00Z', 'probe-admin-002', '2026-09-05T02:00:00Z', '2026-09-05T02:00:00Z'
);

SELECT pg_temp.expect_constraint(
  $sql$UPDATE "CompensationStatement" SET "approvedByAdminId" = "reviewedByAdminId" WHERE "id" = 'probe-comp-statement-001'$sql$,
  '23514', 'CompensationStatement_distinct_reviewers'
);

INSERT INTO "CompensationStatementWorkCredit" (
  "id", "statementId", "workCreditId", "unitsMillisSnapshot"
) VALUES (
  'probe-comp-credit-link-001', 'probe-comp-statement-001', 'probe-credit-award-001', 1000
);

INSERT INTO "CompensationAdjustment" (
  "id", "statementId", "amountMinor", "currency", "reasonCode", "idempotencyKey",
  "createdByAdminId", "approvedByAdminId", "approvedAt"
) VALUES (
  'probe-comp-adjustment-001', 'probe-comp-statement-001', 10000, 'PHP', 'SYNTHETIC_ADJUSTMENT',
  'comp-adjustment-probe-001', 'probe-admin-003', 'probe-admin-004', '2026-09-05T02:00:00Z'
);

INSERT INTO "CompensationPayout" (
  "id", "statementId", "method", "status", "amountMinor", "currency", "idempotencyKey",
  "externalReference", "submittedByAdminId", "approvedByAdminId", "approvedAt", "submittedAt", "completedAt", "updatedAt"
) VALUES (
  'probe-comp-payout-001', 'probe-comp-statement-001', 'MANUAL_OFF_PLATFORM', 'MANUAL_RECORDED',
  1010000, 'PHP', 'comp-payout-probe-001', 'synthetic-off-platform-reference', 'probe-admin-003',
  'probe-admin-004', '2026-09-05T02:00:00Z', '2026-09-05T03:00:00Z', '2026-09-05T04:00:00Z', '2026-09-05T04:00:00Z'
);

INSERT INTO "CompensationPayoutEvent" (
  "id", "payoutId", "status", "actorUserId", "reasonCode", "metadata"
) VALUES (
  'probe-comp-payout-event-001', 'probe-comp-payout-001', 'MANUAL_RECORDED', 'probe-admin-003', 'SYNTHETIC_RECORDED', '{"synthetic":true}'::jsonb
);

SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "CompensationPayout" ("id", "statementId", "method", "amountMinor", "currency", "idempotencyKey", "provider", "environment", "updatedAt") VALUES ('probe-payout-invalid-method', 'probe-comp-statement-001', 'MANUAL_OFF_PLATFORM', 100, 'PHP', 'comp-payout-invalid-method', 'PAYMONGO', 'TEST', '2026-09-05T00:00:00Z')$sql$,
  '23514', 'CompensationPayout_method_fields'
);
SELECT pg_temp.expect_constraint(
  $sql$INSERT INTO "CompensationPayout" ("id", "statementId", "method", "status", "amountMinor", "currency", "idempotencyKey", "updatedAt") VALUES ('probe-payout-missing-reference', 'probe-comp-statement-001', 'MANUAL_OFF_PLATFORM', 'MANUAL_RECORDED', 100, 'PHP', 'comp-payout-missing-reference', '2026-09-05T00:00:00Z')$sql$,
  '23514', 'CompensationPayout_terminal_reference'
);

SELECT pg_temp.expect_constraint(
  $sql$DELETE FROM "BillingProduct" WHERE "id" = 'probe-product-001'$sql$,
  '23503', 'BillingPrice_productId_fkey'
);
SELECT pg_temp.expect_constraint(
  $sql$DELETE FROM "CompensationPolicy" WHERE "id" = 'probe-comp-policy-001'$sql$,
  '23503', 'CompensationPeriod_policyId_fkey'
);

DELETE FROM "User" WHERE "id" = 'probe-owner-001';

DO $$
BEGIN
  IF (SELECT "userId" FROM "ProviderCustomer" WHERE "id" = 'probe-customer-test-001') IS NOT NULL THEN
    RAISE EXCEPTION 'ProviderCustomer ownership was not cleared';
  END IF;
  IF (SELECT "userId" FROM "UserSubscription" WHERE "id" = 'probe-subscription-001') IS NOT NULL THEN
    RAISE EXCEPTION 'UserSubscription ownership was not cleared';
  END IF;
  IF (SELECT "userId" FROM "EntitlementGrant" WHERE "id" = 'probe-entitlement-001') IS NOT NULL THEN
    RAISE EXCEPTION 'EntitlementGrant ownership was not cleared';
  END IF;
  IF (SELECT "requestedByUserId" FROM "BillingSubscriptionCancellation" WHERE "id" = 'probe-cancellation-001') IS NOT NULL THEN
    RAISE EXCEPTION 'Cancellation requester ownership was not cleared';
  END IF;
  IF (SELECT count(*) FROM "ProviderCustomer" WHERE "providerCustomerId" = 'customer_same_across_env') <> 2 THEN
    RAISE EXCEPTION 'Provider/environment customer scoping failed';
  END IF;
  IF (SELECT count(*) FROM "ProviderWebhookEvent" WHERE "providerEventId" = 'event_same_across_env') <> 2 THEN
    RAISE EXCEPTION 'Provider/environment webhook scoping failed';
  END IF;
  IF (SELECT count(*) FROM "FinancialLedgerEntry" WHERE "invoiceId" = 'probe-invoice-001') <> 2 THEN
    RAISE EXCEPTION 'Financial ledger relation evidence missing';
  END IF;
  IF (SELECT count(*) FROM "NutritionistWorkCredit" WHERE "nutritionistProfileId" = 'rehearsal-rnd-profile-001') <> 2 THEN
    RAISE EXCEPTION 'Work-credit award/reversal evidence missing';
  END IF;
  IF (SELECT count(*) FROM "CompensationPayoutEvent" WHERE "payoutId" = 'probe-comp-payout-001') <> 1 THEN
    RAISE EXCEPTION 'Compensation payout event relation missing';
  END IF;
END;
$$;

SELECT 'billing_constraint_probes_passed' AS result;

ROLLBACK;
