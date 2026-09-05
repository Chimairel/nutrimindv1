import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { evaluateMealGenerationLibraryCompatibility } from '../src/domain/meal-generation-library-compatibility.adapter';

const completeCandidate = (conditions: string[] = [], allergenFree: string[] = [], detectedAllergens: string[] = []) => ({
  status: 'APPROVED',
  suitableConditions: conditions,
  allergenFree,
  safetyEvidence: {
    complete: true,
    detectedAllergens,
    conditionRulesReviewed: true,
  },
  ingredients: [{ dataSource: 'FNRI', foodItemId: 'food-1' }],
});

const entry = (domain: string, canonicalCode: string | null, supportState = 'SUPPORTED', displayName = canonicalCode || 'Custom') => ({
  domain, canonicalCode, supportState, displayName, originalText: displayName,
});

test('[TEST-074] structured entries are authoritative and aliases dedupe across entry paths', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [
      entry('CONDITION', 'DIABETES'),
      entry('ALLERGY', 'EGGS'),
      entry('AVOIDED_INGREDIENT', 'EGGS'),
    ],
    healthConditions: ['HYPERTENSION'],
    allergies: ['DAIRY'],
  });
  assert.equal(adapted.source, 'STRUCTURED');
  assert.deepEqual(adapted.conditions, ['DIABETES']);
  assert.deepEqual(adapted.allergies, ['EGGS']);
});

test('[TEST-074] legacy fallback remains deterministic when structured rows do not exist', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [],
    healthConditions: ['DIABETES', 'NONE'],
    allergies: ['EGGS'],
    otherConditions: 'Gout',
    otherAllergies: 'Soy, pork',
  });
  assert.equal(adapted.source, 'LEGACY');
  assert.deepEqual(adapted.conditions, ['DIABETES']);
  assert.deepEqual(adapted.customFoodRestrictions, ['Soy', 'pork']);
  assert.equal(adapted.requiresReview, true);
});

test('[TEST-074] known high-risk structured conditions retain their canonical escalation signal and review gate', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [entry('CONDITION', 'KIDNEY_DISEASE', 'RECOGNIZED_UNSUPPORTED', 'Kidney disease')],
  });
  assert.deepEqual(adapted.conditions, ['KIDNEY_DISEASE']);
  assert.deepEqual(adapted.customConditions, ['KIDNEY_DISEASE']);
  assert.equal(adapted.requiresReview, true);
});

test('[TEST-075] required realistic structured combinations use conservative intersection semantics', () => {
  const cases = [
    {
      label: 'diabetes + vegetarian + egg allergy',
      entries: [entry('CONDITION', 'DIABETES'), entry('ALLERGY', 'EGGS')],
      candidate: completeCandidate(['DIABETES'], ['EGGS']),
      expected: 'ALLOW',
    },
    {
      label: 'hypertension + pescatarian + dairy allergy',
      entries: [entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'DAIRY')],
      candidate: completeCandidate(['HYPERTENSION'], ['DAIRY']),
      expected: 'ALLOW',
    },
    {
      label: 'diabetes + hypertension + gluten allergy',
      entries: [entry('CONDITION', 'DIABETES'), entry('CONDITION', 'HYPERTENSION'), entry('ALLERGY', 'GLUTEN')],
      candidate: completeCandidate(['DIABETES', 'HYPERTENSION'], ['GLUTEN']),
      expected: 'ALLOW',
    },
    {
      label: 'unsupported condition with supported restrictions',
      entries: [entry('CONDITION', 'DIABETES'), entry('CONDITION', 'GOUT', 'RECOGNIZED_UNSUPPORTED', 'Gout')],
      candidate: completeCandidate(['DIABETES']),
      expected: 'REVIEW',
    },
    {
      label: 'pending condition plus avoided ingredient',
      entries: [entry('CONDITION', null, 'PENDING_REVIEW', 'Pending syndrome'), entry('AVOIDED_INGREDIENT', 'EGGS')],
      candidate: completeCandidate([], ['EGGS']),
      expected: 'REVIEW',
    },
    {
      label: 'multiple allergy intolerance avoidance with one conflict',
      entries: [entry('ALLERGY', 'EGGS'), entry('INTOLERANCE', 'LACTOSE', 'RECOGNIZED_UNSUPPORTED', 'Lactose'), entry('AVOIDED_INGREDIENT', 'DAIRY')],
      candidate: completeCandidate([], ['EGGS', 'DAIRY'], ['DAIRY']),
      expected: 'BLOCK',
    },
  ] as const;

  for (const profile of cases) {
    const adapted = adaptUserSafetyRestrictions({ safetyEntries: profile.entries });
    const result = evaluateMealGenerationLibraryCompatibility({
      userRestrictions: adapted.evaluationRestrictions,
      candidate: profile.candidate,
    });
    assert.equal(result.evaluation.decision, profile.expected, profile.label);
    assert.equal(result.eligible, profile.expected === 'ALLOW', profile.label);
  }
});

test('[TEST-075] precedence is BLOCK over REVIEW over ALLOW', () => {
  const adapted = adaptUserSafetyRestrictions({
    safetyEntries: [
      entry('ALLERGY', 'EGGS'),
      entry('INTOLERANCE', 'LACTOSE', 'RECOGNIZED_UNSUPPORTED', 'Lactose intolerance'),
    ],
  });
  const result = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: adapted.evaluationRestrictions,
    candidate: completeCandidate([], ['EGGS'], ['EGGS']),
  });
  assert.equal(result.evaluation.decision, 'BLOCK');
  assert.ok(result.reasonCodes.includes('EXACT_ALLERGEN_CONFLICT'));
  assert.ok(result.reasonCodes.includes('CUSTOM_RESTRICTION_UNMAPPED'));
});
