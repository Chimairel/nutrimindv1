import 'dotenv/config';
import {
  MealLibraryCrossContactAssessment,
  MealLibraryDeclarationState,
  MealLibrarySafetyEvidenceOrigin,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyReviewOutcome,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const REASON_CODE = 'FALSE_PANLASANG_BATCH_CERTIFICATION';

const falseCertificationWhere: Prisma.MealLibraryWhereInput = {
  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
  safetyReviews: {
    some: {
      outcome: MealLibrarySafetyReviewOutcome.CERTIFIED,
      reasonCode: 'CAPSTONE_SOURCE_BATCH',
      AND: [
        { evidenceSnapshot: { path: ['source'], equals: 'PANLASANG_PINOY' } },
        { evidenceSnapshot: { path: ['fixtureReviewer'], equals: true } },
      ],
    },
  },
};

async function main() {
  const candidates = await prisma.mealLibrary.findMany({
    where: falseCertificationWhere,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      mealName: true,
      safetyEvidenceRevision: true,
      certifiedEvidenceRevision: true,
      safetyPolicyVersion: true,
      safetyReviewedByNutritionistId: true,
      _count: { select: { safetyDeclarations: true } },
    },
  });

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    matchedMeals: candidates.length,
    matchedDeclarations: candidates.reduce((total, meal) => total + meal._count.safetyDeclarations, 0),
    withFixtureSafetyReviewer: candidates.filter((meal) => meal.safetyReviewedByNutritionistId !== null).length,
    withCertifiedRevision: candidates.filter((meal) => meal.certifiedEvidenceRevision !== null).length,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply || candidates.length === 0) return;

  const ids = candidates.map((meal) => meal.id);
  const invalidatedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;

      const declarations = await tx.mealLibrarySafetyDeclaration.deleteMany({
        where: { mealLibraryId: { in: ids } },
      });

      const invalidated = await tx.mealLibrary.updateMany({
        where: { id: { in: ids }, ...falseCertificationWhere },
        data: {
          verifiedByNutritionistId: null,
          safetyReviewedByNutritionistId: null,
          safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
          safetyEvidenceOrigin: MealLibrarySafetyEvidenceOrigin.LEGACY_UNREVIEWED,
          conditionDeclarationState: MealLibraryDeclarationState.NOT_REVIEWED,
          allergenDeclarationState: MealLibraryDeclarationState.NOT_REVIEWED,
          crossContactAssessment: MealLibraryCrossContactAssessment.NOT_ASSESSED,
          certifiedEvidenceRevision: null,
          safetyPolicyVersion: null,
          safetyReviewedAt: null,
          safetyInvalidatedAt: invalidatedAt,
          safetyInvalidationReason: REASON_CODE,
          suitableConditions: [],
          allergenFree: [],
        },
      });

      if (invalidated.count !== candidates.length) {
        throw new Error(
          `Concurrent change detected: expected ${candidates.length} rows, invalidated ${invalidated.count}.`
        );
      }

      await tx.mealLibrarySafetyReview.createMany({
        data: candidates.map((meal) => ({
          mealLibraryId: meal.id,
          nutritionistProfileId: null,
          outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
          evidenceRevision: meal.safetyEvidenceRevision,
          policyVersion: meal.safetyPolicyVersion,
          reasonCode: REASON_CODE,
          evidenceSnapshot: {
            source: 'PANLASANG_PINOY',
            invalidatedAt: invalidatedAt.toISOString(),
            priorCertifiedEvidenceRevision: meal.certifiedEvidenceRevision,
            priorSafetyReviewerId: meal.safetyReviewedByNutritionistId,
          },
        })),
      });

      console.log(
        JSON.stringify(
          {
            applied: true,
            invalidatedMeals: invalidated.count,
            deletedDeclarations: declarations.count,
            appendedAuditRows: candidates.length,
          },
          null,
          2
        )
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
