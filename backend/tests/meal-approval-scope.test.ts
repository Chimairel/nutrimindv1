import assert from 'node:assert/strict';
import test from 'node:test';
import { mealApprovalSafetyScope } from '../src/domain/meal-approval-scope.policy';

test('approval scope ignores goals while preserving the exact recorded safety context', () => {
  const base = {
    conditions: ['NONE'],
    allergens: ['DAIRY'],
    safetyEntries: [{ domain: 'ALLERGY', canonicalCode: 'DAIRY', originalText: 'milk', supportState: 'SUPPORTED' }],
  };
  const first = mealApprovalSafetyScope(base);
  assert.equal(first.supported, true);
  assert.equal(first.key, mealApprovalSafetyScope({ ...base, allergens: ['DAIRY', 'DAIRY'] }).key);
  assert.notEqual(first.key, mealApprovalSafetyScope({
    ...base,
    safetyEntries: [{ ...base.safetyEntries[0], canonicalCode: 'SOY' }],
  }).key);
  assert.notEqual(first.key, mealApprovalSafetyScope({
    ...base,
    safetyEntries: [{ ...base.safetyEntries[0], domain: 'INTOLERANCE' }],
  }).key);
  assert.notEqual(first.key, mealApprovalSafetyScope({
    ...base,
    safetyEntries: [{ ...base.safetyEntries[0], supportState: 'PENDING_REVIEW' }],
  }).key);
});

test('unsupported custom restrictions cannot be automatically shared', () => {
  const scope = mealApprovalSafetyScope({ conditions: ['NONE'], allergens: ['NONE'], otherConditions: 'Unclear illness' });
  assert.equal(scope.supported, false);
  assert.notEqual(scope.key, mealApprovalSafetyScope({ conditions: ['NONE'], allergens: ['NONE'] }).key);
});
