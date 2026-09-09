import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMealExplanation, type MealSelectionEvidence } from '../src/domain/meal-explanation.policy';

const evidence: MealSelectionEvidence = {
  schemaVersion: 1,
  source: 'AI_GENERATED',
  dailyCalorieTarget: 2400,
  slotCalorieTarget: 720,
  slotCalorieLower: 612,
  slotCalorieUpper: 828,
  localityPreference: 'REGIONAL',
  planningLocationLabel: 'Central Visayas regional preference',
  consumptionEvidenceScope: 'Central Visayas',
  consumptionEvidenceRelease: 'FNRI ENNS 2023',
  capturedAt: '2026-09-09T00:00:00.000Z',
};

test('[TEST-203] meal explanation reports persisted calorie, locality, provenance, and review facts', () => {
  const result = buildMealExplanation({
    status: 'PENDING_REVIEW',
    aiConfidenceFlag: 'CAUTION',
    calories: 700,
    ingredients: [
      { dataSource: 'FNRI', foodItemId: 'rice' },
      { dataSource: 'GEMINI_ESTIMATED', foodItemId: null },
    ],
    selectionEvidence: evidence,
  });

  assert.equal(result.source, 'AI_GENERATED');
  assert.equal(result.calorieFit, 'WITHIN_TARGET');
  assert.equal(result.nutritionEvidence, 'MIXED');
  assert.equal(result.reviewState, 'PENDING_REVIEW');
  assert.equal(result.limitation, undefined);
  assert.ok(result.bullets.some((line) => line.includes('612–828 kcal')));
  assert.ok(result.bullets.some((line) => line.includes('Central Visayas')));
  assert.ok(result.bullets.some((line) => line.includes('1 of 2 ingredients')));
});

test('[TEST-204] legacy meal explanation refuses to invent missing selection evidence', () => {
  const result = buildMealExplanation({
    libraryMealId: null,
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 500,
    ingredients: [],
    selectionEvidence: null,
  });

  assert.equal(result.source, 'LEGACY_UNKNOWN');
  assert.equal(result.calorieFit, 'UNAVAILABLE');
  assert.equal(result.nutritionEvidence, 'UNAVAILABLE');
  assert.match(result.limitation || '', /unavailable/i);
  assert.ok(result.bullets.every((line) => !line.includes('within')));
});

test('[TEST-205] verified-library meals expose certification and all-FNRI evidence', () => {
  const result = buildMealExplanation({
    libraryMealId: 'meal-library-1',
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 700,
    verifierName: 'Andrea Reyes, RND',
    ingredients: [
      { dataSource: 'FNRI', foodItemId: 'rice' },
      { dataSource: 'FNRI', foodItemId: 'chicken' },
    ],
    selectionEvidence: { ...evidence, source: 'VERIFIED_LIBRARY' },
  });

  assert.equal(result.source, 'VERIFIED_LIBRARY');
  assert.equal(result.reviewState, 'NUTRITIONIST_VERIFIED');
  assert.equal(result.nutritionEvidence, 'ALL_FNRI');
  assert.ok(result.bullets.some((line) => line.includes('Andrea Reyes')));
});

test('[TEST-206] catalogue fallback copy does not duplicate the preference label', () => {
  const result = buildMealExplanation({
    status: 'APPROVED',
    aiConfidenceFlag: 'SAFE',
    calories: 700,
    ingredients: [],
    selectionEvidence: {
      ...evidence,
      consumptionEvidenceScope: null,
      planningLocationLabel: 'Cebu City local preference',
    },
  });
  assert.ok(result.bullets.some((line) => line.includes('with cebu city local preference.')));
  assert.ok(result.bullets.every((line) => !line.includes('preference preference')));
});
