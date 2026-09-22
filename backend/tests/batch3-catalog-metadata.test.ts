import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MealType } from '@prisma/client';
import { buildComposedServing, includedRiceEvidenceIsEvaluable } from '../src/domain/composed-serving.policy';
import { isMealApplicableToType, proposeMealTypeApplicability } from '../src/domain/meal-applicability.policy';
import { proposeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { buildRawRecipeContentSignature } from '../src/domain/raw-recipe-content-signature.policy';

test('[BATCH-3] persisted multi-label applicability supports lunch and dinner without request-time title inference', () => {
  const proposed = proposeMealTypeApplicability({
    name: 'Chicken Adobo Main Course',
    primaryMealType: MealType.LUNCH,
  });
  assert.deepEqual(proposed, [MealType.LUNCH, MealType.DINNER]);
  const persisted = proposed.map((mealType) => ({ mealType, reviewStatus: 'PROPOSED' as const }));
  assert.equal(isMealApplicableToType(persisted, MealType.DINNER), true);
  assert.equal(isMealApplicableToType(persisted, MealType.BREAKFAST), false);
});

test('[BATCH-3] rice proposals preserve included-rice uncertainty and reviewed evidence fails closed', () => {
  const unknown = proposeRiceRole({
    name: 'Chicken Arroz Caldo',
    ingredients: [{ name: 'rice', quantity: 1, unit: 'cup' }],
  });
  assert.equal(unknown.riceRole, 'INCLUDES_RICE');
  assert.equal(unknown.includedRiceG, null);
  assert.equal(
    includedRiceEvidenceIsEvaluable({ riceRole: unknown.riceRole, riceRoleReviewStatus: 'REVIEWED', includedRiceG: null }),
    false
  );
  assert.equal(
    includedRiceEvidenceIsEvaluable({ riceRole: 'PAIR_WITH_RICE', riceRoleReviewStatus: 'PROPOSED', includedRiceG: null }),
    false
  );
});

test('[BATCH-3] paired rice scales FNRI per-100g evidence and changes composed signature by grams', () => {
  const base = 'a'.repeat(64);
  const rice = { id: 'fnri-rice', name: 'Rice, boiled', source: 'FNRI 2019', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };
  const serving150 = buildComposedServing({
    baseRecipeSignature: base,
    baseNutrition: { calories: 400, proteinG: 30, carbsG: 10, fatG: 20 },
    riceFood: rice,
    cookedRiceG: 150,
  });
  const serving200 = buildComposedServing({
    baseRecipeSignature: base,
    baseNutrition: { calories: 400, proteinG: 30, carbsG: 10, fatG: 20 },
    riceFood: rice,
    cookedRiceG: 200,
  });
  assert.deepEqual(serving150.riceNutrition, { calories: 195, proteinG: 4.05, carbsG: 42, fatG: 0.45 });
  assert.equal(serving150.total.calories, 595);
  assert.notEqual(serving150.composedServingSignature, serving200.composedServingSignature);
});

test('[BATCH-3] raw signatures collapse exact normalized content but retain genuine variants', () => {
  const base = {
    name: 'Beef Kaldereta',
    category: 'Main Course',
    nutrition: { calories: 500, proteinG: 30, carbsG: 15, fatG: 35 },
    ingredients: [{ name: 'beef' }, { name: 'tomato sauce' }],
  };
  assert.equal(
    buildRawRecipeContentSignature(base),
    buildRawRecipeContentSignature({ ...base, name: '  BEEF-KALDERETA ', ingredients: [...base.ingredients].reverse() })
  );
  assert.notEqual(
    buildRawRecipeContentSignature(base),
    buildRawRecipeContentSignature({ ...base, name: 'Beef Kaldereta sa Gata', ingredients: [...base.ingredients, { name: 'coconut milk' }] })
  );
  assert.notEqual(
    buildRawRecipeContentSignature({ ...base, ingredients: [{ name: 'beef', quantity: 100, unit: 'g' }] }),
    buildRawRecipeContentSignature({ ...base, ingredients: [{ name: 'beef', quantity: 150, unit: 'g' }] })
  );
});

test('[BATCH-3] schema enforces favorite identity/cascade and raw provenance has no safety authority fields', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  assert.match(schema, /model MealFavorite[\s\S]*@@unique\(\[userId, mealLibraryId\]\)/u);
  assert.match(schema, /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/u);
  const provider = readFileSync('src/services/recipe-candidate-provider.ts', 'utf8');
  assert.doesNotMatch(provider, /safetyEvidenceStatus|conditionClearance|allergenFree/iu);
});
