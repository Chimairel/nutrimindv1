CREATE TABLE "MealLibraryProfileApproval" (
    "id" TEXT NOT NULL,
    "mealLibraryId" TEXT NOT NULL,
    "safetyScopeKey" VARCHAR(64) NOT NULL,
    "recipeSignature" VARCHAR(64) NOT NULL,
    "evidenceRevision" INTEGER NOT NULL,
    "reviewerNutritionistId" TEXT NOT NULL,
    "reviewPolicyVersion" VARCHAR(64) NOT NULL,
    "sourceProvenance" "MealCandidateProvenance" NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealLibraryProfileApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealLibraryProfileApproval_scope_revision_key"
    ON "MealLibraryProfileApproval"("mealLibraryId", "safetyScopeKey", "evidenceRevision");
CREATE INDEX "MealLibraryProfileApproval_safetyScopeKey_approvedAt_idx"
    ON "MealLibraryProfileApproval"("safetyScopeKey", "approvedAt");

ALTER TABLE "MealLibraryProfileApproval" ADD CONSTRAINT "MealLibraryProfileApproval_mealLibraryId_fkey"
    FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealLibraryProfileApproval" ADD CONSTRAINT "MealLibraryProfileApproval_reviewerNutritionistId_fkey"
    FOREIGN KEY ("reviewerNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
