import assert from 'node:assert/strict';
import test from 'node:test';
import { assertShareableText, observedContentSignature } from '../src/domain/observed-meal.policy';
import { observedMealAdmissionSchema, observedMealConsentSchema } from '../src/validation/user-action.schemas';

const base = {
  kind: 'RECIPE_CANDIDATE' as const,
  name: 'Chicken vegetable stew',
  servingGrams: 300,
  macros: { calories: 400, proteinG: 30, carbsG: 45, fatG: 12 },
  ingredients: [
    { name: 'chicken', quantity: 100, unit: 'g' },
    { name: 'carrot', quantity: 50, unit: 'g' },
  ],
  preparation: 'Simmer the ingredients until completely cooked.',
};

test('[BATCH-9] exact observations deduplicate, while serving and preparation variants survive', () => {
  const first = observedContentSignature(base);
  assert.equal(
    first,
    observedContentSignature({
      ...base,
      ingredients: [...base.ingredients].reverse(),
      name: ' CHICKEN vegetable stew ',
    })
  );
  assert.notEqual(first, observedContentSignature({ ...base, servingGrams: 350 }));
  assert.notEqual(first, observedContentSignature({ ...base, preparation: 'Roast first, then simmer.' }));
});

test('[BATCH-9] recipe consent and image rights are independent, explicit choices', () => {
  assert.equal(
    observedMealConsentSchema.safeParse({
      detailsConsent: false,
      imageReuseConsent: false,
      imageRightsConfirmed: false,
    }).success,
    false
  );
  assert.equal(
    observedMealConsentSchema.safeParse({ detailsConsent: true, imageReuseConsent: true, imageRightsConfirmed: false })
      .success,
    false
  );
  assert.equal(
    observedMealConsentSchema.safeParse({ detailsConsent: true, imageReuseConsent: false, imageRightsConfirmed: false })
      .success,
    true
  );
  assert.equal(
    observedMealConsentSchema.safeParse({ detailsConsent: true, imageReuseConsent: true, imageRightsConfirmed: true })
      .success,
    true
  );
});

test('[BATCH-9] admission rejects unstructured fields and obvious contact details', () => {
  assert.equal(
    observedMealAdmissionSchema.safeParse({
      kind: 'RECIPE_CANDIDATE',
      canonicalName: 'Chicken stew',
      secretUserId: 'not allowed',
    }).success,
    false
  );
  assert.equal(assertShareableText('Recipe by jane@example.com'), false);
  assert.equal(assertShareableText('Chicken stew'), true);
});
