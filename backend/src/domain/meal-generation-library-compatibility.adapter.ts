import {
  APPROVED_RESTRICTION_ALIASES,
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
  evaluateRestrictions,
  normalizeRestrictionComparisonToken,
  type RestrictionEvaluation,
  type RestrictionEvaluationInput,
} from './restriction-evaluation.policy';

export interface MealGenerationUserRestrictions {
  conditions?: unknown;
  allergies?: unknown;
  customConditions?: unknown;
  customAllergies?: unknown;
}

export interface MealGenerationLibraryIngredientEvidence {
  dataSource?: unknown;
  foodItemId?: unknown;
}

export interface MealGenerationLibraryCandidateEvidence {
  status?: unknown;
  suitableConditions?: unknown;
  allergenFree?: unknown;
  /**
   * Explicit structured completeness/allergen evidence mapped from the
   * first-class MealLibrary safety models. Legacy and uncertified rows do not
   * supply complete evidence and conservatively evaluate to REVIEW.
   */
  safetyEvidence?: unknown;
  ingredients?: unknown;
}

export interface MealGenerationLibraryCompatibilityInput {
  userRestrictions?: MealGenerationUserRestrictions | null;
  candidate?: MealGenerationLibraryCandidateEvidence | null;
}

export interface MealGenerationLibraryCompatibilityResult {
  eligible: boolean;
  evaluation: RestrictionEvaluation;
  reasonCodes: RestrictionEvaluation['reasonCodes'];
  explanation: string;
  metadataComplete: boolean;
}

type UnknownRecord = Record<string, unknown>;

const CONDITION_KEYS = new Set<string>(RESTRICTION_CONDITION_KEYS);
const ALLERGY_KEYS = new Set<string>(RESTRICTION_ALLERGY_KEYS);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function splitStoredCustomRestrictions(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return [...value];
  if (typeof value !== 'string') return value;

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function canonicalAllergyKey(value: unknown): string | null {
  const normalized = normalizeRestrictionComparisonToken(value);
  if (ALLERGY_KEYS.has(normalized)) return normalized;
  if (normalized in APPROVED_RESTRICTION_ALIASES) {
    return APPROVED_RESTRICTION_ALIASES[
      normalized as keyof typeof APPROVED_RESTRICTION_ALIASES
    ];
  }
  return null;
}

function hasUnknownCompatibilityValue(values: unknown[], domain: 'condition' | 'allergy'): boolean {
  return values.some((value) => {
    const normalized = normalizeRestrictionComparisonToken(value);
    if (domain === 'condition') return !CONDITION_KEYS.has(normalized);
    return canonicalAllergyKey(value) === null;
  });
}

function positiveCanonicalUserAllergies(restrictions: UnknownRecord): string[] {
  const collections = [restrictions.allergies, splitStoredCustomRestrictions(restrictions.customAllergies)];
  const keys = new Set<string>();

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const value of collection) {
      const key = canonicalAllergyKey(value);
      if (key && key !== 'NONE') keys.add(key);
    }
  }

  return [...keys].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

function adaptSafetyMetadata(
  candidate: UnknownRecord,
  restrictions: UnknownRecord
): unknown {
  if (!hasOwn(candidate, 'suitableConditions') || !hasOwn(candidate, 'allergenFree')) {
    return undefined;
  }

  if (candidate.suitableConditions === null || candidate.allergenFree === null) {
    return null;
  }

  if (!Array.isArray(candidate.suitableConditions) || !Array.isArray(candidate.allergenFree)) {
    return '[MALFORMED_LIBRARY_COMPATIBILITY]';
  }

  const suitableConditions = [...candidate.suitableConditions];
  const allergenFree = [...candidate.allergenFree];

  if (!hasOwn(candidate, 'safetyEvidence')) {
    return {
      detectedAllergens: [],
      conditionRuleMatches: suitableConditions,
    };
  }

  if (!isRecord(candidate.safetyEvidence)) return candidate.safetyEvidence;

  const suppliedEvidence = candidate.safetyEvidence;
  const declaredFreeKeys = new Set(
    allergenFree
      .map(canonicalAllergyKey)
      .filter((key): key is string => key !== null && key !== 'NONE')
  );
  const declaredAllergiesCovered = positiveCanonicalUserAllergies(restrictions)
    .every((key) => declaredFreeKeys.has(key));
  const unknownCompatibilityKey =
    hasUnknownCompatibilityValue(suitableConditions, 'condition') ||
    hasUnknownCompatibilityValue(allergenFree, 'allergy');

  return {
    ...suppliedEvidence,
    complete: suppliedEvidence.complete === true && declaredAllergiesCovered,
    conditionRuleMatches: suitableConditions,
    ...(unknownCompatibilityKey ? { unknownCompatibilityKey: true } : {}),
  };
}

function adaptIngredientEvidence(candidate: UnknownRecord): unknown {
  if (!hasOwn(candidate, 'ingredients')) return undefined;
  if (!Array.isArray(candidate.ingredients)) return candidate.ingredients;

  return candidate.ingredients.map((ingredient) => {
    if (!isRecord(ingredient)) return ingredient;
    const linked = typeof ingredient.foodItemId === 'string' && ingredient.foodItemId.length > 0;
    return {
      dataSource: ingredient.dataSource,
      resolved: linked,
      linked,
    };
  });
}

function malformedEvaluation(): RestrictionEvaluation {
  return evaluateRestrictions({
    restrictions: 'MALFORMED' as unknown as RestrictionEvaluationInput['restrictions'],
    evidence: 'MALFORMED' as unknown as RestrictionEvaluationInput['evidence'],
  });
}

export function evaluateMealGenerationLibraryCompatibility(
  input: MealGenerationLibraryCompatibilityInput
): MealGenerationLibraryCompatibilityResult {
  if (!isRecord(input) || !isRecord(input.candidate)) {
    const evaluation = malformedEvaluation();
    return {
      eligible: false,
      evaluation,
      reasonCodes: evaluation.reasonCodes,
      explanation: evaluation.explanation,
      metadataComplete: evaluation.metadataComplete,
    };
  }

  const restrictions = isRecord(input.userRestrictions) ? input.userRestrictions : {};
  const candidate = input.candidate;
  const evaluation = evaluateRestrictions({
    restrictions: {
      conditions: restrictions.conditions,
      allergies: restrictions.allergies,
      customConditions: splitStoredCustomRestrictions(restrictions.customConditions),
      customAllergies: splitStoredCustomRestrictions(restrictions.customAllergies),
    },
    evidence: {
      safetyMetadata: adaptSafetyMetadata(candidate, restrictions),
      ingredients: adaptIngredientEvidence(candidate),
    },
  });
  const hasUnresolvedRestriction = evaluation.normalizedRestrictions.some(
    (restriction) => restriction.canonicalKey === null
  );

  const eligible =
    candidate.status === 'APPROVED' &&
    evaluation.decision === 'ALLOW' &&
    evaluation.metadataComplete &&
    !evaluation.blockingConflict &&
    !hasUnresolvedRestriction &&
    !evaluation.estimatedOrUnresolvedIngredient;

  return {
    eligible,
    evaluation,
    reasonCodes: evaluation.reasonCodes,
    explanation: evaluation.explanation,
    metadataComplete: evaluation.metadataComplete,
  };
}

export function filterEligibleMealGenerationLibraryCandidates<T>(
  candidates: readonly T[],
  userRestrictions: MealGenerationUserRestrictions,
  toEvidence: (candidate: T) => MealGenerationLibraryCandidateEvidence
): T[] {
  return candidates.filter((candidate) =>
    evaluateMealGenerationLibraryCompatibility({
      userRestrictions,
      candidate: toEvidence(candidate),
    }).eligible
  );
}

export async function runMealGenerationFallbackForUnmatchedSlots<TSlot, TMeal>(
  unmatchedSlots: readonly TSlot[],
  fallback: (slots: readonly TSlot[]) => Promise<readonly TMeal[]>
): Promise<TMeal[]> {
  if (unmatchedSlots.length === 0) return [];
  return [...await fallback(unmatchedSlots)];
}
