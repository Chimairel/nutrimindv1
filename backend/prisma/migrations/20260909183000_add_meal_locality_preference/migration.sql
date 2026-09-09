CREATE TYPE "MealLocalityPreference" AS ENUM ('NATIONAL', 'REGIONAL', 'LOCAL');

ALTER TABLE "UserProfile"
ADD COLUMN "mealLocalityPreference" "MealLocalityPreference" NOT NULL DEFAULT 'NATIONAL';
