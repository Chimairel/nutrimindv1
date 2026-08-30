-- CreateEnum
CREATE TYPE "MealLibraryStatus" AS ENUM ('APPROVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'RESOLVED_REMOVED', 'RESOLVED_KEPT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MEAL_FLAGGED';
ALTER TYPE "NotificationType" ADD VALUE 'FLAG_RESOLVED';

-- AlterTable
ALTER TABLE "MealLibrary" ADD COLUMN     "status" "MealLibraryStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "MealLibraryFlag" (
    "id" TEXT NOT NULL,
    "mealLibraryId" TEXT NOT NULL,
    "flaggedByNutritionistId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLibraryFlag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MealLibraryFlag" ADD CONSTRAINT "MealLibraryFlag_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLibraryFlag" ADD CONSTRAINT "MealLibraryFlag_flaggedByNutritionistId_fkey" FOREIGN KEY ("flaggedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
