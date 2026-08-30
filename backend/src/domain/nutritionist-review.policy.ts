import { AIConfidenceFlag } from '@prisma/client';
import { getManilaBusinessDateKey } from './meal-actionability.policy';

export const REVIEW_CLAIM_TTL_MS = 30 * 60 * 1000;

type ClaimCandidate = {
  claimedByNutritionistId: string | null;
  claimedAt: Date | null;
};

type EligibilityCandidate = {
  isVerified: boolean;
  prcLicenseExpiry: Date;
};

export function getReviewClaimCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - REVIEW_CLAIM_TTL_MS);
}

export function isReviewClaimActive(
  claim: ClaimCandidate,
  now: Date = new Date()
): boolean {
  return Boolean(
    claim.claimedByNutritionistId &&
    claim.claimedAt &&
    claim.claimedAt >= getReviewClaimCutoff(now)
  );
}

export function canAcquireReviewClaim(
  claim: ClaimCandidate,
  nutritionistProfileId: string,
  now: Date = new Date()
): boolean {
  return !isReviewClaimActive(claim, now) ||
    claim.claimedByNutritionistId === nutritionistProfileId;
}

export function getReviewPriority(flag: AIConfidenceFlag): number {
  switch (flag) {
    case AIConfidenceFlag.NEEDS_REVIEW:
      return 0;
    case AIConfidenceFlag.CAUTION:
      return 1;
    case AIConfidenceFlag.SAFE:
    default:
      return 2;
  }
}

export function isNutritionistEligibleForReview(
  profile: EligibilityCandidate,
  now: Date = new Date()
): boolean {
  if (!profile.isVerified) return false;

  const expiryDate = getManilaBusinessDateKey(profile.prcLicenseExpiry);
  const currentDate = getManilaBusinessDateKey(now);
  return Boolean(expiryDate && currentDate && expiryDate >= currentDate);
}
