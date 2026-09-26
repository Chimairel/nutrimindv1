import {
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
  normalizeRestrictionComparisonToken,
} from './restriction-evaluation.policy';

export const MEAL_LIBRARY_SAFETY_POLICY_VERSION = 'NUTRIMIND_LIBRARY_SAFETY_V2';
export const SUPPORTED_MEAL_LIBRARY_SAFETY_POLICY_VERSIONS = [
  'NUTRIMIND_LIBRARY_SAFETY_V1',
  MEAL_LIBRARY_SAFETY_POLICY_VERSION,
] as const;

export const MEAL_LIBRARY_SAFETY_REASON_ORDER = Object.freeze([
  'LIBRARY_NOT_APPROVED',
  'EVIDENCE_NOT_COMPLETE',
  'EVIDENCE_ORIGIN_NOT_REVIEWED',
  'REVISION_NOT_CERTIFIED',
  'POLICY_VERSION_UNSUPPORTED',
  'EVIDENCE_INVALIDATED',
  'REVIEWER_NOT_ELIGIBLE',
  'CONDITION_DOMAIN_NOT_REVIEWED',
  'ALLERGEN_DOMAIN_NOT_REVIEWED',
  'CROSS_CONTACT_NOT_CLEARED',
  'MISSING_LIBRARY_INGREDIENTS',
  'NON_FNRI_LIBRARY_INGREDIENT',
  'UNRESOLVED_LIBRARY_INGREDIENT',
  'UNMEASURED_LIBRARY_INGREDIENT',
  'MALFORMED_DECLARATION',
  'UNSUPPORTED_DECLARATION_KEY',
  'DECLARATION_STATE_MISMATCH',
  'DECLARATION_PROVENANCE_INVALID',
  'RULESET_CLEARANCE_UNSUPPORTED',
] as const);

export type MealLibrarySafetyReason = (typeof MEAL_LIBRARY_SAFETY_REASON_ORDER)[number];

export interface MealLibrarySafetyCandidate {
  status?: unknown;
  safetyEvidenceStatus?: unknown;
  safetyEvidenceOrigin?: unknown;
  conditionDeclarationState?: unknown;
  allergenDeclarationState?: unknown;
  crossContactAssessment?: unknown;
  safetyEvidenceRevision?: unknown;
  certifiedEvidenceRevision?: unknown;
  safetyPolicyVersion?: unknown;
  safetyInvalidatedAt?: unknown;
  reviewerEligible?: unknown;
  ingredients?: unknown;
  nutritionEvidenceSource?: unknown;
  safetyDeclarations?: unknown;
}

export interface MealLibrarySafetyEvaluation {
  /** Base recipe evidence only. Allergen and condition coverage are separate. */
  complete: boolean;
  reasons: MealLibrarySafetyReason[];
  coverageReasons: MealLibrarySafetyReason[];
  suitableConditions: string[];
  allergenFree: string[];
  ingredients: { dataSource: unknown; foodItemId: unknown }[];
  adapterEvidence: {
    complete: boolean;
    baseComplete: boolean;
    detectedAllergens: string[];
    reviewedAbsentAllergens: string[];
    allergenDomainReviewed: boolean;
    crossContactCleared: boolean;
    conditionRuleMatches: string[];
    conditionDomainReviewed: boolean;
  };
}

type UnknownRecord = Record<string, unknown>;

const CONDITION_KEYS = new Set<string>(RESTRICTION_CONDITION_KEYS.filter((key) => key !== 'NONE'));
const ALLERGY_KEYS = new Set<string>(RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE'));
const REASON_ORDER = new Map<MealLibrarySafetyReason, number>(
  MEAL_LIBRARY_SAFETY_REASON_ORDER.map((reason, index) => [reason, index])
);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortReasons(reasons: Set<MealLibrarySafetyReason>): MealLibrarySafetyReason[] {
  return [...reasons].sort((a, b) => (REASON_ORDER.get(a) ?? 999) - (REASON_ORDER.get(b) ?? 999));
}

function hasReviewedState(value: unknown): boolean {
  return value === 'REVIEWED_NONE_DECLARED' || value === 'REVIEWED_WITH_DECLARATIONS';
}

export function evaluateMealLibrarySafetyEvidence(candidate: MealLibrarySafetyCandidate): MealLibrarySafetyEvaluation {
  const baseReasons = new Set<MealLibrarySafetyReason>();
  const coverageReasons = new Set<MealLibrarySafetyReason>();

  if (!isRecord(candidate)) {
    baseReasons.add('EVIDENCE_NOT_COMPLETE');
    return {
      complete: false,
      reasons: sortReasons(baseReasons),
      coverageReasons: [],
      suitableConditions: [],
      allergenFree: [],
      ingredients: [],
      adapterEvidence: {
        complete: false,
        baseComplete: false,
        detectedAllergens: [],
        reviewedAbsentAllergens: [],
        allergenDomainReviewed: false,
        crossContactCleared: false,
        conditionRuleMatches: [],
        conditionDomainReviewed: false,
      },
    };
  }

  if (candidate.status !== 'APPROVED') baseReasons.add('LIBRARY_NOT_APPROVED');
  if (candidate.safetyEvidenceStatus !== 'COMPLETE') baseReasons.add('EVIDENCE_NOT_COMPLETE');
  if (candidate.safetyEvidenceOrigin !== 'NUTRITIONIST_REVIEW') {
    baseReasons.add('EVIDENCE_ORIGIN_NOT_REVIEWED');
  }
  if (candidate.reviewerEligible !== true) baseReasons.add('REVIEWER_NOT_ELIGIBLE');

  const revision = candidate.safetyEvidenceRevision;
  if (
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision <= 0 ||
    candidate.certifiedEvidenceRevision !== revision
  ) {
    baseReasons.add('REVISION_NOT_CERTIFIED');
  }
  if (
    !SUPPORTED_MEAL_LIBRARY_SAFETY_POLICY_VERSIONS.includes(
      candidate.safetyPolicyVersion as (typeof SUPPORTED_MEAL_LIBRARY_SAFETY_POLICY_VERSIONS)[number]
    )
  ) {
    baseReasons.add('POLICY_VERSION_UNSUPPORTED');
  }
  if (candidate.safetyInvalidatedAt !== null && candidate.safetyInvalidatedAt !== undefined) {
    baseReasons.add('EVIDENCE_INVALIDATED');
  }

  const hasEligibleReviewProvenance =
    candidate.safetyEvidenceOrigin === 'NUTRITIONIST_REVIEW' && candidate.reviewerEligible === true;
  const crossContactCleared = candidate.crossContactAssessment === 'ASSESSED_NO_KNOWN_RISK';
  if (!crossContactCleared) coverageReasons.add('CROSS_CONTACT_NOT_CLEARED');

  const ingredients: { dataSource: unknown; foodItemId: unknown }[] = [];
  if (!Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0) {
    baseReasons.add('MISSING_LIBRARY_INGREDIENTS');
  } else {
    for (const ingredient of candidate.ingredients) {
      if (!isRecord(ingredient)) {
        baseReasons.add('UNRESOLVED_LIBRARY_INGREDIENT');
        continue;
      }
      ingredients.push({
        dataSource: ingredient.dataSource,
        foodItemId: ingredient.foodItemId,
      });
      const v2 = candidate.safetyPolicyVersion === MEAL_LIBRARY_SAFETY_POLICY_VERSION;
      if (ingredient.dataSource !== 'FNRI' && !(v2 && ingredient.dataSource === 'USDA_FDC'))
        baseReasons.add('NON_FNRI_LIBRARY_INGREDIENT');
      if (typeof ingredient.foodItemId !== 'string' || ingredient.foodItemId.length === 0) {
        baseReasons.add('UNRESOLVED_LIBRARY_INGREDIENT');
      }
      if (
        v2 &&
        (!Number.isFinite(ingredient.quantity) || Number(ingredient.quantity) <= 0 || ingredient.unit !== 'g')
      ) {
        baseReasons.add('UNMEASURED_LIBRARY_INGREDIENT');
      }
    }
  }
  if (
    candidate.safetyPolicyVersion === MEAL_LIBRARY_SAFETY_POLICY_VERSION &&
    candidate.nutritionEvidenceSource !== 'FNRI_RECONCILED' &&
    candidate.nutritionEvidenceSource !== 'NUTRITIONIST_EDITED'
  ) {
    baseReasons.add('EVIDENCE_NOT_COMPLETE');
  }
  if (
    candidate.safetyPolicyVersion === MEAL_LIBRARY_SAFETY_POLICY_VERSION &&
    ingredients.some((ingredient) => ingredient.dataSource === 'USDA_FDC') &&
    candidate.nutritionEvidenceSource !== 'NUTRITIONIST_EDITED'
  ) {
    baseReasons.add('EVIDENCE_NOT_COMPLETE');
  }

  const suitableConditions = new Set<string>();
  const allergensPresent = new Set<string>();
  const allergenFree = new Set<string>();
  let conditionDeclarationsValid = true;
  let allergenDeclarationsValid = true;
  if (!Array.isArray(candidate.safetyDeclarations)) {
    coverageReasons.add('MALFORMED_DECLARATION');
    conditionDeclarationsValid = false;
    allergenDeclarationsValid = false;
  } else {
    for (const declaration of candidate.safetyDeclarations) {
      if (!isRecord(declaration) || typeof declaration.declarationType !== 'string') {
        coverageReasons.add('MALFORMED_DECLARATION');
        conditionDeclarationsValid = false;
        allergenDeclarationsValid = false;
        continue;
      }
      if (declaration.customKey !== null && declaration.customKey !== undefined) {
        coverageReasons.add('UNSUPPORTED_DECLARATION_KEY');
        if (declaration.declarationType === 'CONDITION_REVIEWED') conditionDeclarationsValid = false;
        else if (
          declaration.declarationType === 'ALLERGEN_PRESENT' ||
          declaration.declarationType === 'ALLERGEN_REVIEWED_ABSENT'
        )
          allergenDeclarationsValid = false;
        else {
          conditionDeclarationsValid = false;
          allergenDeclarationsValid = false;
        }
        continue;
      }
      const canonicalKey = normalizeRestrictionComparisonToken(declaration.canonicalKey);
      if (!canonicalKey) {
        coverageReasons.add('MALFORMED_DECLARATION');
        if (declaration.declarationType === 'CONDITION_REVIEWED') conditionDeclarationsValid = false;
        else if (
          declaration.declarationType === 'ALLERGEN_PRESENT' ||
          declaration.declarationType === 'ALLERGEN_REVIEWED_ABSENT'
        )
          allergenDeclarationsValid = false;
        else {
          conditionDeclarationsValid = false;
          allergenDeclarationsValid = false;
        }
        continue;
      }

      if (declaration.declarationType === 'CONDITION_REVIEWED') {
        if (
          !hasEligibleReviewProvenance ||
          (declaration.provenance !== undefined && declaration.provenance !== 'NUTRITIONIST_REVIEW')
        ) {
          coverageReasons.add('DECLARATION_PROVENANCE_INVALID');
          conditionDeclarationsValid = false;
        } else if (!CONDITION_KEYS.has(canonicalKey)) {
          coverageReasons.add('UNSUPPORTED_DECLARATION_KEY');
          conditionDeclarationsValid = false;
        } else {
          suitableConditions.add(canonicalKey);
        }
      } else if (declaration.declarationType === 'CONDITION_RULESET_CLEARED') {
        const snapshot = isRecord(declaration.evidenceSnapshot) ? declaration.evidenceSnapshot : null;
        if (
          canonicalKey !== 'HYPERTENSION' ||
          declaration.provenance !== 'APPROVED_RULESET' ||
          typeof declaration.policyVersion !== 'string' ||
          !snapshot ||
          snapshot.allRulesApproved !== true ||
          snapshot.decision !== 'PASS'
        ) {
          coverageReasons.add('RULESET_CLEARANCE_UNSUPPORTED');
          conditionDeclarationsValid = false;
        } else {
          suitableConditions.add(canonicalKey);
        }
      } else if (declaration.declarationType === 'ALLERGEN_PRESENT') {
        if (
          declaration.provenance !== undefined &&
          declaration.provenance !== 'NUTRITIONIST_REVIEW' &&
          declaration.provenance !== 'DETERMINISTIC_CLASSIFIER'
        ) {
          coverageReasons.add('DECLARATION_PROVENANCE_INVALID');
          allergenDeclarationsValid = false;
        } else if (!ALLERGY_KEYS.has(canonicalKey)) {
          coverageReasons.add('UNSUPPORTED_DECLARATION_KEY');
          allergenDeclarationsValid = false;
        } else {
          allergensPresent.add(canonicalKey);
        }
      } else if (declaration.declarationType === 'ALLERGEN_REVIEWED_ABSENT') {
        if (declaration.provenance !== undefined && declaration.provenance !== 'NUTRITIONIST_REVIEW') {
          coverageReasons.add('DECLARATION_PROVENANCE_INVALID');
          allergenDeclarationsValid = false;
        } else if (!ALLERGY_KEYS.has(canonicalKey)) {
          coverageReasons.add('UNSUPPORTED_DECLARATION_KEY');
          allergenDeclarationsValid = false;
        } else {
          allergenFree.add(canonicalKey);
        }
      } else {
        coverageReasons.add('MALFORMED_DECLARATION');
        conditionDeclarationsValid = false;
        allergenDeclarationsValid = false;
      }
    }
  }

  if (
    (candidate.conditionDeclarationState === 'REVIEWED_NONE_DECLARED' && suitableConditions.size > 0) ||
    (candidate.conditionDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && suitableConditions.size === 0)
  ) {
    coverageReasons.add('DECLARATION_STATE_MISMATCH');
    conditionDeclarationsValid = false;
  }
  const allergenDeclarationCount = allergensPresent.size + allergenFree.size;
  if (
    (candidate.allergenDeclarationState === 'REVIEWED_NONE_DECLARED' && allergenDeclarationCount > 0) ||
    (candidate.allergenDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && allergenDeclarationCount === 0)
  ) {
    coverageReasons.add('DECLARATION_STATE_MISMATCH');
    allergenDeclarationsValid = false;
  }
  for (const key of allergensPresent) {
    if (allergenFree.has(key)) {
      coverageReasons.add('DECLARATION_STATE_MISMATCH');
      allergenDeclarationsValid = false;
    }
  }

  const hasRuleBasedClearance =
    suitableConditions.size > 0 &&
    Array.isArray(candidate.safetyDeclarations) &&
    candidate.safetyDeclarations.some(
      (declaration) =>
        isRecord(declaration) &&
        declaration.declarationType === 'CONDITION_RULESET_CLEARED' &&
        declaration.provenance === 'APPROVED_RULESET'
    );
  const conditionDomainReviewed =
    hasReviewedState(candidate.conditionDeclarationState) &&
    conditionDeclarationsValid &&
    (hasEligibleReviewProvenance || hasRuleBasedClearance);
  const allergenDomainReviewed =
    hasReviewedState(candidate.allergenDeclarationState) && allergenDeclarationsValid && hasEligibleReviewProvenance;
  if (!conditionDomainReviewed) coverageReasons.add('CONDITION_DOMAIN_NOT_REVIEWED');
  if (!allergenDomainReviewed) coverageReasons.add('ALLERGEN_DOMAIN_NOT_REVIEWED');

  const complete = baseReasons.size === 0;
  const conditionCoverageValid = conditionDomainReviewed;
  const allergenCoverageValid = allergenDomainReviewed && crossContactCleared;
  return {
    complete,
    reasons: sortReasons(baseReasons),
    coverageReasons: sortReasons(coverageReasons),
    suitableConditions: [...suitableConditions].sort(),
    allergenFree: [...allergenFree].sort(),
    ingredients,
    adapterEvidence: {
      complete,
      baseComplete: complete,
      detectedAllergens: [...allergensPresent].sort(),
      reviewedAbsentAllergens: [...allergenFree].sort(),
      allergenDomainReviewed: allergenCoverageValid,
      crossContactCleared,
      conditionRuleMatches: [...suitableConditions].sort(),
      conditionDomainReviewed: conditionCoverageValid,
    },
  };
}
