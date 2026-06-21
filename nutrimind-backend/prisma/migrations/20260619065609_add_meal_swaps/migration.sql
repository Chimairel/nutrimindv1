-- DropIndex
DROP INDEX "MealPlan_libraryMealId_key";

-- CreateTable
CREATE TABLE "PlanSwapTracker" (
    "id" TEXT NOT NULL,
    "planGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "swapsUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSwapTracker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanSwapTracker_planGroupId_key" ON "PlanSwapTracker"("planGroupId");

-- AddForeignKey
ALTER TABLE "PlanSwapTracker" ADD CONSTRAINT "PlanSwapTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
