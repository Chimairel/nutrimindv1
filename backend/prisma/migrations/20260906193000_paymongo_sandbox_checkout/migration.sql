-- CreateEnum
CREATE TYPE "BillingCheckoutRequestStatus" AS ENUM ('CLAIMED', 'RETRYABLE', 'FAILED', 'SUCCEEDED');

-- CreateEnum
CREATE TYPE "BillingCheckoutAuditEventType" AS ENUM ('CLAIMED', 'RECLAIMED', 'REPLAYED', 'COLLISION_REJECTED', 'IN_PROGRESS_REJECTED', 'PROVIDER_SESSION_CREATED', 'RETRYABLE_FAILURE', 'TERMINAL_FAILURE');

-- CreateTable
CREATE TABLE "BillingCheckoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "billingSubjectKey" VARCHAR(80) NOT NULL,
    "billingPriceId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'PAYMONGO',
    "environment" "BillingEnvironment" NOT NULL DEFAULT 'TEST',
    "requestIdempotencyKey" VARCHAR(160) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "providerIdempotencyKey" VARCHAR(255) NOT NULL,
    "referenceNumber" VARCHAR(191) NOT NULL,
    "status" "BillingCheckoutRequestStatus" NOT NULL DEFAULT 'CLAIMED',
    "claimTokenHash" CHAR(64),
    "claimExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "providerSessionId" VARCHAR(191),
    "checkoutUrl" VARCHAR(2048),
    "failureCode" VARCHAR(160),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckoutAuditEvent" (
    "id" TEXT NOT NULL,
    "checkoutRequestId" TEXT NOT NULL,
    "eventType" "BillingCheckoutAuditEventType" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "failureCode" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCheckoutAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingCheckoutRequest_billingSubjectKey_status_idx" ON "BillingCheckoutRequest"("billingSubjectKey", "status");

-- CreateIndex
CREATE INDEX "BillingCheckoutRequest_status_claimExpiresAt_idx" ON "BillingCheckoutRequest"("status", "claimExpiresAt");

-- CreateIndex
CREATE INDEX "BillingCheckoutRequest_billingPriceId_createdAt_idx" ON "BillingCheckoutRequest"("billingPriceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutRequest_userId_requestIdempotencyKey_key" ON "BillingCheckoutRequest"("userId", "requestIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutRequest_provider_environment_providerIdempot_key" ON "BillingCheckoutRequest"("provider", "environment", "providerIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutRequest_provider_environment_referenceNumber_key" ON "BillingCheckoutRequest"("provider", "environment", "referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutRequest_provider_environment_providerSession_key" ON "BillingCheckoutRequest"("provider", "environment", "providerSessionId");

-- CreateIndex
CREATE INDEX "BillingCheckoutAuditEvent_checkoutRequestId_createdAt_idx" ON "BillingCheckoutAuditEvent"("checkoutRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingCheckoutAuditEvent_eventType_createdAt_idx" ON "BillingCheckoutAuditEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingCheckoutRequest" ADD CONSTRAINT "BillingCheckoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutRequest" ADD CONSTRAINT "BillingCheckoutRequest_billingPriceId_fkey" FOREIGN KEY ("billingPriceId") REFERENCES "BillingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutAuditEvent" ADD CONSTRAINT "BillingCheckoutAuditEvent_checkoutRequestId_fkey" FOREIGN KEY ("checkoutRequestId") REFERENCES "BillingCheckoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 3B remains PayMongo TEST-only. These checks prevent partial success,
-- raw provider failure text, and live-mode records from entering persistence.
ALTER TABLE "BillingCheckoutRequest"
  ADD CONSTRAINT "BillingCheckoutRequest_test_only" CHECK ("provider" = 'PAYMONGO' AND "environment" = 'TEST'),
  ADD CONSTRAINT "BillingCheckoutRequest_request_hash_sha256" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "BillingCheckoutRequest_attempt_positive" CHECK ("attemptCount" > 0),
  ADD CONSTRAINT "BillingCheckoutRequest_provider_key_shape" CHECK ("providerIdempotencyKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$'),
  ADD CONSTRAINT "BillingCheckoutRequest_reference_shape" CHECK ("referenceNumber" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,190}$'),
  ADD CONSTRAINT "BillingCheckoutRequest_failure_code_shape" CHECK ("failureCode" IS NULL OR "failureCode" ~ '^[A-Za-z0-9_:]{1,160}$'),
  ADD CONSTRAINT "BillingCheckoutRequest_state_shape" CHECK (
    ("status" = 'CLAIMED' AND "claimTokenHash" ~ '^[0-9a-f]{64}$' AND "claimExpiresAt" IS NOT NULL AND "providerSessionId" IS NULL AND "checkoutUrl" IS NULL AND "completedAt" IS NULL AND "failureCode" IS NULL) OR
    ("status" IN ('RETRYABLE', 'FAILED') AND "claimTokenHash" IS NULL AND "claimExpiresAt" IS NULL AND "providerSessionId" IS NULL AND "checkoutUrl" IS NULL AND "completedAt" IS NULL AND "failureCode" IS NOT NULL) OR
    ("status" = 'SUCCEEDED' AND "claimTokenHash" IS NULL AND "claimExpiresAt" IS NULL AND "providerSessionId" ~ '^cs_[A-Za-z0-9_-]{8,191}$' AND "checkoutUrl" ~ '^https://checkout[.]paymongo[.]com/' AND "completedAt" IS NOT NULL AND "failureCode" IS NULL)
  );

ALTER TABLE "BillingCheckoutAuditEvent"
  ADD CONSTRAINT "BillingCheckoutAuditEvent_attempt_positive" CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "BillingCheckoutAuditEvent_failure_shape" CHECK (
    ("eventType" IN ('RETRYABLE_FAILURE', 'TERMINAL_FAILURE') AND "failureCode" ~ '^[A-Za-z0-9_:]{1,160}$') OR
    ("eventType" NOT IN ('RETRYABLE_FAILURE', 'TERMINAL_FAILURE') AND "failureCode" IS NULL)
  );
