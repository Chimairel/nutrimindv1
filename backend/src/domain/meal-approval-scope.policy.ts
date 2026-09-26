import { createHash } from 'node:crypto';
import {
  adaptUserSafetyRestrictions,
  type StructuredSafetyRestrictionEntry,
} from './structured-restriction.adapter';

export interface MealApprovalSafetyProfile {
  conditions: readonly string[];
  allergens: readonly string[];
  otherConditions?: string | null;
  otherAllergies?: string | null;
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[] | null;
}

function normalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.normalize('NFKC').trim().toUpperCase()).filter((value) => value && value !== 'NONE'))].sort();
}

/** The exact recorded safety context; goals and calorie targets are deliberately absent. */
export function mealApprovalSafetyScope(profile: MealApprovalSafetyProfile): {
  key: string;
  supported: boolean;
} {
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: profile.conditions,
    allergies: profile.allergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  const entries = profile.safetyEntries?.length
    ? profile.safetyEntries.map((entry) => ({
        domain: String(entry.domain ?? ''),
        code: String(entry.canonicalCode ?? ''),
        text: String(entry.originalText ?? '').normalize('NFKC').trim().toUpperCase(),
        state: String(entry.supportState ?? ''),
      })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : [];
  const canonical = JSON.stringify({
    version: 'MEAL_APPROVAL_SAFETY_SCOPE_V1',
    source: restrictions.source,
    recordedConditions: normalized(profile.conditions),
    recordedAllergens: normalized(profile.allergens),
    conditions: normalized(restrictions.conditions),
    allergens: normalized(restrictions.allergies),
    customConditions: normalized(restrictions.customConditions),
    customFoodRestrictions: normalized(restrictions.customFoodRestrictions),
    entries,
  });
  return {
    key: createHash('sha256').update(canonical).digest('hex'),
    supported: !restrictions.requiresReview,
  };
}
