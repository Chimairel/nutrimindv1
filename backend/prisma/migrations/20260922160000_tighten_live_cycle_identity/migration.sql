DO $$
BEGIN
  IF EXISTS (
    SELECT "userId", "startDate"
    FROM "MealPlanCycle"
    WHERE "status" <> 'SUPERSEDED'
    GROUP BY "userId", "startDate"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one live cycle per user and start date: duplicate live identities exist.';
  END IF;
END $$;

DROP INDEX "MealPlanCycle_one_live_identity_key";

CREATE UNIQUE INDEX "MealPlanCycle_one_live_identity_key"
  ON "MealPlanCycle"("userId", "startDate")
  WHERE "status" <> 'SUPERSEDED';
