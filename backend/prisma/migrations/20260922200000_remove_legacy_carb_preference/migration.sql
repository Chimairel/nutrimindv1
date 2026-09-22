-- LOW/MODERATE/HIGH described a broad carbohydrate preference and was used as
-- an unsafe proxy for rice behavior. Daily calorie/macro targets and immutable
-- cycle nutrition targets are stored independently, so these labels have no
-- remaining planning or clinical purpose.
ALTER TABLE "MealPlanCycleSnapshot" DROP COLUMN "carbPreference";
ALTER TABLE "UserProfile" DROP COLUMN "carbPreference";
DROP TYPE "CarbPreference";
