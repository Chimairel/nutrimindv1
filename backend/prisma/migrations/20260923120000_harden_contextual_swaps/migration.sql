ALTER TABLE "MealPlan"
ADD COLUMN "userSelectionPinnedAt" TIMESTAMP(3);

ALTER TABLE "SwapLog"
ADD COLUMN "groceryDeltaAcknowledged" BOOLEAN NOT NULL DEFAULT false;
