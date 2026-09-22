ALTER TYPE "RicePreferenceProvenance" RENAME VALUE 'LEGACY_DEFAULT' TO 'DEFAULTED';

ALTER TABLE "UserProfile"
  ALTER COLUMN "ricePreferenceProvenance" SET DEFAULT 'DEFAULTED';

ALTER TABLE "MealPlanCycleSnapshot"
  ALTER COLUMN "ricePreferenceProvenance" SET DEFAULT 'DEFAULTED';

COMMENT ON COLUMN "UserProfile"."ricePreferenceProvenance" IS
  'DEFAULTED identifies migrated or not-yet-confirmed FLEXIBLE values; USER_SELECTED records an explicit choice.';
