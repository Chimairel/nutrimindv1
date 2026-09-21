-- Product decision: KAINARA no longer has paid tiers or subscription entitlements.
-- Historical migrations remain in the chain so already-migrated databases can
-- move forward without a reset. This migration removes the inactive system.

ALTER TABLE "User" DROP COLUMN IF EXISTS "testPremiumAllowed";

ALTER TABLE "CompensationPayout"
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "environment",
  DROP COLUMN IF EXISTS "providerTransferId";

DROP TABLE IF EXISTS "FinancialLedgerEntry" CASCADE;
DROP TABLE IF EXISTS "EntitlementGrant" CASCADE;
DROP TABLE IF EXISTS "BillingReconciliationIssue" CASCADE;
DROP TABLE IF EXISTS "WebhookEventProcessing" CASCADE;
DROP TABLE IF EXISTS "ProviderWebhookEvent" CASCADE;
DROP TABLE IF EXISTS "BillingRefund" CASCADE;
DROP TABLE IF EXISTS "BillingTransaction" CASCADE;
DROP TABLE IF EXISTS "PaymentAttempt" CASCADE;
DROP TABLE IF EXISTS "BillingInvoice" CASCADE;
DROP TABLE IF EXISTS "BillingSubscriptionCancellation" CASCADE;
DROP TABLE IF EXISTS "UserSubscription" CASCADE;
DROP TABLE IF EXISTS "ProviderCustomer" CASCADE;
DROP TABLE IF EXISTS "BillingCheckoutAuditEvent" CASCADE;
DROP TABLE IF EXISTS "BillingCheckoutRequest" CASCADE;
DROP TABLE IF EXISTS "BillingPrice" CASCADE;
DROP TABLE IF EXISTS "BillingProduct" CASCADE;

DROP TYPE IF EXISTS "BillingReconciliationIssueStatus";
DROP TYPE IF EXISTS "BillingEntitlementSource";
DROP TYPE IF EXISTS "BillingEntitlementKey";
DROP TYPE IF EXISTS "BillingWebhookProcessingStatus";
DROP TYPE IF EXISTS "BillingCancellationStatus";
DROP TYPE IF EXISTS "BillingRefundStatus";
DROP TYPE IF EXISTS "BillingLedgerAccount";
DROP TYPE IF EXISTS "BillingLedgerDirection";
DROP TYPE IF EXISTS "BillingLedgerEntryType";
DROP TYPE IF EXISTS "BillingPaymentAttemptStatus";
DROP TYPE IF EXISTS "BillingInvoiceStatus";
DROP TYPE IF EXISTS "BillingCollectionMode";
DROP TYPE IF EXISTS "BillingSubscriptionStatus";
DROP TYPE IF EXISTS "BillingCheckoutAuditEventType";
DROP TYPE IF EXISTS "BillingCheckoutRequestStatus";
DROP TYPE IF EXISTS "BillingInterval";
DROP TYPE IF EXISTS "BillingProductStatus";
DROP TYPE IF EXISTS "BillingEnvironment";
DROP TYPE IF EXISTS "BillingProvider";
