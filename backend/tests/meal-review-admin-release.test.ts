import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { MealReviewService } from '../src/services/meal-review.service';

// Exercise the service transaction with current context, actor, version and evidence guards.
test('admin alone releases quarantine without inventing clinical verification or releasing member holds', async () => {
  const original = prisma.$transaction;
  const writes: { table: string; args: any }[] = [];
  let role = 'ADMIN';
  let suspended = false;
  let state = 'QUARANTINED';
  let validEvidence = true;
  const meal = {
    id: 'recipe',
    recipeFamilyId: null,
    sourceRawRecipeCandidateId: null,
    status: 'FLAGGED',
    recipeSignature: 'recorded',
    nutritionServingDescription: 'One measured bowl',
    description: 'Recorded recipe',
    calories: 300,
    proteinG: 20,
    carbsG: 40,
    fatG: 10,
    nutritionEvidenceSource: 'FNRI',
    ingredients: [
      { foodItemId: 'food', quantity: 100, unit: 'g', foodItem: { source: 'FNRI', compositionRevision: 1 } },
    ],
    safetyDeclarations: [],
  };
  const incident = () => ({ id: 'incident', number: 2, state, closedAt: null, reports: [], confirmations: [] });
  const write = (table: string) => async (args: any) => {
    writes.push({ table, args });
    return {};
  };
  const tx = {
    $executeRaw: async () => 1,
    user: { findUnique: async () => ({ id: 'actor', name: 'Administrator', role, isSuspended: suspended }) },
    mealLibrary: {
      findUnique: async () => meal,
      findUniqueOrThrow: async () => meal,
      findMany: async () => [{ ...meal, calories: validEvidence ? 300 : 0 }],
      updateMany: write('library'),
    },
    mealReviewLineage: {
      findUnique: async () => ({ id: 'lineage', state, incidents: [incident()] }),
      update: write('lineage'),
    },
    mealReviewIncident: { findMany: async () => [], update: write('incident') },
    auditEvent: { findFirst: async () => null, create: write('audit') },
    mealLibraryFlag: { updateMany: write('flag') },
    mealReviewDecision: { create: write('decision') },
    mealBaseVerification: {
      upsert: async () => {
        throw new Error('Admin must not create an RND verification');
      },
    },
    mealPlan: {
      updateMany: async () => {
        throw new Error('Member holds must remain');
      },
    },
    mealLibraryProfileApproval: {
      updateMany: async () => {
        throw new Error('Private approvals must remain flagged');
      },
    },
  };
  prisma.$transaction = (async (callback: any) => callback(tx)) as never;
  const rationale = 'Reviewed current recipe concerns and evidence for administrative release.';
  try {
    const detail = await MealReviewService.detail('recipe');
    assert.equal(detail.canAdminRelease, true);
    assert.equal(detail.validConfirmations.length, 0);
    assert.deepEqual(
      await MealReviewService.adminAction('actor', 'recipe', 'release', detail.reviewVersion, rationale),
      { state: 'PUBLISHED' }
    );
    assert.deepEqual(writes.find((row) => row.table === 'library')?.args.data, { status: 'APPROVED' });
    assert.equal(writes.find((row) => row.table === 'decision')?.args.data.action, 'ADMIN_RELEASED');
    assert.equal(writes.find((row) => row.table === 'audit')?.args.data.actorRole, 'ADMIN');
    writes.length = 0;
    await assert.rejects(MealReviewService.adminAction('actor', 'recipe', 'release', 'old-version', rationale), {
      errorCode: 'REVIEW_VERSION_CONFLICT',
    });
    validEvidence = false;
    const incomplete = await MealReviewService.detail('recipe');
    await assert.rejects(
      MealReviewService.adminAction('actor', 'recipe', 'release', incomplete.reviewVersion, rationale),
      { errorCode: 'REVIEW_EVIDENCE_REQUIRED' }
    );
    validEvidence = true;
    state = 'PENDING_REREVIEW';
    await assert.rejects(MealReviewService.adminAction('actor', 'recipe', 'release', detail.reviewVersion, rationale), {
      errorCode: 'RND_REVIEW_REQUIRED',
    });
    state = 'QUARANTINED';
    role = 'NUTRITIONIST';
    await assert.rejects(MealReviewService.adminAction('actor', 'recipe', 'release', detail.reviewVersion, rationale), {
      errorCode: 'ADMIN_REQUIRED',
    });
    role = 'ADMIN';
    suspended = true;
    await assert.rejects(MealReviewService.adminAction('actor', 'recipe', 'release', detail.reviewVersion, rationale), {
      errorCode: 'REVIEWER_INELIGIBLE',
    });
    assert.equal(writes.length, 0);
  } finally {
    prisma.$transaction = original;
  }
});
