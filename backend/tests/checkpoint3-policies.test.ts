import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { AssuranceTier, HealthConditionType } from '@prisma/client';
import {
  conditionAllowsRulesetAutomation,
  conditionRequiresUserScopedClearance,
  getConditionAssuranceTier,
  getMaximumAssuranceTier,
} from '../src/domain/assurance-tier.policy';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';
import { normalizeRawRecipeQuantity } from '../src/services/raw-recipe-candidate.service';

test('[CHECKPOINT-3] assurance tiers and take-the-maximum behavior match the locked architecture', () => {
  assert.equal(getConditionAssuranceTier(HealthConditionType.NONE), AssuranceTier.BASE);
  assert.equal(getConditionAssuranceTier(HealthConditionType.HYPERTENSION), AssuranceTier.STANDARD);
  assert.equal(getConditionAssuranceTier(HealthConditionType.DIABETES), AssuranceTier.STANDARD);
  assert.equal(getConditionAssuranceTier(HealthConditionType.KIDNEY_DISEASE), AssuranceTier.ENHANCED);
  assert.equal(getConditionAssuranceTier(HealthConditionType.HEART_CONDITION), AssuranceTier.ENHANCED);
  assert.equal(getConditionAssuranceTier(HealthConditionType.PREGNANT), AssuranceTier.ENHANCED);
  assert.equal(
    getMaximumAssuranceTier([HealthConditionType.HYPERTENSION, HealthConditionType.KIDNEY_DISEASE]),
    AssuranceTier.ENHANCED
  );
  assert.equal(conditionAllowsRulesetAutomation(HealthConditionType.HYPERTENSION), true);
  assert.equal(conditionAllowsRulesetAutomation(HealthConditionType.DIABETES), false);
  assert.equal(conditionRequiresUserScopedClearance(HealthConditionType.KIDNEY_DISEASE), true);
  assert.equal(conditionRequiresUserScopedClearance(HealthConditionType.HEART_CONDITION), true);
});

test('[CHECKPOINT-3] deterministic generated-meal validation rejects definite allergy and diet conflicts', () => {
  const allergy = validateGeneratedMealCandidate({
    ingredients: [{ name: 'peanut butter' }, { name: 'banana' }],
    dietaryPreference: 'OMNIVORE',
    allergens: ['NUTS'],
  });
  assert.equal(allergy.accepted, false);
  assert.ok(allergy.definiteConflicts.includes('ALLERGEN_NUTS'));

  const diet = validateGeneratedMealCandidate({
    ingredients: [{ name: 'pork belly' }, { name: 'soy sauce' }],
    dietaryPreference: 'VEGAN',
    allergens: [],
  });
  assert.equal(diet.accepted, false);
  assert.ok(diet.definiteConflicts.includes('DIETARY_VEGAN'));
});

test('[CHECKPOINT-3] live reusable clearance identity is database-enforced for the exact scope', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260920151000_clearance_identity_constraint/migration.sql'),
    'utf8'
  );
  assert.match(migration, /CREATE UNIQUE INDEX "MealConditionClearance_live_scope_key"/);
  assert.match(migration, /COALESCE\("userScopeId", ''\)/);
  assert.match(migration, /WHERE "state" IN \('ACTIVE', 'REVIEW_DUE', 'DISPUTED'\)/);
});

test('[CHECKPOINT-3] qualitative raw recipe amounts remain unknown instead of violating positive quantity storage', () => {
  assert.equal(normalizeRawRecipeQuantity(2.5), 2.5);
  assert.equal(normalizeRawRecipeQuantity(0), undefined);
  assert.equal(normalizeRawRecipeQuantity(-1), undefined);
  assert.equal(normalizeRawRecipeQuantity('to taste'), undefined);
});
