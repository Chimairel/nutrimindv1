-- Earlier hand-written migrations used PostgreSQL's implicit ON UPDATE NO ACTION
-- for these two foreign keys. Prisma's declared relations use ON UPDATE CASCADE.
-- Existing long-lived databases may already have the latter, so change only
-- constraints that still carry the old action.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"FoodCompositionRevision"'::regclass
      AND conname = 'FoodCompositionRevision_foodItemId_fkey'
      AND confupdtype <> 'c'
  ) THEN
    ALTER TABLE "FoodCompositionRevision"
      DROP CONSTRAINT "FoodCompositionRevision_foodItemId_fkey";
    ALTER TABLE "FoodCompositionRevision"
      ADD CONSTRAINT "FoodCompositionRevision_foodItemId_fkey"
      FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"NutritionReportVersion"'::regclass
      AND conname = 'NutritionReportVersion_userId_fkey'
      AND confupdtype <> 'c'
  ) THEN
    ALTER TABLE "NutritionReportVersion"
      DROP CONSTRAINT "NutritionReportVersion_userId_fkey";
    ALTER TABLE "NutritionReportVersion"
      ADD CONSTRAINT "NutritionReportVersion_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The old geography index is absent from the current datamodel and from the
-- shared development database. Remove it on a clean migration replay too.
DROP INDEX IF EXISTS "UserProfile_planning_geography_idx";
