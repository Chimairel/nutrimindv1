-- CreateEnum
CREATE TYPE "ShoppingDayGroup" AS ENUM ('WEEKEND', 'WEEKDAY');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('STARTER', 'WEEKLY');

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "shoppingDayGroup" "ShoppingDayGroup";
