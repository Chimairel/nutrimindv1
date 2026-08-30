import assert from 'node:assert/strict';
import test from 'node:test';
import { AIConfidenceFlag } from '@prisma/client';
import {
  canAcquireReviewClaim,
  getReviewPriority,
  isNutritionistEligibleForReview,
  isReviewClaimActive,
} from '../src/domain/nutritionist-review.policy';

const now = new Date('2026-08-30T04:00:00.000Z');

test('[TEST-046][DEF-013] review severity keeps NEEDS_REVIEW ahead of CAUTION and SAFE', () => {
  assert.equal(getReviewPriority(AIConfidenceFlag.NEEDS_REVIEW), 0);
  assert.equal(getReviewPriority(AIConfidenceFlag.CAUTION), 1);
  assert.equal(getReviewPriority(AIConfidenceFlag.SAFE), 2);
});

test('[TEST-047][DEF-013] active claims are exclusive to their owner', () => {
  const activeClaim = {
    claimedByNutritionistId: 'nutritionist-a',
    claimedAt: new Date(now.getTime() - 5 * 60 * 1000),
  };

  assert.equal(isReviewClaimActive(activeClaim, now), true);
  assert.equal(canAcquireReviewClaim(activeClaim, 'nutritionist-a', now), true);
  assert.equal(canAcquireReviewClaim(activeClaim, 'nutritionist-b', now), false);
});

test('[TEST-048][DEF-013] expired and unclaimed reviews can be acquired', () => {
  const expiredClaim = {
    claimedByNutritionistId: 'nutritionist-a',
    claimedAt: new Date(now.getTime() - 31 * 60 * 1000),
  };

  assert.equal(isReviewClaimActive(expiredClaim, now), false);
  assert.equal(canAcquireReviewClaim(expiredClaim, 'nutritionist-b', now), true);
  assert.equal(canAcquireReviewClaim({ claimedByNutritionistId: null, claimedAt: null }, 'nutritionist-b', now), true);
});

test('[TEST-049][DEF-010] reviewer eligibility requires verification and a non-expired Manila license date', () => {
  assert.equal(isNutritionistEligibleForReview({ isVerified: true, prcLicenseExpiry: new Date('2026-08-30T00:00:00.000Z') }, now), true);
  assert.equal(isNutritionistEligibleForReview({ isVerified: false, prcLicenseExpiry: new Date('2027-01-01T00:00:00.000Z') }, now), false);
  assert.equal(isNutritionistEligibleForReview({ isVerified: true, prcLicenseExpiry: new Date('2026-08-28T00:00:00.000Z') }, now), false);
});
