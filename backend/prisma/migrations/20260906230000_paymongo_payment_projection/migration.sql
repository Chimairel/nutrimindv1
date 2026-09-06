-- Extend the billing foundation for verified one-time Checkout payments. Existing
-- recurring records retain their original shape; no provider data is synthesized.
ALTER TYPE "BillingSubscriptionStatus" ADD VALUE 'NON_RENEWING';

CREATE TYPE "BillingCollectionMode" AS ENUM ('PROVIDER_RECURRING', 'ONE_TIME_ACCESS_PERIOD');
CREATE TYPE "BillingLedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "BillingLedgerAccount" AS ENUM ('CASH_CLEARING', 'DEFERRED_REVENUE');

ALTER TABLE "UserSubscription"
  ALTER COLUMN "providerCustomerRecordId" DROP NOT NULL,
  ALTER COLUMN "providerSubscriptionId" DROP NOT NULL,
  ADD COLUMN "sourceCheckoutRequestId" TEXT,
  ADD COLUMN "collectionMode" "BillingCollectionMode" NOT NULL DEFAULT 'PROVIDER_RECURRING',
  ADD COLUMN "renewsAutomatically" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "BillingInvoice"
  ALTER COLUMN "providerInvoiceId" DROP NOT NULL,
  ADD COLUMN "sourceCheckoutRequestId" TEXT,
  ADD COLUMN "collectionMode" "BillingCollectionMode" NOT NULL DEFAULT 'PROVIDER_RECURRING';

ALTER TABLE "WebhookEventProcessing"
  ADD COLUMN "claimTokenHash" CHAR(64),
  ADD COLUMN "claimExpiresAt" TIMESTAMP(3);

ALTER TABLE "FinancialLedgerEntry"
  ADD COLUMN "batchKey" VARCHAR(191),
  ADD COLUMN "direction" "BillingLedgerDirection",
  ADD COLUMN "account" "BillingLedgerAccount";

CREATE UNIQUE INDEX "UserSubscription_sourceCheckoutRequestId_key"
  ON "UserSubscription"("sourceCheckoutRequestId");
CREATE UNIQUE INDEX "BillingInvoice_sourceCheckoutRequestId_key"
  ON "BillingInvoice"("sourceCheckoutRequestId");
CREATE UNIQUE INDEX "FinancialLedgerEntry_balanced_posting_key"
  ON "FinancialLedgerEntry"("provider", "environment", "batchKey", "direction", "account");

ALTER TABLE "UserSubscription"
  ADD CONSTRAINT "UserSubscription_sourceCheckoutRequestId_fkey"
    FOREIGN KEY ("sourceCheckoutRequestId") REFERENCES "BillingCheckoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserSubscription_collection_shape" CHECK (
    ("collectionMode" = 'PROVIDER_RECURRING' AND "providerCustomerRecordId" IS NOT NULL AND "providerSubscriptionId" IS NOT NULL AND "sourceCheckoutRequestId" IS NULL) OR
    ("collectionMode" = 'ONE_TIME_ACCESS_PERIOD' AND "providerCustomerRecordId" IS NULL AND "providerSubscriptionId" IS NULL AND "sourceCheckoutRequestId" IS NOT NULL AND "renewsAutomatically" = false AND "cancelAtPeriodEnd" = false AND "status"::text = 'NON_RENEWING')
  );

ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_sourceCheckoutRequestId_fkey"
    FOREIGN KEY ("sourceCheckoutRequestId") REFERENCES "BillingCheckoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "BillingInvoice_collection_shape" CHECK (
    ("collectionMode" = 'PROVIDER_RECURRING' AND "providerInvoiceId" IS NOT NULL AND "sourceCheckoutRequestId" IS NULL) OR
    ("collectionMode" = 'ONE_TIME_ACCESS_PERIOD' AND "providerInvoiceId" IS NULL AND "sourceCheckoutRequestId" IS NOT NULL)
  );

ALTER TABLE "WebhookEventProcessing"
  ADD CONSTRAINT "WebhookEventProcessing_claim_shape" CHECK (
    ("status" = 'PROCESSING' AND "lockedAt" IS NOT NULL AND "claimTokenHash" ~ '^[0-9a-f]{64}$' AND "claimExpiresAt" > "lockedAt" AND "completedAt" IS NULL) OR
    ("status" <> 'PROCESSING' AND "claimTokenHash" IS NULL AND "claimExpiresAt" IS NULL)
  );

ALTER TABLE "FinancialLedgerEntry"
  ADD CONSTRAINT "FinancialLedgerEntry_posting_shape" CHECK (
    ("batchKey" IS NULL AND "direction" IS NULL AND "account" IS NULL) OR
    ("batchKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,190}$' AND "direction" IS NOT NULL AND "account" IS NOT NULL AND "amountMinor" > 0)
  );

CREATE FUNCTION "reject_financial_ledger_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'FinancialLedgerEntry is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FinancialLedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "FinancialLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_financial_ledger_mutation"();
