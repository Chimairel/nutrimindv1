import {
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
  type RestrictionEvaluationInput,
} from './restriction-evaluation.policy';
import {
  SAFETY_ENTRY_DOMAINS,
  SAFETY_SUPPORT_STATES,
  type SafetyEntryDomain,
  type SafetySupportState,
} from './safety-intake.policy';

export type StructuredSafetyDomain = SafetyEntryDomain;
export type StructuredSafetySupportState = SafetySupportState;

export interface StructuredSafetyRestrictionEntry {
  domain?: unknown;
  canonicalCode?: unknown;
  displayName?: unknown;
  originalText?: unknown;
  supportState?: unknown;
}

export interface UserSafetyRestrictionSource {
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[] | null;
  healthConditions?: unknown;
  allergies?: unknown;
  otherConditions?: unknown;
  otherAllergies?: unknown;
}

export interface CanonicalUserSafetyRestrictions {
  source: 'STRUCTURED' | 'LEGACY';
  evaluationRestrictions: NonNullable<RestrictionEvaluationInput['restrictions']>;
  conditions: string[];
  allergies: string[];
  customConditions: string[];
  customFoodRestrictions: string[];
  displayEntries: Array<{
    domain: StructuredSafetyDomain | 'UNKNOWN';
    label: string;
    supportState: StructuredSafetySupportState | 'UNKNOWN';
  }>;
  requiresReview: boolean;
}

const CONDITION_KEYS = new Set<string>(RESTRICTION_CONDITION_KEYS);
const ALLERGY_KEYS = new Set<string>(RESTRICTION_ALLERGY_KEYS);
const SUPPORT_STATES = new Set<string>(SAFETY_SUPPORT_STATES);
const DOMAINS = new Set<string>(SAFETY_ENTRY_DOMAINS);

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function splitLegacy(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function cleaned(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function addUnique(target: string[], seen: Set<string>, value: string): void {
  const key = value.normalize('NFKC').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!key || key === 'NONE' || seen.has(key)) return;
  seen.add(key);
  target.push(value);
}

/**
 * Canonical boundary between persisted structured intake and deterministic
 * restriction evaluation. Structured rows are authoritative when present;
 * legacy enum/custom fields are retained only as an explicit fallback for
 * profiles that have not yet acquired structured rows.
 */
export function adaptUserSafetyRestrictions(
  source: UserSafetyRestrictionSource
): CanonicalUserSafetyRestrictions {
  const structured = Array.isArray(source.safetyEntries) && source.safetyEntries.length > 0;
  const conditions: string[] = [];
  const allergies: string[] = [];
  const customConditions: string[] = [];
  const customFoodRestrictions: string[] = [];
  const displayEntries: CanonicalUserSafetyRestrictions['displayEntries'] = [];
  const seenConditions = new Set<string>();
  const seenAllergies = new Set<string>();
  const seenCustomConditions = new Set<string>();
  const seenCustomFood = new Set<string>();
  let requiresReview = false;

  if (structured) {
    for (const entry of source.safetyEntries!) {
      const domain = typeof entry.domain === 'string' && DOMAINS.has(entry.domain as StructuredSafetyDomain)
        ? entry.domain as StructuredSafetyDomain
        : 'UNKNOWN';
      const supportState = typeof entry.supportState === 'string' && SUPPORT_STATES.has(entry.supportState)
        ? entry.supportState as StructuredSafetySupportState
        : 'UNKNOWN';
      const canonicalCode = cleaned(entry.canonicalCode, '');
      const label = cleaned(entry.displayName, cleaned(entry.originalText, '[INVALID_RESTRICTION]'));
      if (canonicalCode === 'NONE' || label.toUpperCase() === 'NONE') continue;

      displayEntries.push({ domain, label, supportState });
      const supported = domain !== 'UNKNOWN' && supportState === 'SUPPORTED';

      if (domain === 'CONDITION' && CONDITION_KEYS.has(canonicalCode)) {
        addUnique(conditions, seenConditions, canonicalCode);
        if (!supported) {
          addUnique(customConditions, seenCustomConditions, canonicalCode);
          requiresReview = true;
        }
      } else if (
        domain !== 'CONDITION' && domain !== 'UNKNOWN' && ALLERGY_KEYS.has(canonicalCode)
      ) {
        // A supported avoided ingredient uses the same exact declaration
        // evidence as an allergy, without claiming the user has an allergy.
        addUnique(allergies, seenAllergies, canonicalCode);
        if (!supported) {
          addUnique(customFoodRestrictions, seenCustomFood, canonicalCode);
          requiresReview = true;
        }
      } else if (domain === 'CONDITION') {
        addUnique(customConditions, seenCustomConditions, canonicalCode || label);
        requiresReview = true;
      } else {
        addUnique(customFoodRestrictions, seenCustomFood, canonicalCode || label);
        requiresReview = true;
      }
    }
  } else {
    for (const value of asStrings(source.healthConditions)) addUnique(conditions, seenConditions, value);
    for (const value of asStrings(source.allergies)) addUnique(allergies, seenAllergies, value);
    for (const value of splitLegacy(source.otherConditions)) {
      addUnique(customConditions, seenCustomConditions, value);
      requiresReview = true;
    }
    for (const value of splitLegacy(source.otherAllergies)) {
      addUnique(customFoodRestrictions, seenCustomFood, value);
      requiresReview = true;
    }
    displayEntries.push(
      ...conditions.map((label) => ({ domain: 'CONDITION' as const, label, supportState: 'SUPPORTED' as const })),
      ...allergies.map((label) => ({ domain: 'ALLERGY' as const, label, supportState: 'SUPPORTED' as const })),
      ...customConditions.map((label) => ({ domain: 'CONDITION' as const, label, supportState: 'PENDING_REVIEW' as const })),
      ...customFoodRestrictions.map((label) => ({ domain: 'ALLERGY' as const, label, supportState: 'PENDING_REVIEW' as const })),
    );
  }

  return {
    source: structured ? 'STRUCTURED' : 'LEGACY',
    evaluationRestrictions: {
      conditions,
      allergies,
      customConditions,
      customAllergies: customFoodRestrictions,
    },
    conditions,
    allergies,
    customConditions,
    customFoodRestrictions,
    displayEntries,
    requiresReview,
  };
}
