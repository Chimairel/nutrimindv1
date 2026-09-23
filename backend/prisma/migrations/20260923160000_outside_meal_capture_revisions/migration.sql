ALTER TYPE "MealLogDataSource" ADD VALUE 'USER_ADJUSTED_LIBRARY';
ALTER TYPE "MealLogStatus" ADD VALUE 'VOIDED';
ALTER TYPE "OutsideMealItemSource" ADD VALUE 'USER_ADJUSTED_LIBRARY';
ALTER TYPE "OutsideMealNutritionStatus" ADD VALUE 'UNVERIFIABLE';
ALTER TYPE "OutsideMealNutritionStatus" ADD VALUE 'VOIDED';
ALTER TYPE "OutsideMealReviewStatus" ADD VALUE 'UNVERIFIABLE';

ALTER TABLE "MealLog"
ADD COLUMN "estimationContext" TEXT,
ADD COLUMN "outsidePreviewId" TEXT,
ADD COLUMN "outsideSafetyFollowUp" JSONB,
ADD COLUMN "outsideImage" BYTEA,
ADD COLUMN "outsideImageMime" VARCHAR(40),
ADD COLUMN "voidedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MealLog_outsidePreviewId_key" ON "MealLog"("outsidePreviewId");

ALTER TABLE "OutsideMealItemRevision"
ADD COLUMN "snapshot" JSONB,
ADD COLUMN "editedByUserId" TEXT;

ALTER TABLE "OutsideMealPreview"
ADD COLUMN "estimationContext" TEXT,
ADD COLUMN "loggedForAt" TIMESTAMP(3),
ADD COLUMN "requestPayloadHash" CHAR(64);
