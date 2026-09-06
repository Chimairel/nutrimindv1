CREATE TYPE "CompensationAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "CompensationPolicy"
  ADD COLUMN "createdByAdminId" TEXT,
  ADD COLUMN "approvedByAdminId" TEXT;

ALTER TABLE "CompensationPeriod"
  ADD COLUMN "openedByAdminId" TEXT,
  ADD COLUMN "closedByAdminId" TEXT;

ALTER TABLE "CompensationStatement"
  ADD COLUMN "preparedByAdminId" TEXT;

ALTER TABLE "CompensationAdjustment"
  ADD COLUMN "status" "CompensationAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "rejectedByAdminId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" VARCHAR(240);

CREATE INDEX "CompensationPolicy_createdByAdminId_idx" ON "CompensationPolicy"("createdByAdminId");
CREATE INDEX "CompensationPolicy_approvedByAdminId_idx" ON "CompensationPolicy"("approvedByAdminId");
CREATE INDEX "CompensationPeriod_openedByAdminId_idx" ON "CompensationPeriod"("openedByAdminId");
CREATE INDEX "CompensationPeriod_closedByAdminId_idx" ON "CompensationPeriod"("closedByAdminId");
CREATE INDEX "CompensationStatement_preparedByAdminId_idx" ON "CompensationStatement"("preparedByAdminId");
CREATE INDEX "CompensationAdjustment_status_createdAt_idx" ON "CompensationAdjustment"("status", "createdAt");
CREATE INDEX "CompensationAdjustment_rejectedByAdminId_idx" ON "CompensationAdjustment"("rejectedByAdminId");

CREATE UNIQUE INDEX "CompensationPolicy_one_active_key"
  ON "CompensationPolicy" ("status") WHERE "status" = 'ACTIVE';

ALTER TABLE "CompensationPolicy" ADD CONSTRAINT "CompensationPolicy_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationPolicy" ADD CONSTRAINT "CompensationPolicy_approvedByAdminId_fkey"
  FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationPeriod" ADD CONSTRAINT "CompensationPeriod_openedByAdminId_fkey"
  FOREIGN KEY ("openedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationPeriod" ADD CONSTRAINT "CompensationPeriod_closedByAdminId_fkey"
  FOREIGN KEY ("closedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_preparedByAdminId_fkey"
  FOREIGN KEY ("preparedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationAdjustment" ADD CONSTRAINT "CompensationAdjustment_rejectedByAdminId_fkey"
  FOREIGN KEY ("rejectedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompensationPolicy" ADD CONSTRAINT "CompensationPolicy_actor_lifecycle" CHECK (
  ("status" = 'DRAFT' AND "approvedAt" IS NULL AND "approvedByAdminId" IS NULL) OR
  ("status" IN ('ACTIVE', 'RETIRED') AND "approvedAt" IS NOT NULL AND "approvedByAdminId" IS NOT NULL AND
    "createdByAdminId" IS NOT NULL AND "createdByAdminId" <> "approvedByAdminId")
);

ALTER TABLE "CompensationPeriod" ADD CONSTRAINT "CompensationPeriod_actor_lifecycle" CHECK (
  "openedByAdminId" IS NOT NULL AND
  (("status" = 'OPEN' AND "closedAt" IS NULL AND "closedByAdminId" IS NULL) OR
   ("status" <> 'OPEN' AND "closedAt" IS NOT NULL AND "closedByAdminId" IS NOT NULL AND "openedByAdminId" <> "closedByAdminId"))
);

ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_actor_lifecycle" CHECK (
  ("status" = 'DRAFT') OR
  ("preparedByAdminId" IS NOT NULL AND "calculatedAt" IS NOT NULL)
);

ALTER TABLE "CompensationStatement" ADD CONSTRAINT "CompensationStatement_maker_checker" CHECK (
  ("preparedByAdminId" IS NULL OR "reviewedByAdminId" IS NULL OR "preparedByAdminId" <> "reviewedByAdminId") AND
  ("preparedByAdminId" IS NULL OR "approvedByAdminId" IS NULL OR "preparedByAdminId" <> "approvedByAdminId") AND
  ("reviewedByAdminId" IS NULL OR "approvedByAdminId" IS NULL OR "reviewedByAdminId" <> "approvedByAdminId")
);

ALTER TABLE "CompensationAdjustment" ADD CONSTRAINT "CompensationAdjustment_status_shape" CHECK (
  ("status" = 'PENDING' AND "approvedAt" IS NULL AND "approvedByAdminId" IS NULL AND "rejectedAt" IS NULL AND "rejectedByAdminId" IS NULL AND "rejectionReason" IS NULL) OR
  ("status" = 'APPROVED' AND "createdByAdminId" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedByAdminId" IS NOT NULL AND "rejectedAt" IS NULL AND "rejectedByAdminId" IS NULL AND "rejectionReason" IS NULL AND "createdByAdminId" <> "approvedByAdminId") OR
  ("status" = 'REJECTED' AND "createdByAdminId" IS NOT NULL AND "approvedAt" IS NULL AND "approvedByAdminId" IS NULL AND "rejectedAt" IS NOT NULL AND "rejectedByAdminId" IS NOT NULL AND "rejectionReason" IS NOT NULL AND length(btrim("rejectionReason")) > 0 AND "createdByAdminId" <> "rejectedByAdminId")
);

ALTER TABLE "CompensationPayout" ADD CONSTRAINT "CompensationPayout_manual_shape" CHECK (
  ("method" <> 'MANUAL_OFF_PLATFORM') OR
  ("provider" IS NULL AND "environment" IS NULL AND "providerTransferId" IS NULL)
);

ALTER TABLE "CompensationPayout" ADD CONSTRAINT "CompensationPayout_actor_lifecycle" CHECK (
  ("status" = 'DRAFT' AND "submittedByAdminId" IS NOT NULL AND "approvedByAdminId" IS NULL AND "approvedAt" IS NULL AND "completedAt" IS NULL AND "externalReference" IS NULL) OR
  ("status" = 'APPROVED' AND "submittedByAdminId" IS NOT NULL AND "approvedByAdminId" IS NOT NULL AND "submittedByAdminId" <> "approvedByAdminId" AND "approvedAt" IS NOT NULL AND "completedAt" IS NULL AND "externalReference" IS NULL) OR
  ("status" = 'MANUAL_RECORDED' AND "method" = 'MANUAL_OFF_PLATFORM' AND "submittedByAdminId" IS NOT NULL AND "approvedByAdminId" IS NOT NULL AND "submittedByAdminId" <> "approvedByAdminId" AND "approvedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "externalReference" IS NOT NULL AND length(btrim("externalReference")) > 0) OR
  ("status" IN ('SUBMITTED','SUCCEEDED','FAILED','VOIDED'))
);

CREATE OR REPLACE FUNCTION "CompensationEvidence_reject_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'compensation evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "NutritionistWorkCredit_append_only"
BEFORE UPDATE OR DELETE ON "NutritionistWorkCredit"
FOR EACH ROW EXECUTE FUNCTION "CompensationEvidence_reject_mutation"();

CREATE TRIGGER "CompensationStatementWorkCredit_append_only"
BEFORE UPDATE OR DELETE ON "CompensationStatementWorkCredit"
FOR EACH ROW EXECUTE FUNCTION "CompensationEvidence_reject_mutation"();

CREATE TRIGGER "CompensationPayoutEvent_append_only"
BEFORE UPDATE OR DELETE ON "CompensationPayoutEvent"
FOR EACH ROW EXECUTE FUNCTION "CompensationEvidence_reject_mutation"();

CREATE OR REPLACE FUNCTION "CompensationStatement_guard_snapshot"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'compensation statement evidence cannot be deleted';
  END IF;
  IF OLD."status" IN ('APPROVED','PAYOUT_PENDING','PAID','RETURNED','VOIDED','PAYOUT_FAILED') AND (
    NEW."currency" <> OLD."currency" OR
    NEW."creditedUnitsMillis" <> OLD."creditedUnitsMillis" OR
    NEW."cappedUnitsMillis" <> OLD."cappedUnitsMillis" OR
    NEW."baseRetainerMinor" <> OLD."baseRetainerMinor" OR
    NEW."workloadAllowanceMinor" <> OLD."workloadAllowanceMinor" OR
    NEW."adjustmentMinor" <> OLD."adjustmentMinor" OR
    NEW."grossMinor" <> OLD."grossMinor" OR
    NEW."periodId" <> OLD."periodId" OR
    NEW."nutritionistProfileId" <> OLD."nutritionistProfileId"
  ) THEN
    RAISE EXCEPTION 'approved compensation statement snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CompensationStatement_snapshot_guard"
BEFORE UPDATE OR DELETE ON "CompensationStatement"
FOR EACH ROW EXECUTE FUNCTION "CompensationStatement_guard_snapshot"();
