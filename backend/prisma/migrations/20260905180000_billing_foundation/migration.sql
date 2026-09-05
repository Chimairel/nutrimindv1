-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('PAYMONGO');

-- CreateEnum
CREATE TYPE "BillingEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "BillingProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_CANCELLED', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BillingPaymentAttemptStatus" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BillingLedgerEntryType" AS ENUM ('CHARGE', 'REFUND', 'DISPUTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BillingRefundStatus" AS ENUM ('REQUESTED', 'REVIEWED', 'APPROVED', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCancellationStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingWebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "BillingEntitlementKey" AS ENUM ('PREMIUM');

-- CreateEnum
CREATE TYPE "BillingEntitlementSource" AS ENUM ('PAID_INVOICE', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BillingReconciliationIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "NutritionistWorkCreditKind" AS ENUM ('ORDINARY_PLAN_REVIEW', 'HIGH_RISK_SECOND_REVIEW', 'LIBRARY_SAFETY_CERTIFICATION', 'SAFETY_FLAG_RESOLUTION');

-- CreateEnum
CREATE TYPE "NutritionistWorkCreditEntryType" AS ENUM ('AWARD', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CompensationPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CompensationPeriodStatus" AS ENUM ('OPEN', 'CALCULATING', 'REVIEW', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompensationStatementStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAYOUT_PENDING', 'PAID', 'RETURNED', 'VOIDED', 'PAYOUT_FAILED');

-- CreateEnum
CREATE TYPE "CompensationPayoutMethod" AS ENUM ('MANUAL_OFF_PLATFORM', 'PAYMONGO_DISBURSEMENT');

-- CreateEnum
CREATE TYPE "CompensationPayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'MANUAL_RECORDED', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'VOIDED');

-- CreateTable
CREATE TABLE "BillingProduct" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "BillingProductStatus" NOT NULL DEFAULT 'INACTIVE',
    "featureSetVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerPlanId" VARCHAR(191),
    "currency" CHAR(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3),
    "activeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "billingSubjectKey" VARCHAR(80) NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerCustomerId" VARCHAR(191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "billingSubjectKey" VARCHAR(80) NOT NULL,
    "providerCustomerRecordId" TEXT NOT NULL,
    "billingPriceId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerSubscriptionId" VARCHAR(191) NOT NULL,
    "creationIdempotencyKey" VARCHAR(160) NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "providerStatus" VARCHAR(64),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "pastDueAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscriptionCancellation" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "status" "BillingCancellationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerConfirmedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "failureCode" VARCHAR(64),

    CONSTRAINT "BillingSubscriptionCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerInvoiceId" VARCHAR(191) NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "amountDueMinor" INTEGER NOT NULL,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "amountRefundedMinor" INTEGER NOT NULL DEFAULT 0,
    "servicePeriodStart" TIMESTAMP(3),
    "servicePeriodEnd" TIMESTAMP(3),
    "providerCreatedAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "merchantDocumentReference" VARCHAR(191),
    "merchantDocumentIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "providerPaymentIntentId" VARCHAR(191),
    "providerPaymentId" VARCHAR(191),
    "status" "BillingPaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "failureCode" VARCHAR(64),
    "providerUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingTransaction" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerPaymentId" VARCHAR(191) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRefund" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "approvedByAdminId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerRefundId" VARCHAR(191),
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "status" "BillingRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "note" VARCHAR(500),
    "entitlementResolution" VARCHAR(64),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BillingRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "providerEventId" VARCHAR(191) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "sanitizedPayload" JSONB NOT NULL,
    "signatureKeyVersion" VARCHAR(64) NOT NULL,
    "providerCreatedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEventProcessing" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "status" "BillingWebhookProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "handlerVersion" VARCHAR(64) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(64),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEventProcessing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "sourceKey" VARCHAR(191) NOT NULL,
    "entryType" "BillingLedgerEntryType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "invoiceId" TEXT,
    "transactionId" TEXT,
    "refundId" TEXT,
    "providerWebhookEventId" TEXT,
    "reasonCode" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "billingSubjectKey" VARCHAR(80) NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "entitlementKey" "BillingEntitlementKey" NOT NULL,
    "source" "BillingEntitlementSource" NOT NULL,
    "sourceKey" VARCHAR(191) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3) NOT NULL,
    "grantVersion" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReconciliationIssue" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "providerResourceId" VARCHAR(191) NOT NULL,
    "issueCode" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "status" "BillingReconciliationIssueStatus" NOT NULL DEFAULT 'OPEN',
    "details" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" VARCHAR(500),

    CONSTRAINT "BillingReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionistWorkCredit" (
    "id" TEXT NOT NULL,
    "nutritionistProfileId" TEXT NOT NULL,
    "entryType" "NutritionistWorkCreditEntryType" NOT NULL,
    "creditKind" "NutritionistWorkCreditKind" NOT NULL,
    "sourceActionKey" VARCHAR(191) NOT NULL,
    "sourceEntityType" VARCHAR(80) NOT NULL,
    "sourceEntityId" VARCHAR(191) NOT NULL,
    "sourceOutcome" VARCHAR(64) NOT NULL,
    "unitsMillis" INTEGER NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "reversesCreditId" TEXT,
    "reasonCode" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionistWorkCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationPolicy" (
    "id" TEXT NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "status" "CompensationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "baseRetainerMinor" INTEGER NOT NULL,
    "workloadUnitCapMillis" INTEGER NOT NULL,
    "workloadBands" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationPeriod" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "CompensationPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationStatement" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "nutritionistProfileId" TEXT NOT NULL,
    "status" "CompensationStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "creditedUnitsMillis" INTEGER NOT NULL DEFAULT 0,
    "cappedUnitsMillis" INTEGER NOT NULL DEFAULT 0,
    "baseRetainerMinor" INTEGER NOT NULL DEFAULT 0,
    "workloadAllowanceMinor" INTEGER NOT NULL DEFAULT 0,
    "adjustmentMinor" INTEGER NOT NULL DEFAULT 0,
    "grossMinor" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationStatementWorkCredit" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "workCreditId" TEXT NOT NULL,
    "unitsMillisSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensationStatementWorkCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationAdjustment" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "note" VARCHAR(500),
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "createdByAdminId" TEXT,
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CompensationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationPayout" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "method" "CompensationPayoutMethod" NOT NULL DEFAULT 'MANUAL_OFF_PLATFORM',
    "status" "CompensationPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "provider" "BillingProvider",
    "environment" "BillingEnvironment",
    "providerTransferId" VARCHAR(191),
    "externalReference" VARCHAR(191),
    "submittedByAdminId" TEXT,
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationPayoutEvent" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "status" "CompensationPayoutStatus" NOT NULL,
    "actorUserId" TEXT,
    "reasonCode" VARCHAR(64) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensationPayoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingProduct_code_key" ON "BillingProduct"("code");

-- CreateIndex
CREATE INDEX "BillingPrice_environment_isActive_idx" ON "BillingPrice"("environment", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPrice_productId_environment_version_key" ON "BillingPrice"("productId", "environment", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPrice_provider_environment_providerPlanId_key" ON "BillingPrice"("provider", "environment", "providerPlanId");

-- CreateIndex
CREATE INDEX "ProviderCustomer_billingSubjectKey_environment_idx" ON "ProviderCustomer"("billingSubjectKey", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomer_provider_environment_providerCustomerId_key" ON "ProviderCustomer"("provider", "environment", "providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomer_userId_provider_environment_key" ON "ProviderCustomer"("userId", "provider", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomer_billingSubjectKey_provider_environment_key" ON "ProviderCustomer"("billingSubjectKey", "provider", "environment");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_status_idx" ON "UserSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "UserSubscription_billingSubjectKey_status_idx" ON "UserSubscription"("billingSubjectKey", "status");

-- CreateIndex
CREATE INDEX "UserSubscription_status_currentPeriodEnd_idx" ON "UserSubscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_provider_environment_providerSubscriptionI_key" ON "UserSubscription"("provider", "environment", "providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_provider_environment_creationIdempotencyKe_key" ON "UserSubscription"("provider", "environment", "creationIdempotencyKey");

-- CreateIndex
CREATE INDEX "BillingSubscriptionCancellation_status_requestedAt_idx" ON "BillingSubscriptionCancellation"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionCancellation_subscriptionId_idempotencyK_key" ON "BillingSubscriptionCancellation"("subscriptionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BillingInvoice_subscriptionId_status_idx" ON "BillingInvoice"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_providerUpdatedAt_idx" ON "BillingInvoice"("status", "providerUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_provider_environment_providerInvoiceId_key" ON "BillingInvoice"("provider", "environment", "providerInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoiceId_status_idx" ON "PaymentAttempt"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_subscriptionId_status_idx" ON "PaymentAttempt"("subscriptionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_environment_idempotencyKey_key" ON "PaymentAttempt"("provider", "environment", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_environment_providerPaymentIntentId_key" ON "PaymentAttempt"("provider", "environment", "providerPaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_environment_providerPaymentId_key" ON "PaymentAttempt"("provider", "environment", "providerPaymentId");

-- CreateIndex
CREATE INDEX "BillingTransaction_invoiceId_paidAt_idx" ON "BillingTransaction"("invoiceId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTransaction_provider_environment_providerPaymentId_key" ON "BillingTransaction"("provider", "environment", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingTransaction_paymentAttemptId_key" ON "BillingTransaction"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "BillingRefund_invoiceId_status_idx" ON "BillingRefund"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "BillingRefund_status_requestedAt_idx" ON "BillingRefund"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRefund_provider_environment_idempotencyKey_key" ON "BillingRefund"("provider", "environment", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRefund_provider_environment_providerRefundId_key" ON "BillingRefund"("provider", "environment", "providerRefundId");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_eventType_receivedAt_idx" ON "ProviderWebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_environment_receivedAt_idx" ON "ProviderWebhookEvent"("environment", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_environment_providerEventId_key" ON "ProviderWebhookEvent"("provider", "environment", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEventProcessing_webhookEventId_key" ON "WebhookEventProcessing"("webhookEventId");

-- CreateIndex
CREATE INDEX "WebhookEventProcessing_status_nextAttemptAt_idx" ON "WebhookEventProcessing"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_invoiceId_createdAt_idx" ON "FinancialLedgerEntry"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_transactionId_createdAt_idx" ON "FinancialLedgerEntry"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_refundId_createdAt_idx" ON "FinancialLedgerEntry"("refundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_provider_environment_sourceKey_key" ON "FinancialLedgerEntry"("provider", "environment", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementGrant_sourceKey_key" ON "EntitlementGrant"("sourceKey");

-- CreateIndex
CREATE INDEX "EntitlementGrant_userId_entitlementKey_effectiveUntil_idx" ON "EntitlementGrant"("userId", "entitlementKey", "effectiveUntil");

-- CreateIndex
CREATE INDEX "EntitlementGrant_billingSubjectKey_entitlementKey_effective_idx" ON "EntitlementGrant"("billingSubjectKey", "entitlementKey", "effectiveUntil");

-- CreateIndex
CREATE INDEX "EntitlementGrant_subscriptionId_effectiveUntil_idx" ON "EntitlementGrant"("subscriptionId", "effectiveUntil");

-- CreateIndex
CREATE INDEX "BillingReconciliationIssue_status_severity_lastSeenAt_idx" ON "BillingReconciliationIssue"("status", "severity", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingReconciliationIssue_provider_environment_resourceTyp_key" ON "BillingReconciliationIssue"("provider", "environment", "resourceType", "providerResourceId", "issueCode");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionistWorkCredit_sourceActionKey_key" ON "NutritionistWorkCredit"("sourceActionKey");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionistWorkCredit_reversesCreditId_key" ON "NutritionistWorkCredit"("reversesCreditId");

-- CreateIndex
CREATE INDEX "NutritionistWorkCredit_nutritionistProfileId_earnedAt_idx" ON "NutritionistWorkCredit"("nutritionistProfileId", "earnedAt");

-- CreateIndex
CREATE INDEX "NutritionistWorkCredit_creditKind_earnedAt_idx" ON "NutritionistWorkCredit"("creditKind", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationPolicy_version_key" ON "CompensationPolicy"("version");

-- CreateIndex
CREATE INDEX "CompensationPeriod_status_periodEnd_idx" ON "CompensationPeriod"("status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationPeriod_policyId_periodStart_periodEnd_key" ON "CompensationPeriod"("policyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CompensationStatement_nutritionistProfileId_status_idx" ON "CompensationStatement"("nutritionistProfileId", "status");

-- CreateIndex
CREATE INDEX "CompensationStatement_status_approvedAt_idx" ON "CompensationStatement"("status", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationStatement_periodId_nutritionistProfileId_key" ON "CompensationStatement"("periodId", "nutritionistProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationStatementWorkCredit_workCreditId_key" ON "CompensationStatementWorkCredit"("workCreditId");

-- CreateIndex
CREATE INDEX "CompensationStatementWorkCredit_statementId_idx" ON "CompensationStatementWorkCredit"("statementId");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationAdjustment_idempotencyKey_key" ON "CompensationAdjustment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CompensationAdjustment_statementId_createdAt_idx" ON "CompensationAdjustment"("statementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationPayout_idempotencyKey_key" ON "CompensationPayout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CompensationPayout_statementId_status_idx" ON "CompensationPayout"("statementId", "status");

-- CreateIndex
CREATE INDEX "CompensationPayout_status_createdAt_idx" ON "CompensationPayout"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompensationPayout_provider_environment_providerTransferId_key" ON "CompensationPayout"("provider", "environment", "providerTransferId");

-- CreateIndex
CREATE INDEX "CompensationPayoutEvent_payoutId_createdAt_idx" ON "CompensationPayoutEvent"("payoutId", "createdAt");

-- CreateIndex
CREATE INDEX "CompensationPayoutEvent_actorUserId_createdAt_idx" ON "CompensationPayoutEvent"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCustomer" ADD CONSTRAINT "ProviderCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_providerCustomerRecordId_fkey" FOREIGN KEY ("providerCustomerRecordId") REFERENCES "ProviderCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_billingPriceId_fkey" FOREIGN KEY ("billingPriceId") REFERENCES "BillingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionCancellation" ADD CONSTRAINT "BillingSubscriptionCancellation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionCancellation" ADD CONSTRAINT "BillingSubscriptionCancellation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BillingTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEventProcessing" ADD CONSTRAINT "WebhookEventProcessing_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "ProviderWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BillingTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "BillingRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_providerWebhookEventId_fkey" FOREIGN KEY ("providerWebhookEventId") REFERENCES "ProviderWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReconciliationIssue" ADD CONSTRAINT "BillingReconciliationIssue_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionistWorkCredit" ADD CONSTRAINT "NutritionistWorkCredit_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionistWorkCredit" ADD CONSTRAINT "NutritionistWorkCredit_reversesCreditId_fkey" FOREIGN KEY ("reversesCreditId") REFERENCES "NutritionistWorkCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPeriod" ADD CONSTRAINT "CompensationPeriod_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompensationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CompensationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatementWorkCredit" ADD CONSTRAINT "CompensationStatementWorkCredit_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CompensationStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationStatementWorkCredit" ADD CONSTRAINT "CompensationStatementWorkCredit_workCreditId_fkey" FOREIGN KEY ("workCreditId") REFERENCES "NutritionistWorkCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationAdjustment" ADD CONSTRAINT "CompensationAdjustment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CompensationStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationAdjustment" ADD CONSTRAINT "CompensationAdjustment_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationAdjustment" ADD CONSTRAINT "CompensationAdjustment_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPayout" ADD CONSTRAINT "CompensationPayout_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CompensationStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPayout" ADD CONSTRAINT "CompensationPayout_submittedByAdminId_fkey" FOREIGN KEY ("submittedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPayout" ADD CONSTRAINT "CompensationPayout_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPayoutEvent" ADD CONSTRAINT "CompensationPayoutEvent_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CompensationPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationPayoutEvent" ADD CONSTRAINT "CompensationPayoutEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express in the schema. This migration is
-- intentionally additive and remains unapplied in the billing-foundation phase.
ALTER TABLE "BillingPrice"
  ADD CONSTRAINT "BillingPrice_amount_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "BillingPrice_interval_count_positive" CHECK ("intervalCount" > 0),
  ADD CONSTRAINT "BillingPrice_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "BillingPrice_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "BillingPrice_active_range" CHECK ("activeUntil" IS NULL OR "activeFrom" IS NULL OR "activeUntil" > "activeFrom");

ALTER TABLE "UserSubscription"
  ADD CONSTRAINT "UserSubscription_state_version_nonnegative" CHECK ("stateVersion" >= 0),
  ADD CONSTRAINT "UserSubscription_period_range" CHECK ("currentPeriodEnd" IS NULL OR "currentPeriodStart" IS NULL OR "currentPeriodEnd" > "currentPeriodStart");

ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_amounts_valid" CHECK (
    "amountDueMinor" > 0 AND
    "amountPaidMinor" >= 0 AND
    "amountPaidMinor" <= "amountDueMinor" AND
    "amountRefundedMinor" >= 0 AND
    "amountRefundedMinor" <= "amountPaidMinor"
  ),
  ADD CONSTRAINT "BillingInvoice_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "BillingInvoice_service_period_range" CHECK ("servicePeriodEnd" IS NULL OR "servicePeriodStart" IS NULL OR "servicePeriodEnd" > "servicePeriodStart");

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_amount_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "PaymentAttempt_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "BillingTransaction"
  ADD CONSTRAINT "BillingTransaction_amount_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "BillingTransaction_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "BillingRefund"
  ADD CONSTRAINT "BillingRefund_amount_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "BillingRefund_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "ProviderWebhookEvent"
  ADD CONSTRAINT "ProviderWebhookEvent_environment_matches_livemode" CHECK (
    ("environment" = 'LIVE' AND "livemode" = true) OR
    ("environment" = 'TEST' AND "livemode" = false)
  ),
  ADD CONSTRAINT "ProviderWebhookEvent_payload_hash_sha256" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "WebhookEventProcessing"
  ADD CONSTRAINT "WebhookEventProcessing_attempt_count_nonnegative" CHECK ("attemptCount" >= 0);

ALTER TABLE "FinancialLedgerEntry"
  ADD CONSTRAINT "FinancialLedgerEntry_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "FinancialLedgerEntry_signed_amount" CHECK (
    ("entryType" = 'CHARGE' AND "amountMinor" > 0) OR
    ("entryType" IN ('REFUND', 'DISPUTE') AND "amountMinor" < 0) OR
    ("entryType" = 'ADJUSTMENT' AND "amountMinor" <> 0)
  );

ALTER TABLE "EntitlementGrant"
  ADD CONSTRAINT "EntitlementGrant_effective_range" CHECK ("effectiveUntil" > "effectiveFrom"),
  ADD CONSTRAINT "EntitlementGrant_version_positive" CHECK ("grantVersion" > 0),
  ADD CONSTRAINT "EntitlementGrant_revocation_time" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "effectiveFrom");

ALTER TABLE "BillingReconciliationIssue"
  ADD CONSTRAINT "BillingReconciliationIssue_seen_range" CHECK ("lastSeenAt" >= "firstSeenAt"),
  ADD CONSTRAINT "BillingReconciliationIssue_resolution_fields" CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL) OR
    ("status" IN ('RESOLVED', 'IGNORED') AND "resolvedAt" IS NOT NULL)
  );

ALTER TABLE "NutritionistWorkCredit"
  ADD CONSTRAINT "NutritionistWorkCredit_entry_shape" CHECK (
    ("entryType" = 'AWARD' AND "unitsMillis" > 0 AND "reversesCreditId" IS NULL) OR
    ("entryType" = 'REVERSAL' AND "unitsMillis" < 0 AND "reversesCreditId" IS NOT NULL)
  );

ALTER TABLE "CompensationPolicy"
  ADD CONSTRAINT "CompensationPolicy_amounts_valid" CHECK ("baseRetainerMinor" >= 0 AND "workloadUnitCapMillis" >= 0),
  ADD CONSTRAINT "CompensationPolicy_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "CompensationPolicy_effective_range" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom");

ALTER TABLE "CompensationPeriod"
  ADD CONSTRAINT "CompensationPeriod_range" CHECK ("periodEnd" > "periodStart");

ALTER TABLE "CompensationStatement"
  ADD CONSTRAINT "CompensationStatement_amounts_valid" CHECK (
    "creditedUnitsMillis" >= 0 AND
    "cappedUnitsMillis" >= 0 AND
    "cappedUnitsMillis" <= "creditedUnitsMillis" AND
    "baseRetainerMinor" >= 0 AND
    "workloadAllowanceMinor" >= 0 AND
    "grossMinor" >= 0
  ),
  ADD CONSTRAINT "CompensationStatement_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "CompensationStatement_distinct_reviewers" CHECK (
    "reviewedByAdminId" IS NULL OR "approvedByAdminId" IS NULL OR "reviewedByAdminId" <> "approvedByAdminId"
  );

ALTER TABLE "CompensationStatementWorkCredit"
  ADD CONSTRAINT "CompensationStatementWorkCredit_units_nonzero" CHECK ("unitsMillisSnapshot" <> 0);

ALTER TABLE "CompensationAdjustment"
  ADD CONSTRAINT "CompensationAdjustment_amount_nonzero" CHECK ("amountMinor" <> 0),
  ADD CONSTRAINT "CompensationAdjustment_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "CompensationAdjustment_distinct_actors" CHECK (
    "createdByAdminId" IS NULL OR "approvedByAdminId" IS NULL OR "createdByAdminId" <> "approvedByAdminId"
  );

ALTER TABLE "CompensationPayout"
  ADD CONSTRAINT "CompensationPayout_amount_positive" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "CompensationPayout_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "CompensationPayout_distinct_actors" CHECK (
    "submittedByAdminId" IS NULL OR "approvedByAdminId" IS NULL OR "submittedByAdminId" <> "approvedByAdminId"
  ),
  ADD CONSTRAINT "CompensationPayout_method_fields" CHECK (
    ("method" = 'MANUAL_OFF_PLATFORM' AND "provider" IS NULL AND "environment" IS NULL AND "providerTransferId" IS NULL) OR
    ("method" = 'PAYMONGO_DISBURSEMENT' AND "provider" = 'PAYMONGO' AND "environment" IS NOT NULL)
  ),
  ADD CONSTRAINT "CompensationPayout_terminal_reference" CHECK (
    "status" NOT IN ('MANUAL_RECORDED', 'SUCCEEDED') OR
    "externalReference" IS NOT NULL OR
    "providerTransferId" IS NOT NULL
  );

-- Operational single-current-row invariants. PostgreSQL partial indexes preserve
-- historical rows while preventing competing active prices or subscriptions.
CREATE UNIQUE INDEX "BillingPrice_one_active_product_environment_key"
  ON "BillingPrice" ("productId", "provider", "environment")
  WHERE "isActive" = true AND "activeUntil" IS NULL;

CREATE UNIQUE INDEX "UserSubscription_one_current_user_environment_key"
  ON "UserSubscription" ("userId", "provider", "environment")
  WHERE "userId" IS NOT NULL AND "status" IN ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'UNPAID');
