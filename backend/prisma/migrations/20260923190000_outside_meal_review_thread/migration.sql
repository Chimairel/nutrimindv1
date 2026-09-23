CREATE TYPE "OutsideMealMessageSender" AS ENUM ('USER', 'NUTRITIONIST');

ALTER TABLE "OutsideMealReview"
ADD COLUMN "claimedRevision" INTEGER,
ADD COLUMN "reviewedRevision" INTEGER,
ADD COLUMN "requestedByUserAt" TIMESTAMP(3),
ADD COLUMN "queueReason" VARCHAR(60);

CREATE TABLE "OutsideMealReviewMessage" (
  "id" TEXT NOT NULL,
  "outsideMealReviewId" TEXT NOT NULL,
  "sender" "OutsideMealMessageSender" NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "itemRevision" INTEGER NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutsideMealReviewMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutsideMealReviewMessage_outsideMealReviewId_createdAt_idx"
ON "OutsideMealReviewMessage"("outsideMealReviewId", "createdAt");

ALTER TABLE "OutsideMealReviewMessage" ADD CONSTRAINT "OutsideMealReviewMessage_outsideMealReviewId_fkey"
FOREIGN KEY ("outsideMealReviewId") REFERENCES "OutsideMealReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
