import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { evaluateMealLibrarySafetyEvidence } from '../src/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '../src/domain/nutritionist-review.policy';

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.mealLibrary.findMany({
    where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE', recipeSignature: null },
    include: {
      ingredients: { orderBy: { position: 'asc' } },
      safetyDeclarations: true,
      safetyReviewedByNutritionist: { include: { user: { select: { role: true, isSuspended: true } } } },
      flags: { where: { status: 'PENDING' } },
    },
  });
  const proposed = rows.map((row) => {
    const evidence = evaluateMealLibrarySafetyEvidence({
      ...row,
      reviewerEligible: row.safetyReviewedByNutritionist
        ? isNutritionistEligibleForReview(row.safetyReviewedByNutritionist)
        : false,
    });
    assert.equal(evidence.complete, true, `Base evidence is incomplete for ${row.id}.`);
    assert.equal(row.flags.length, 0, `Meal ${row.id} has a pending flag.`);
    return {
      id: row.id,
      revision: row.safetyEvidenceRevision,
      signature: buildMealLibraryRecipeSignature({
        mealName: row.mealName,
        mealType: row.mealType,
        calories: row.calories,
        proteinG: row.proteinG,
        carbsG: row.carbsG,
        fatG: row.fatG,
        ingredients: row.ingredients,
      }),
    };
  });
  assert.equal(
    new Set(proposed.map((row) => row.signature)).size,
    proposed.length,
    'Duplicate recipe signatures need review.'
  );
  const occupied = proposed.length
    ? await prisma.mealLibrary.count({ where: { recipeSignature: { in: proposed.map((row) => row.signature) } } })
    : 0;
  assert.equal(occupied, 0, 'A proposed recipe signature is already occupied.');
  console.log(
    JSON.stringify({ mode: apply ? 'apply' : 'dry-run', eligibleCertifiedRows: proposed.length, collisions: occupied })
  );
  if (!apply) return;
  await prisma.$transaction(
    async (tx) => {
      for (const row of proposed) {
        const changed = await tx.mealLibrary.updateMany({
          where: { id: row.id, recipeSignature: null, safetyEvidenceRevision: row.revision },
          data: { recipeSignature: row.signature },
        });
        assert.equal(changed.count, 1, `Evidence changed before signing ${row.id}.`);
        await tx.auditEvent.create({
          data: {
            actorUserId: null,
            action: 'CERTIFIED_RECIPE_SIGNATURE_BACKFILLED',
            entityType: 'MealLibrary',
            entityId: row.id,
            metadata: { recipeSignature: row.signature, evidenceRevision: row.revision },
          },
        });
      }
    },
    { timeout: 30_000 }
  );
  console.log(JSON.stringify({ signed: proposed.length }));
}

main()
  .catch((error) => {
    console.error('[Certified signature backfill] FAILED', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
