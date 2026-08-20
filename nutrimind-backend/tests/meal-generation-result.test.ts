import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPendingMealPlanPreview,
  summarizeGeneratedMealPlan,
  summarizePendingMealPlan,
} from '../src/domain/meal-generation-result.policy';

const pendingStarterRows = Array.from({ length: 9 }, () => ({
  planType: 'STARTER',
  status: 'PENDING_REVIEW',
}));

test('[TEST-035] generated pending meals produce a non-actionable review summary', () => {
  assert.deepEqual(summarizeGeneratedMealPlan(pendingStarterRows), {
    generatedMealCount: 9,
    pendingReview: {
      mealCount: 9,
      planType: 'STARTER',
      reviewStatus: 'PENDING_REVIEW',
    },
  });
});

test('[TEST-035] no pending rows produce no pending-review summary', () => {
  assert.equal(
    summarizePendingMealPlan([{ planType: 'WEEKLY', status: 'APPROVED' }]),
    null
  );
});

test('[TEST-035] a zero-meal generation result cannot report false success', () => {
  assert.throws(
    () => summarizeGeneratedMealPlan([]),
    /without creating any meal records/
  );
});

test('[TEST-035] pending preview exposes every pending meal without internal identifiers', () => {
  const rowWithInternalId = {
    id: 'must-not-be-returned',
    planType: 'STARTER',
    status: 'PENDING_REVIEW',
    mealName: 'Synthetic meal',
    mealType: 'BREAKFAST',
    description: 'Synthetic description',
    calories: 400,
    proteinG: 20,
    carbsG: 50,
    fatG: 12,
    scheduledDate: '2026-08-20T00:00:00.000Z',
    ingredients: [{ ingredientName: 'Synthetic ingredient', category: 'PANTRY' }],
  };
  const preview = buildPendingMealPlanPreview([rowWithInternalId]);

  assert.equal(preview?.mealCount, 1);
  assert.equal(preview?.meals.length, 1);
  assert.equal(preview?.meals[0]?.mealName, 'Synthetic meal');
  assert.equal('id' in (preview?.meals[0] ?? {}), false);
  assert.equal('status' in (preview?.meals[0] ?? {}), false);
});
