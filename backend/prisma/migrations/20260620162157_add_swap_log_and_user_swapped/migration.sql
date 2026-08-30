-- AlterEnum
ALTER TYPE "MealLogSource" ADD VALUE 'USER_SWAPPED';

-- CreateTable
CREATE TABLE "SwapLog" (
    "id" TEXT NOT NULL,
    "planSwapTrackerId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "originalMealName" TEXT NOT NULL,
    "originalCalories" DOUBLE PRECISION NOT NULL,
    "newMealName" TEXT NOT NULL,
    "newCalories" DOUBLE PRECISION NOT NULL,
    "calorieDelta" DOUBLE PRECISION NOT NULL,
    "warningShown" BOOLEAN NOT NULL DEFAULT false,
    "warningAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "swappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SwapLog" ADD CONSTRAINT "SwapLog_planSwapTrackerId_fkey" FOREIGN KEY ("planSwapTrackerId") REFERENCES "PlanSwapTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapLog" ADD CONSTRAINT "SwapLog_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
