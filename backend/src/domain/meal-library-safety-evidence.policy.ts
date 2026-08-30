import {
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
  normalizeRestrictionComparisonToken,
} from './restriction-evaluation.policy';

export const MEAL_LIBRARY_SAFETY_POLICY_VERSION = 'NUTRIMIND_LIBRARY_SAFETY_V1';

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
  'MALFORMED_DECLARATION',
  'UNSUPPORTED_DECLARATION_KEY',
  'DECLARATION_STATE_MISMATCH',
] as const);

export type MealLibrarySafetyReason = typeof MEAL_LIBRARY_SAFETY_REASON_ORDER[number];

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
  safetyDeclarations?: unknown;
}

export interface MealLibrarySafetyEvaluation {
  complete: boolean;
  reasons: MealLibrarySafetyReason[];
  suitableConditions: string[];
  allergenFree: string[];
  ingredients: { dataSource: unknown; foodItemId: unknown }[];
  adapterEvidence: {
    complete: boolean;
    detectedAllergens: string[];
  };
}

type UnknownRecord = Record<string, unknown>;

const CONDITION_KEYS = new Set<string>(
  RESTRICTION_CONDITION_KEYS.filter((key) => key !== 'NONE')
);
const ALLERGY_KEYS = new Set<string>(
  RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE')
);
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

export function evaluateMealLibrarySafetyEvidence(
  candidate: MealLibrarySafetyCandidate
): MealLibrarySafetyEvaluation {
  const reasons = new Set<MealLibrarySafetyReason>();

  if (!isRecord(candidate)) {
    reasons.add('EVIDENCE_NOT_COMPLETE');
    return {
      complete: false,
      reasons: sortReasons(reasons),
      suitableConditions: [],
      allergenFree: [],
      ingredients: [],
      adapterEvidence: { complete: false, detectedAllergens: [] },
    };
  }

  if (candidate.status !== 'APPROVED') reasons.add('LIBRARY_NOT_APPROVED');
  if (candidate.safetyEvidenceStatus !== 'COMPLETE') reasons.add('EVIDENCE_NOT_COMPLETE');
  if (candidate.safetyEvidenceOrigin !== 'NUTRITIONIST_REVIEW') {
    reasons.add('EVIDENCE_ORIGIN_NOT_REVIEWED');
  }

  const revision = candidate.safetyEvidenceRevision;
  if (
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision <= 0 ||
    candidate.certifiedEvidenceRevision !== revision
  ) {
    reasons.add('REVISION_NOT_CERTIFIED');
  }
  if (candidate.safetyPolicyVersion !== MEAL_LIBRARY_SAFETY_POLICY_VERSION) {
    reasons.add('POLICY_VERSION_UNSUPPORTED');
  }
  if (candidate.safetyInvalidatedAt !== null && candidate.safetyInvalidatedAt !== undefined) {
    reasons.add('EVIDENCE_INVALIDATED');
  }
  if (candidate.reviewerEligible !== true) reasons.add('REVIEWER_NOT_ELIGIBLE');
  if (!hasReviewedState(candidate.conditionDeclarationState)) {
    reasons.add('CONDITION_DOMAIN_NOT_REVIEWED');
  }
  if (!hasReviewedState(candidate.allergenDeclarationState)) {
    reasons.add('ALLERGEN_DOMAIN_NOT_REVIEWED');
  }
  if (candidate.crossContactAssessment !== 'ASSESSED_NO_KNOWN_RISK') {
    reasons.add('CROSS_CONTACT_NOT_CLEARED');
  }

  const ingredients: { dataSource: unknown; foodItemId: unknown }[] = [];
  if (!Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0) {
    reasons.add('MISSING_LIBRARY_INGREDIENTS');
  } else {
    for (const ingredient of candidate.ingredients) {
      if (!isRecord(ingredient)) {
        reasons.add('UNRESOLVED_LIBRARY_INGREDIENT');
        continue;
      }
      ingredients.push({
        dataSource: ingredient.dataSource,
        foodItemId: ingredient.foodItemId,
      });
      if (ingredient.dataSource !== 'FNRI') reasons.add('NON_FNRI_LIBRARY_INGREDIENT');
      if (typeof ingredient.foodItemId !== 'string' || ingredient.foodItemId.length === 0) {
        reasons.add('UNRESOLVED_LIBRARY_INGREDIENT');
      }
    }
  }

  const suitableConditions = new Set<string>();
  const allergensPresent = new Set<string>();
  const allergenFree = new Set<string>();
  if (!Array.isArray(candidate.safetyDeclarations)) {
    reasons.add('MALFORMED_DECLARATION');
  } else {
    for (const declaration of candidate.safetyDeclarations) {
      if (!isRecord(declaration) || typeof declaration.declarationType !== 'string') {
        reasons.add('MALFORMED_DECLARATION');
        continue;
      }
      if (declaration.customKey !== null && declaration.customKey !== undefined) {
        reasons.add('UNSUPPORTED_DECLARATION_KEY');
        continue;
      }
      const canonicalKey = normalizeRestrictionComparisonToken(declaration.canonicalKey);
      if (!canonicalKey) {
        reasons.add('MALFORMED_DECLARATION');
        continue;
      }

      if (declaration.declarationType === 'CONDITION_REVIEWED') {
        if (!CONDITION_KEYS.has(canonicalKey)) {
          reasons.add('UNSUPPORTED_DECLARATION_KEY');
        } else {
          suitableConditions.add(canonicalKey);
        }
      } else if (declaration.declarationType === 'ALLERGEN_PRESENT') {
        if (!ALLERGY_KEYS.has(canonicalKey)) {
          reasons.add('UNSUPPORTED_DECLARATION_KEY');
        } else {
          allergensPresent.add(canonicalKey);
        }
      } else if (declaration.declarationType === 'ALLERGEN_REVIEWED_ABSENT') {
        if (!ALLERGY_KEYS.has(canonicalKey)) {
          reasons.add('UNSUPPORTED_DECLARATION_KEY');
        } else {
          allergenFree.add(canonicalKey);
        }
      } else {
        reasons.add('MALFORMED_DECLARATION');
      }
    }
  }

  if (
    (candidate.conditionDeclarationState === 'REVIEWED_NONE_DECLARED' && suitableConditions.size > 0) ||
    (candidate.conditionDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && suitableConditions.size === 0)
  ) {
    reasons.add('DECLARATION_STATE_MISMATCH');
  }
  const allergenDeclarationCount = allergensPresent.size + allergenFree.size;
  if (
    (candidate.allergenDeclarationState === 'REVIEWED_NONE_DECLARED' && allergenDeclarationCount > 0) ||
    (candidate.allergenDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && allergenDeclarationCount === 0)
  ) {
    reasons.add('DECLARATION_STATE_MISMATCH');
  }
  for (const key of allergensPresent) {
    if (allergenFree.has(key)) reasons.add('DECLARATION_STATE_MISMATCH');
  }

  const complete = reasons.size === 0;
  return {
    complete,
    reasons: sortReasons(reasons),
    suitableConditions: [...suitableConditions].sort(),
    allergenFree: [...allergenFree].sort(),
    ingredients,
    adapterEvidence: {
      complete,
      detectedAllergens: [...allergensPresent].sort(),
    },
  };
}
