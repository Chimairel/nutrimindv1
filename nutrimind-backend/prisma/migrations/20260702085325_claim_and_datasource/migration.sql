-- CreateEnum
CREATE TYPE "MealIngredientDataSource" AS ENUM ('FNRI', 'GEMINI_ESTIMATED');

-- AlterTable
ALTER TABLE "MealIngredient" ADD COLUMN     "dataSource" "MealIngredientDataSource" NOT NULL DEFAULT 'FNRI';

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedByNutritionistId" TEXT;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_claimedByNutritionistId_fkey" FOREIGN KEY ("claimedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
