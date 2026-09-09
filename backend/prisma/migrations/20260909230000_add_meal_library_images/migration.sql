CREATE TYPE "MealImageKind" AS ENUM ('EXACT', 'REPRESENTATIVE');

ALTER TABLE "MealLibrary"
ADD COLUMN "imagePublicId" VARCHAR(255),
ADD COLUMN "imageVersion" VARCHAR(32),
ADD COLUMN "imageFormat" VARCHAR(16),
ADD COLUMN "imageWidth" INTEGER,
ADD COLUMN "imageHeight" INTEGER,
ADD COLUMN "imageBytes" INTEGER,
ADD COLUMN "imageKind" "MealImageKind",
ADD COLUMN "imageAltText" VARCHAR(240),
ADD COLUMN "imageCreator" VARCHAR(180),
ADD COLUMN "imageSourcePageUrl" VARCHAR(2048),
ADD COLUMN "imageLicenseCode" VARCHAR(64),
ADD COLUMN "imageLicenseUrl" VARCHAR(2048),
ADD COLUMN "imageAssignedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MealLibrary_imagePublicId_key" ON "MealLibrary"("imagePublicId");

ALTER TABLE "MealLibrary"
ADD CONSTRAINT "MealLibrary_image_dimensions_check"
CHECK (
  ("imagePublicId" IS NULL AND "imageVersion" IS NULL AND "imageFormat" IS NULL
    AND "imageWidth" IS NULL AND "imageHeight" IS NULL AND "imageBytes" IS NULL
    AND "imageKind" IS NULL AND "imageAltText" IS NULL AND "imageCreator" IS NULL
    AND "imageSourcePageUrl" IS NULL AND "imageLicenseCode" IS NULL
    AND "imageLicenseUrl" IS NULL AND "imageAssignedAt" IS NULL)
  OR
  ("imagePublicId" IS NOT NULL AND "imageVersion" IS NOT NULL AND "imageFormat" IS NOT NULL
    AND "imageWidth" >= 320 AND "imageHeight" >= 240 AND "imageBytes" > 0
    AND "imageBytes" <= 5242880 AND "imageKind" IS NOT NULL
    AND length("imageAltText") >= 8 AND "imageAssignedAt" IS NOT NULL)
);

ALTER TABLE "MealLibrary"
ADD CONSTRAINT "MealLibrary_image_attribution_check"
CHECK (
  "imagePublicId" IS NULL
  OR "imageLicenseCode" IN ('OWNED', 'GENERATED', 'CC0', 'PUBLIC_DOMAIN', 'CC_BY_4_0', 'CC_BY_SA_4_0')
);
