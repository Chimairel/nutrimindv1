/**
 * Pure deterministic restriction evaluation policy.
 *
 * This module intentionally has no Prisma, HTTP, environment, time, AI, or
 * other runtime-service dependencies. It is not imported by production
 * callers in Batch 4B1.
 */

export const RESTRICTION_CONDITION_KEYS = Object.freeze([
  'DIABETES',
  'HYPERTENSION',
  'KIDNEY_DISEASE',
  'HEART_CONDITION',
  'PREGNANT',
  'NONE',
] as const);

export const RESTRICTION_ALLERGY_KEYS = Object.freeze([
  'SHELLFISH',
  'NUTS',
  'DAIRY',
  'GLUTEN',
  'EGGS',
  'NONE',
] as const);

export const APPROVED_RESTRICTION_ALIASES = Object.freeze({
  PEANUTS: 'NUTS',
  TREE_NUTS: 'NUTS',
  EGG: 'EGGS',
} as const);

export const RESTRICTION_REASON_CODE_ORDER = Object.freeze([
  'EXACT_ALLERGEN_CONFLICT',
  'NONE_WITH_POSITIVE_RESTRICTION',
  'CONTRADICTORY_RESTRICTIONS',
  'CONTRADICTORY_METADATA',
  'MALFORMED_RESTRICTION_INPUT',
  'UNKNOWN_RESTRICTION_KEY',
  'CUSTOM_RESTRICTION_UNMAPPED',
  'MISSING_SAFETY_METADATA',
  'NULL_COMPATIBILITY_METADATA',
  'MALFORMED_SAFETY_METADATA',
  'LEGACY_EMPTY_SAFETY_METADATA',
  'INCOMPLETE_SAFETY_METADATA',
  'MISSING_INGREDIENT_EVIDENCE',
  'UNKNOWN_METADATA_KEY',
  'AI_ESTIMATED_INGREDIENT',
  'UNRESOLVED_INGREDIENT',
  'UNREVIEWED_CONDITION_RULE',
  'KNOWN_CONDITION_REQUIRES_REVIEW',
  'KNOWN_ALLERGY_NO_CONFLICT',
  'NO_DETERMINISTIC_CONFLICT_COMPLETE_EVIDENCE',
  'MULTIPLE_RESULTS_MOST_RESTRICTIVE',
] as const);

export const SCOPED_SAFE_EXPLANATION =
  'No deterministic conflict was found within the complete evidence supplied to this evaluation. This does not establish medical, clinical, nutritionist, or universal safety.';

export type CanonicalConditionKey = typeof RESTRICTION_CONDITION_KEYS[number];
export type CanonicalAllergyKey = typeof RESTRICTION_ALLERGY_KEYS[number];
export type CanonicalRestrictionKey = CanonicalConditionKey | CanonicalAllergyKey;
export type RestrictionDecision = 'ALLOW' | 'REVIEW' | 'BLOCK';
export type RestrictionReviewState = 'SAFE' | 'CAUTION' | 'NEEDS_REVIEW';
export type RestrictionReasonCode = typeof RESTRICTION_REASON_CODE_ORDER[number];
export type RestrictionCategory =
  | 'ENUM_CONDITION'
  | 'CUSTOM_CONDITION'
  | 'ENUM_ALLERGY'
  | 'CUSTOM_ALLERGY';

export type RestrictionEvidenceSource =
  | 'SCHEMA_ENUM'
  | 'APPROVED_ALIAS'
  | 'CUSTOM_INPUT'
  | 'SAFETY_METADATA'
  | 'CONDITION_RULE_EVIDENCE'
  | 'AI_ESTIMATE'
  | 'UNRESOLVED';

export interface NormalizedRestriction {
  category: RestrictionCategory;
  suppliedValue: string;
  normalizedValue: string;
  canonicalKey: CanonicalRestrictionKey | null;
  aliasApplied: boolean;
  aliasInput: string | null;
  evidenceSource: RestrictionEvidenceSource;
}

export interface RestrictionMatch {
  category: RestrictionCategory;
  canonicalRestrictionKey: CanonicalRestrictionKey | null;
  suppliedRestriction: string;
  normalizedRestriction: string;
  restrictionAliasInput: string | null;
  evidenceSource: RestrictionEvidenceSource;
  suppliedEvidence: string | null;
  normalizedEvidence: string | null;
  evidenceAliasInput: string | null;
  reasonCode: RestrictionReasonCode;
}

export interface RestrictionEvaluationInput {
  restrictions?: {
    conditions?: unknown;
    allergies?: unknown;
    customConditions?: unknown;
    customAllergies?: unknown;
  } | null;
  evidence?: {
    safetyMetadata?: unknown;
    ingredients?: unknown;
  } | null;
}

export interface RestrictionEvaluation {
  decision: RestrictionDecision;
  reviewState: RestrictionReviewState;
  blockingConflict: boolean;
  matches: RestrictionMatch[];
  normalizedRestrictions: NormalizedRestriction[];
  reasonCodes: RestrictionReasonCode[];
  explanation: string;
  metadataComplete: boolean;
  unknownOrCustomRestriction: boolean;
  estimatedOrUnresolvedIngredient: boolean;
}

type Domain = 'condition' | 'allergy';

type ResolvedToken = {
  suppliedValue: string;
  normalizedValue: string;
  canonicalKey: CanonicalRestrictionKey | null;
  aliasApplied: boolean;
  aliasInput: string | null;
};

const CONDITION_KEY_SET = new Set<string>(RESTRICTION_CONDITION_KEYS);
const ALLERGY_KEY_SET = new Set<string>(RESTRICTION_ALLERGY_KEYS);
const REASON_ORDER = new Map<RestrictionReasonCode, number>(
  RESTRICTION_REASON_CODE_ORDER.map((code, index) => [code, index])
);

const REVIEW_REASON_CODES = new Set<RestrictionReasonCode>([
  'NONE_WITH_POSITIVE_RESTRICTION',
  'CONTRADICTORY_RESTRICTIONS',
  'CONTRADICTORY_METADATA',
  'MALFORMED_RESTRICTION_INPUT',
  'UNKNOWN_RESTRICTION_KEY',
  'CUSTOM_RESTRICTION_UNMAPPED',
  'MISSING_SAFETY_METADATA',
  'NULL_COMPATIBILITY_METADATA',
  'MALFORMED_SAFETY_METADATA',
  'LEGACY_EMPTY_SAFETY_METADATA',
  'INCOMPLETE_SAFETY_METADATA',
  'MISSING_INGREDIENT_EVIDENCE',
  'UNKNOWN_METADATA_KEY',
  'AI_ESTIMATED_INGREDIENT',
  'UNRESOLVED_INGREDIENT',
  'UNREVIEWED_CONDITION_RULE',
  'KNOWN_CONDITION_REQUIRES_REVIEW',
]);

const SAFETY_METADATA_KEYS = new Set([
  'complete',
  'detectedAllergens',
  'conditionRuleMatches',
  'contradictory',
]);

const INGREDIENT_EVIDENCE_KEYS = new Set([
  'dataSource',
  'resolved',
  'linked',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactSensitiveDisplayText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/giu, '[REDACTED_TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,}){1,2}\b/gu, '[REDACTED_TOKEN]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_EMAIL]')
    .replace(/\b(password|secret|token)\s*[:=]\s*\S+/giu, '$1=[REDACTED]');
}

export function sanitizeRestrictionDisplayValue(value: unknown): string {
  if (typeof value !== 'string') return '[INVALID_INPUT]';

  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  const redacted = redactSensitiveDisplayText(normalized);
  return (redacted || '[EMPTY_INPUT]').slice(0, 120);
}

export function normalizeRestrictionComparisonToken(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toUpperCase()
    .replace(/[\s_-]+/gu, '_');
}

function resolveToken(value: unknown, domain: Domain): ResolvedToken {
  const suppliedValue = sanitizeRestrictionDisplayValue(value);
  const normalizedValue = normalizeRestrictionComparisonToken(value);
  const keySet = domain === 'condition' ? CONDITION_KEY_SET : ALLERGY_KEY_SET;

  if (keySet.has(normalizedValue)) {
    return {
      suppliedValue,
      normalizedValue,
      canonicalKey: normalizedValue as CanonicalRestrictionKey,
      aliasApplied: false,
      aliasInput: null,
    };
  }

  if (domain === 'allergy' && normalizedValue in APPROVED_RESTRICTION_ALIASES) {
    return {
      suppliedValue,
      normalizedValue,
      canonicalKey: APPROVED_RESTRICTION_ALIASES[
        normalizedValue as keyof typeof APPROVED_RESTRICTION_ALIASES
      ],
      aliasApplied: true,
      aliasInput: normalizedValue,
    };
  }

  return {
    suppliedValue,
    normalizedValue,
    canonicalKey: null,
    aliasApplied: false,
    aliasInput: null,
  };
}
function normalizeRestrictionCollection(
  value: unknown,
  category: RestrictionCategory,
  domain: Domain,
  reasons: Set<RestrictionReasonCode>
): NormalizedRestriction[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    reasons.add('MALFORMED_RESTRICTION_INPUT');
    return [];
  }

  const isCustom = category === 'CUSTOM_CONDITION' || category === 'CUSTOM_ALLERGY';
  const seen = new Set<string>();
  const normalized: NormalizedRestriction[] = [];

  for (const entry of value) {
    const resolved = resolveToken(entry, domain);
    const dedupeKey = `${category}:${resolved.normalizedValue}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const item: NormalizedRestriction = {
      category,
      suppliedValue: resolved.suppliedValue,
      normalizedValue: resolved.normalizedValue,
      canonicalKey: resolved.canonicalKey,
      aliasApplied: resolved.aliasApplied,
      aliasInput: resolved.aliasInput,
      evidenceSource: resolved.aliasApplied
        ? 'APPROVED_ALIAS'
        : isCustom
          ? 'CUSTOM_INPUT'
          : 'SCHEMA_ENUM',
    };
    normalized.push(item);

    if (!resolved.canonicalKey) {
      reasons.add(isCustom ? 'CUSTOM_RESTRICTION_UNMAPPED' : 'UNKNOWN_RESTRICTION_KEY');
    }
  }

  return normalized;
}

function categoryRank(category: RestrictionCategory): number {
  switch (category) {
    case 'ENUM_CONDITION': return 0;
    case 'CUSTOM_CONDITION': return 1;
    case 'ENUM_ALLERGY': return 2;
    case 'CUSTOM_ALLERGY': return 3;
  }
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortNormalizedRestrictions(items: NormalizedRestriction[]): NormalizedRestriction[] {
  return [...items].sort((a, b) =>
    categoryRank(a.category) - categoryRank(b.category) ||
    compareCodePoints(a.normalizedValue, b.normalizedValue) ||
    compareCodePoints(a.suppliedValue, b.suppliedValue)
  );
}

function addNoneContradictionReasons(
  restrictions: readonly NormalizedRestriction[],
  domain: Domain,
  reasons: Set<RestrictionReasonCode>
): void {
  const domainRestrictions = restrictions.filter((restriction) =>
    domain === 'condition'
      ? restriction.category === 'ENUM_CONDITION' || restriction.category === 'CUSTOM_CONDITION'
      : restriction.category === 'ENUM_ALLERGY' || restriction.category === 'CUSTOM_ALLERGY'
  );
  const hasNone = domainRestrictions.some((restriction) => restriction.canonicalKey === 'NONE');
  const hasPositive = domainRestrictions.some((restriction) => restriction.canonicalKey !== 'NONE');

  if (hasNone && hasPositive) {
    reasons.add('NONE_WITH_POSITIVE_RESTRICTION');
    reasons.add('CONTRADICTORY_RESTRICTIONS');
  }
}

function createMatch(
  restriction: NormalizedRestriction,
  reasonCode: RestrictionReasonCode,
  evidenceSource: RestrictionEvidenceSource,
  evidence?: ResolvedToken
): RestrictionMatch {
  return {
    category: restriction.category,
    canonicalRestrictionKey: restriction.canonicalKey,
    suppliedRestriction: restriction.suppliedValue,
    normalizedRestriction: restriction.normalizedValue,
    restrictionAliasInput: restriction.aliasInput,
    evidenceSource,
    suppliedEvidence: evidence?.suppliedValue ?? null,
    normalizedEvidence: evidence?.normalizedValue ?? null,
    evidenceAliasInput: evidence?.aliasInput ?? null,
    reasonCode,
  };
}

function sortMatches(matches: RestrictionMatch[]): RestrictionMatch[] {
  return [...matches].sort((a, b) =>
    (REASON_ORDER.get(a.reasonCode) ?? Number.MAX_SAFE_INTEGER) -
      (REASON_ORDER.get(b.reasonCode) ?? Number.MAX_SAFE_INTEGER) ||
    categoryRank(a.category) - categoryRank(b.category) ||
    compareCodePoints(a.canonicalRestrictionKey ?? '', b.canonicalRestrictionKey ?? '') ||
    compareCodePoints(a.normalizedRestriction, b.normalizedRestriction)
  );
}

function sortReasonCodes(reasons: Set<RestrictionReasonCode>): RestrictionReasonCode[] {
  return [...reasons].sort((a, b) =>
    (REASON_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) -
    (REASON_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function evaluateRestrictions(
  input: RestrictionEvaluationInput
): RestrictionEvaluation {
  const reasons = new Set<RestrictionReasonCode>();
  const matches: RestrictionMatch[] = [];
  const restrictionInput = isRecord(input.restrictions) ? input.restrictions : {};

  if (input.restrictions !== undefined && input.restrictions !== null && !isRecord(input.restrictions)) {
    reasons.add('MALFORMED_RESTRICTION_INPUT');
  }

  const normalizedRestrictions = sortNormalizedRestrictions([
    ...normalizeRestrictionCollection(
      restrictionInput.conditions,
      'ENUM_CONDITION',
      'condition',
      reasons
    ),
    ...normalizeRestrictionCollection(
      restrictionInput.customConditions,
      'CUSTOM_CONDITION',
      'condition',
      reasons
    ),
    ...normalizeRestrictionCollection(
      restrictionInput.allergies,
      'ENUM_ALLERGY',
      'allergy',
      reasons
    ),
    ...normalizeRestrictionCollection(
      restrictionInput.customAllergies,
      'CUSTOM_ALLERGY',
      'allergy',
      reasons
    ),
  ]);

  addNoneContradictionReasons(normalizedRestrictions, 'condition', reasons);
  addNoneContradictionReasons(normalizedRestrictions, 'allergy', reasons);

  const positiveConditions = normalizedRestrictions.filter((restriction) =>
    (restriction.category === 'ENUM_CONDITION' || restriction.category === 'CUSTOM_CONDITION') &&
    restriction.canonicalKey !== null &&
    restriction.canonicalKey !== 'NONE'
  );
  const positiveAllergies = normalizedRestrictions.filter((restriction) =>
    (restriction.category === 'ENUM_ALLERGY' || restriction.category === 'CUSTOM_ALLERGY') &&
    restriction.canonicalKey !== null &&
    restriction.canonicalKey !== 'NONE'
  );

  if (positiveConditions.length > 0) {
    reasons.add('KNOWN_CONDITION_REQUIRES_REVIEW');
  }

  const evidence = isRecord(input.evidence) ? input.evidence : {};
  let metadataStructurallyComplete = false;
  let metadataContradictory = false;
  const detectedAllergens: ResolvedToken[] = [];
  const conditionRuleMatches: ResolvedToken[] = [];

  if (input.evidence !== undefined && input.evidence !== null && !isRecord(input.evidence)) {
    reasons.add('MALFORMED_SAFETY_METADATA');
  }

  const safetyMetadata = evidence.safetyMetadata;
  if (safetyMetadata === undefined) {
    reasons.add('MISSING_SAFETY_METADATA');
  } else if (safetyMetadata === null) {
    reasons.add('NULL_COMPATIBILITY_METADATA');
  } else if (!isRecord(safetyMetadata)) {
    reasons.add('MALFORMED_SAFETY_METADATA');
  } else {
    const unknownMetadataProperties = Object.keys(safetyMetadata)
      .some((key) => !SAFETY_METADATA_KEYS.has(key));
    if (unknownMetadataProperties) reasons.add('UNKNOWN_METADATA_KEY');

    metadataContradictory = safetyMetadata.contradictory === true;
    if (metadataContradictory) reasons.add('CONTRADICTORY_METADATA');

    const rawDetectedAllergens = safetyMetadata.detectedAllergens;
    if (!Array.isArray(rawDetectedAllergens)) {
      reasons.add('MALFORMED_SAFETY_METADATA');
    } else {
      const seen = new Set<string>();
      for (const value of rawDetectedAllergens) {
        const resolved = resolveToken(value, 'allergy');
        if (!resolved.canonicalKey || resolved.canonicalKey === 'NONE') {
          reasons.add('UNKNOWN_METADATA_KEY');
          continue;
        }
        if (!seen.has(resolved.normalizedValue)) {
          seen.add(resolved.normalizedValue);
          detectedAllergens.push(resolved);
        }
      }
    }

    const rawConditionMatches = safetyMetadata.conditionRuleMatches;
    if (rawConditionMatches !== undefined && !Array.isArray(rawConditionMatches)) {
      reasons.add('MALFORMED_SAFETY_METADATA');
    } else if (Array.isArray(rawConditionMatches)) {
      const seen = new Set<string>();
      for (const value of rawConditionMatches) {
        const resolved = resolveToken(value, 'condition');
        if (!resolved.canonicalKey || resolved.canonicalKey === 'NONE') {
          reasons.add('UNKNOWN_METADATA_KEY');
          continue;
        }
        if (!seen.has(resolved.normalizedValue)) {
          seen.add(resolved.normalizedValue);
          conditionRuleMatches.push(resolved);
        }
      }
    }

    if (safetyMetadata.complete !== true) {
      if (Array.isArray(rawDetectedAllergens) && rawDetectedAllergens.length === 0) {
        reasons.add('LEGACY_EMPTY_SAFETY_METADATA');
      } else {
        reasons.add('INCOMPLETE_SAFETY_METADATA');
      }
    }

    metadataStructurallyComplete =
      safetyMetadata.complete === true &&
      Array.isArray(rawDetectedAllergens) &&
      !metadataContradictory &&
      !unknownMetadataProperties &&
      !reasons.has('MALFORMED_SAFETY_METADATA') &&
      !reasons.has('UNKNOWN_METADATA_KEY');
  }

  let ingredientsComplete = true;
  let estimatedOrUnresolvedIngredient = false;
  const rawIngredients = evidence.ingredients;

  if (!Array.isArray(rawIngredients) || rawIngredients.length === 0) {
    reasons.add('MISSING_INGREDIENT_EVIDENCE');
    ingredientsComplete = false;
  } else {
    for (const ingredient of rawIngredients) {
      if (!isRecord(ingredient)) {
        reasons.add('MALFORMED_SAFETY_METADATA');
        ingredientsComplete = false;
        continue;
      }

      if (Object.keys(ingredient).some((key) => !INGREDIENT_EVIDENCE_KEYS.has(key))) {
        reasons.add('UNKNOWN_METADATA_KEY');
        ingredientsComplete = false;
      }

      if (ingredient.dataSource === 'GEMINI_ESTIMATED') {
        reasons.add('AI_ESTIMATED_INGREDIENT');
        estimatedOrUnresolvedIngredient = true;
        ingredientsComplete = false;
      } else if (ingredient.dataSource !== 'FNRI') {
        reasons.add('UNKNOWN_METADATA_KEY');
        ingredientsComplete = false;
      }

      if (ingredient.resolved !== true || ingredient.linked !== true) {
        reasons.add('UNRESOLVED_INGREDIENT');
        estimatedOrUnresolvedIngredient = true;
        ingredientsComplete = false;
      }
    }
  }

  const metadataComplete = metadataStructurallyComplete && ingredientsComplete;

  for (const condition of positiveConditions) {
    const evidenceMatch = conditionRuleMatches.find(
      (candidate) => candidate.canonicalKey === condition.canonicalKey
    );
    if (evidenceMatch) {
      reasons.add('UNREVIEWED_CONDITION_RULE');
      matches.push(createMatch(
        condition,
        'UNREVIEWED_CONDITION_RULE',
        'CONDITION_RULE_EVIDENCE',
        evidenceMatch
      ));
    }
  }

  let blockingConflict = false;
  for (const allergy of positiveAllergies) {
    const evidenceMatch = detectedAllergens.find(
      (candidate) => candidate.canonicalKey === allergy.canonicalKey
    );
    if (evidenceMatch) {
      blockingConflict = true;
      reasons.add('EXACT_ALLERGEN_CONFLICT');
      matches.push(createMatch(
        allergy,
        'EXACT_ALLERGEN_CONFLICT',
        'SAFETY_METADATA',
        evidenceMatch
      ));
    }
  }

  const hasUnmappedCustom = normalizedRestrictions.some((restriction) =>
    (restriction.category === 'CUSTOM_CONDITION' || restriction.category === 'CUSTOM_ALLERGY') &&
    restriction.canonicalKey === null
  );
  const hasUnknownEnum = normalizedRestrictions.some((restriction) =>
    (restriction.category === 'ENUM_CONDITION' || restriction.category === 'ENUM_ALLERGY') &&
    restriction.canonicalKey === null
  );

  if (
    positiveAllergies.length > 0 &&
    !blockingConflict &&
    metadataComplete &&
    !hasUnmappedCustom &&
    !hasUnknownEnum
  ) {
    reasons.add('KNOWN_ALLERGY_NO_CONFLICT');
  }

  const positiveRestrictionCount = positiveConditions.length + positiveAllergies.length +
    normalizedRestrictions.filter((restriction) => restriction.canonicalKey === null).length;
  if (positiveRestrictionCount > 1 || matches.length > 1) {
    reasons.add('MULTIPLE_RESULTS_MOST_RESTRICTIVE');
  }

  const needsReview = [...reasons].some((reason) => REVIEW_REASON_CODES.has(reason));
  let decision: RestrictionDecision;
  let reviewState: RestrictionReviewState;

  if (blockingConflict) {
    decision = 'BLOCK';
    reviewState = 'NEEDS_REVIEW';
  } else if (needsReview || !metadataComplete) {
    decision = 'REVIEW';
    reviewState = 'NEEDS_REVIEW';
  } else {
    decision = 'ALLOW';
    reviewState = positiveAllergies.length > 0 ? 'CAUTION' : 'SAFE';
    reasons.add(
      positiveAllergies.length > 0
        ? 'KNOWN_ALLERGY_NO_CONFLICT'
        : 'NO_DETERMINISTIC_CONFLICT_COMPLETE_EVIDENCE'
    );
  }

  const explanation = decision === 'BLOCK'
    ? 'An exact approved allergy conflict was found in the supplied evidence. The evaluated use is blocked until the restriction, ingredient evidence, or metadata is corrected and re-evaluated.'
    : decision === 'REVIEW'
      ? 'The supplied evidence is incomplete, unknown, custom, estimated, unresolved, contradictory, or requires professional review. No deterministic safety conclusion was made.'
      : reviewState === 'SAFE'
        ? SCOPED_SAFE_EXPLANATION
        : 'No exact deterministic allergy conflict was found within the complete evidence supplied. This limited result does not establish medical, clinical, nutritionist, or universal safety.';

  return {
    decision,
    reviewState,
    blockingConflict,
    matches: sortMatches(matches),
    normalizedRestrictions,
    reasonCodes: sortReasonCodes(reasons),
    explanation,
    metadataComplete,
    unknownOrCustomRestriction:
      hasUnknownEnum || normalizedRestrictions.some((restriction) =>
        restriction.category === 'CUSTOM_CONDITION' || restriction.category === 'CUSTOM_ALLERGY'
      ),
    estimatedOrUnresolvedIngredient,
  };
}
