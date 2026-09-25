import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNutritionReferences } from '../src/domain/nutrition-reference-calculation.policy';

test('[TEST-221] calculates energy-relative nutrition references with explicit provenance', () => {
  const result = calculateNutritionReferences({ dailyCalories: 2000, bodyWeightKg: 70 });

  assert.deepEqual(result.filipinoAdultAmdr.proteinG, { minimum: 50, maximum: 75, unit: 'g/day' });
  assert.deepEqual(result.filipinoAdultAmdr.fatG, { minimum: 33.3, maximum: 66.7, unit: 'g/day' });
  assert.deepEqual(result.filipinoAdultAmdr.carbohydrateG, { minimum: 275, maximum: 375, unit: 'g/day' });
  assert.equal(result.diabetesReviewFiberG.value, 28);
  assert.equal(result.cardiovascularReviewSaturatedFatG.value, 13.3);
  assert.equal(result.ckdReviewProteinG?.value, 56);
  assert.equal(result.diabetesReviewFiberG.authority, 'REVIEW_ASSISTANCE_ONLY');
});

test('[TEST-222] rejects missing calculation inputs rather than inventing a threshold', () => {
  assert.throws(() => calculateNutritionReferences({ dailyCalories: 0 }), /positive daily calorie target/u);
  assert.throws(
    () => calculateNutritionReferences({ dailyCalories: 2000, bodyWeightKg: Number.NaN }),
    /Body weight must be a positive finite value/u
  );
});
