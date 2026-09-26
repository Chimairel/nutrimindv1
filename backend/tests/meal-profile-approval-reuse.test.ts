import assert from 'node:assert/strict';
import test from 'node:test';
import { mealApprovalSafetyScope } from '../src/domain/meal-approval-scope.policy';
import {
  isProfileApprovedLibraryMealCompatible,
  type CertifiedLibraryMeal,
} from '../src/services/meal-library-candidate-query.service';

const dairyEntry = {
  domain: 'ALLERGY', canonicalCode: 'DAIRY', originalText: 'milk', supportState: 'SUPPORTED',
};
const profile = {
  dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null,
  safetyEntries: [dairyEntry],
};
const scope = mealApprovalSafetyScope({ conditions: [], allergens: ['DAIRY'], safetyEntries: [dairyEntry] });

function meal(override: Record<string, unknown> = {}): CertifiedLibraryMeal {
  return {
    status: 'APPROVED',
    recipeSignature: 'a'.repeat(64),
    safetyEvidenceRevision: 1,
    ingredients: [{ ingredientName: 'rice', category: 'GRAINS', foodItem: null }],
    profileApprovals: [{
      safetyScopeKey: scope.key,
      recipeSignature: 'a'.repeat(64),
      evidenceRevision: 1,
      reviewPolicyVersion: 'NUTRIMIND_PLAN_SAFETY_V2',
      reviewerNutritionist: {
        isVerified: true, prcLicenseExpiry: new Date('2099-01-01'),
        user: { role: 'NUTRITIONIST', isSuspended: false },
      },
    }],
    ...override,
  } as unknown as CertifiedLibraryMeal;
}

test('profile approval reuses the exact recipe for the same safety scope despite goal differences', () => {
  assert.equal(isProfileApprovedLibraryMealCompatible(meal(), [], ['DAIRY'], { ...profile, goal: 'MAINTAIN' }), true);
  assert.equal(isProfileApprovedLibraryMealCompatible(meal(), [], ['DAIRY'], { ...profile, goal: 'BUILD_MUSCLE' }), true);
  assert.equal(isProfileApprovedLibraryMealCompatible(meal(), [], ['SOY'], {
    ...profile, safetyEntries: [{ ...dairyEntry, canonicalCode: 'SOY' }],
  }), false);
  assert.equal(isProfileApprovedLibraryMealCompatible(meal(), ['DIABETES'], ['DAIRY'], profile), false);
});

test('profile approval fails closed when the recipe changes, reviewer expires, or allergen conflicts', () => {
  assert.equal(isProfileApprovedLibraryMealCompatible(meal({ safetyEvidenceRevision: 2 }), [], ['DAIRY'], profile), false);
  assert.equal(isProfileApprovedLibraryMealCompatible(meal({ ingredients: [{ ingredientName: 'milk', category: 'DAIRY', foodItem: null }] }), [], ['DAIRY'], profile), false);
  const expired = meal();
  expired.profileApprovals[0].reviewerNutritionist.prcLicenseExpiry = new Date('2020-01-01');
  assert.equal(isProfileApprovedLibraryMealCompatible(expired, [], ['DAIRY'], profile), false);
});
