/*
  Warnings:

  - You are about to drop the `NutritionistAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "MealLogSource" ADD VALUE 'SAFETY_REPLACED';

-- DropForeignKey
ALTER TABLE "NutritionistAssignment" DROP CONSTRAINT "NutritionistAssignment_nutritionistProfileId_fkey";

-- DropForeignKey
ALTER TABLE "NutritionistAssignment" DROP CONSTRAINT "NutritionistAssignment_userId_fkey";

-- DropTable
DROP TABLE "NutritionistAssignment";
