import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresEscalatedMealReview } from '../src/domain/meal-plan-production-safety.policy';

test('[TEST-065] kidney and pregnancy contexts require two independent reviewers', () => {
  assert.equal(requiresEscalatedMealReview(['KIDNEY_DISEASE']), true);
  assert.equal(requiresEscalatedMealReview(['PREGNANT']), true);
  assert.equal(requiresEscalatedMealReview([], 'currently lactating'), true);
  assert.equal(requiresEscalatedMealReview([], 'receiving renal dialysis'), true);
});

test('[TEST-066] ordinary profile contexts do not invent high-risk escalation', () => {
  assert.equal(requiresEscalatedMealReview(['NONE']), false);
  assert.equal(requiresEscalatedMealReview(['HYPERTENSION']), false);
  assert.equal(requiresEscalatedMealReview([], 'seasonal concern'), false);
});
