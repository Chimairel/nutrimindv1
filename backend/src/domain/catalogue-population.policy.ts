import { createHash } from 'node:crypto';
import type { CommonMealDefinition } from '@/data/common-meal-catalogue';

export const LEGACY_CATALOGUE_REVIEW_REASONS = Object.freeze([
  'NUTRIMIND_COMMON_LIBRARY_V1',
  'NUTRIMIND_COMMON_LIBRARY_V2',
] as const);

export const CURRENT_CATALOGUE_REVIEW_REASON = 'NUTRIMIND_COMMON_LIBRARY_V3';

export const MANAGED_CATALOGUE_REVIEW_REASONS = Object.freeze([
  ...LEGACY_CATALOGUE_REVIEW_REASONS,
  CURRENT_CATALOGUE_REVIEW_REASON,
] as const);

export function catalogueDefinitionSignature(meal: CommonMealDefinition): string {
  return createHash('sha256').update(JSON.stringify(meal)).digest('hex');
}

export function hasCurrentCatalogueDefinition(
  meal: CommonMealDefinition,
  candidate: {
    safetyEvidenceStatus?: unknown;
    safetyReviews?: readonly {
      reasonCode?: unknown;
      evidenceSnapshot?: unknown;
    }[];
  },
): boolean {
  if (candidate.safetyEvidenceStatus !== 'COMPLETE' || !Array.isArray(candidate.safetyReviews)) {
    return false;
  }

  const signature = catalogueDefinitionSignature(meal);
  return candidate.safetyReviews.some((review) => {
    const snapshot = review.evidenceSnapshot;
    return review.reasonCode === CURRENT_CATALOGUE_REVIEW_REASON
      && typeof snapshot === 'object'
      && snapshot !== null
      && !Array.isArray(snapshot)
      && (snapshot as { signature?: unknown }).signature === signature;
  });
}

export function shouldUpdateCatalogueVerifiedCount(current: number, expected: number): boolean {
  return current !== expected;
}
