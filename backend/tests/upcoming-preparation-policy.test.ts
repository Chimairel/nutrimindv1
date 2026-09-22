import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssuranceTier,
  RecipeRiceRole,
  RicePreference,
  RiceRoleReviewStatus,
} from '@prisma/client';
import {
  buildReviewWorkKey,
  chooseCookedRicePortionG,
  compareDeadlineReviewPriority,
  getPreparationLeadDays,
  scorePreparationCandidate,
} from '@/domain/upcoming-preparation.policy';

test('upcoming preparation opens three days early, or five for enhanced assurance', () => {
  assert.equal(getPreparationLeadDays(AssuranceTier.BASE), 3);
  assert.equal(getPreparationLeadDays(AssuranceTier.STANDARD), 3);
  assert.equal(getPreparationLeadDays(AssuranceTier.ENHANCED), 5);
});

test('cleared candidates outrank otherwise equivalent pending candidates without claiming safety probability', () => {
  const common = {
    allergenDeclarationsComplete: true,
    ingredientsResolved: true,
    nutrientsComplete: true,
    dietCompatible: true,
    calorieDeviationRatio: 0.05,
    mealTypeMatch: true,
    ricePreference: RicePreference.WITH_RICE,
    riceRole: RecipeRiceRole.PAIR_WITH_RICE,
    riceRoleReviewStatus: RiceRoleReviewStatus.REVIEWED,
    localityScore: 2,
    usedInRecentCycle: false,
  } as const;
  const cleared = scorePreparationCandidate({
    ...common,
    activeClearanceCoverage: true,
    remainingReviews: 0,
  });
  const pending = scorePreparationCandidate({
    ...common,
    activeClearanceCoverage: false,
    remainingReviews: 1,
  });

  assert.ok(cleared.score > pending.score);
  assert.ok(cleared.reasonCodes.includes('ACTIVE_CLEARANCE_COVERAGE'));
  assert.ok(cleared.reasonCodes.includes('NO_REVIEW_REMAINING'));
  assert.ok(!pending.reasonCodes.includes('ACTIVE_CLEARANCE_COVERAGE'));
});

test('review-work identity is stable across restriction ordering and changes when its safety scope changes', () => {
  const shared = {
    recipeSignature: 'recipe-abc',
    evidenceRevision: 2,
    policyVersion: 'POLICY_V3',
    requiredReviewerCount: 2,
  };
  const first = buildReviewWorkKey({
    ...shared,
    conditions: ['PREGNANT', 'KIDNEY_DISEASE', 'PREGNANT'],
    allergens: ['PEANUTS', 'DAIRY'],
  });
  const reordered = buildReviewWorkKey({
    ...shared,
    conditions: ['KIDNEY_DISEASE', 'PREGNANT'],
    allergens: ['DAIRY', 'PEANUTS'],
  });
  const changed = buildReviewWorkKey({
    ...shared,
    conditions: ['KIDNEY_DISEASE'],
    allergens: ['DAIRY', 'PEANUTS'],
  });

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('rice composition chooses only a reviewed fixed portion that keeps the slot in range', () => {
  assert.equal(
    chooseCookedRicePortionG({
      baseCalories: 350,
      riceCaloriesPer100G: 130,
      slotTargetCalories: 550,
      slotMinimumCalories: 500,
      slotMaximumCalories: 620,
    }),
    150
  );
  assert.equal(
    chooseCookedRicePortionG({
      baseCalories: 700,
      riceCaloriesPer100G: 130,
      slotTargetCalories: 550,
      slotMinimumCalories: 500,
      slotMaximumCalories: 620,
    }),
    null
  );
});

test('review queue priority is deadline first, then cook date, then enhanced second review', () => {
  const createdAt = new Date('2026-09-01T00:00:00.000Z');
  const urgent = {
    shoppingDeadlineAt: new Date('2026-09-20T00:00:00.000Z'),
    scheduledDate: new Date('2026-09-24T00:00:00.000Z'),
    enhancedSecondReview: false,
    createdAt,
  };
  const later = {
    ...urgent,
    shoppingDeadlineAt: new Date('2026-09-21T00:00:00.000Z'),
    enhancedSecondReview: true,
  };
  assert.ok(compareDeadlineReviewPriority(urgent, later) < 0);

  const primary = { ...urgent, enhancedSecondReview: false };
  const secondary = { ...urgent, enhancedSecondReview: true };
  assert.ok(compareDeadlineReviewPriority(secondary, primary) < 0);
});
