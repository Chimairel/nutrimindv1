CREATE TYPE "RicePreferenceProvenance" AS ENUM ('LEGACY_DEFAULT', 'USER_SELECTED');
CREATE TYPE "ProfileCycleAdaptationState" AS ENUM (
  'CURRENT',
  'AWAITING_REPORT_ACKNOWLEDGMENT',
  'REBUILD_REQUIRED',
  'SAFETY_REVALIDATION_REQUIRED'
);

UPDATE "UserProfile"
SET "ricePreference" = 'FLEXIBLE'
WHERE "ricePreference" IS NULL;

ALTER TABLE "UserProfile"
  ALTER COLUMN "ricePreference" SET DEFAULT 'FLEXIBLE',
  ALTER COLUMN "ricePreference" SET NOT NULL,
  ADD COLUMN "ricePreferenceProvenance" "RicePreferenceProvenance" NOT NULL DEFAULT 'LEGACY_DEFAULT';

COMMENT ON COLUMN "UserProfile"."carbPreference" IS
  'Deprecated legacy carbohydrate-level preference. It is not a proxy for rice behavior.';
COMMENT ON COLUMN "UserProfile"."ricePreferenceProvenance" IS
  'LEGACY_DEFAULT records the explicit FLEXIBLE migration default until the user selects a value.';

ALTER TABLE "MealPlanCycle"
  ADD COLUMN "profileAdaptationState" "ProfileCycleAdaptationState" NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN "requestedProfileRevision" INTEGER,
  ADD COLUMN "requestedSafetyRevision" INTEGER,
  ADD COLUMN "acknowledgedProfileRevision" INTEGER,
  ADD COLUMN "pendingProfileChangeKinds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MealPlanCycleSnapshot"
  ADD COLUMN "ricePreference" "RicePreference" NOT NULL DEFAULT 'FLEXIBLE',
  ADD COLUMN "ricePreferenceProvenance" "RicePreferenceProvenance" NOT NULL DEFAULT 'LEGACY_DEFAULT';

CREATE INDEX "MealPlanCycle_userId_profileAdaptationState_startDate_idx"
  ON "MealPlanCycle"("userId", "profileAdaptationState", "startDate");
