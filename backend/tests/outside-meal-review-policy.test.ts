import assert from 'node:assert/strict';
import test from 'node:test';
import { OutsideMealCompatibilityStatus, OutsideMealItemSource } from '@prisma/client';
import { outsideReviewQueueReason } from '../src/domain/outside-meal-review.policy';
import { outsideMealReplySchema, outsideMealReviewBodySchema } from '../src/validation/user-action.schemas';

const ordinary = {
  source: OutsideMealItemSource.USER_REPORTED,
  compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
  includedInTotals: true,
  calories: 200, proteinG: 10, carbsG: 25, fatG: 7,
  calorieLow: null, calorieHigh: null,
};

test('[BATCH-8] ordinary estimates stay out of the queue until requested or flagged', () => {
  assert.equal(outsideReviewQueueReason(ordinary, false), null);
  assert.equal(outsideReviewQueueReason({ ...ordinary, source: OutsideMealItemSource.GEMINI_ESTIMATED }, false), null);
  assert.equal(outsideReviewQueueReason({ ...ordinary, source: OutsideMealItemSource.GEMINI_ESTIMATED }, true),
    'DEMO_AI_ESTIMATE');
});

test('[BATCH-8] conflicts, broad uncertainty, and implausible macros trigger bounded review', () => {
  assert.equal(outsideReviewQueueReason({ ...ordinary,
    compatibilityStatus: OutsideMealCompatibilityStatus.CONFLICT_DETECTED }, false), 'SAFETY_CONFLICT');
  assert.equal(outsideReviewQueueReason({ ...ordinary, calorieLow: 100, calorieHigh: 300 }, false),
    'LOW_CONFIDENCE');
  assert.equal(outsideReviewQueueReason({ ...ordinary, calories: 900 }, false), 'IMPLAUSIBLE_VALUES');
});

test('[BATCH-8] decisions require a reason and corrections require every displayed nutrient', () => {
  assert.equal(outsideMealReviewBodySchema.safeParse({ action: 'UNVERIFIABLE', reason: ' ' }).success, false);
  assert.equal(outsideMealReviewBodySchema.safeParse({ action: 'NEEDS_MORE_INFO', reason: 'Portion size?' }).success, true);
  assert.equal(outsideMealReviewBodySchema.safeParse({ action: 'CORRECT', reason: 'Measured label',
    calories: 200, proteinG: 10, carbsG: 20 }).success, false);
  assert.equal(outsideMealReviewBodySchema.safeParse({ action: 'CORRECT', reason: 'Measured label',
    calories: 200, proteinG: 10, carbsG: 20, fatG: 8 }).success, true);
});

test('[BATCH-8] clarification replies are bounded and cannot be blank', () => {
  assert.equal(outsideMealReplySchema.safeParse({ message: '  ' }).success, false);
  assert.equal(outsideMealReplySchema.safeParse({ message: 'One packet, with sauce.' }).success, true);
  assert.equal(outsideMealReplySchema.safeParse({ message: 'x'.repeat(1001) }).success, false);
});
