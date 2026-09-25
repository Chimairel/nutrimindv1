import assert from 'node:assert/strict';
import test from 'node:test';
import { adminMealInputSchema, adminMealUpdateSchema } from '../src/validation/admin-meal.schemas';
import { evaluateMealLibrarySafetyEvidence } from '../src/domain/meal-library-safety-evidence.policy';

const completeDraft = {
  mealName: 'Chicken and rice bowl',
  mealType: 'LUNCH',
  summary: 'Cooked chicken with rice and vegetables.',
  instructions: 'Boil the rice, cook chicken thoroughly, then serve with vegetables.',
  nutritionBasis: 'Calculated per serving from FNRI ingredient quantities; cooking oil estimated.',
  nutritionServingDescription: 'One 350 g bowl',
  calories: 460,
  proteinG: 31,
  carbsG: 50,
  fatG: 13,
  sodiumMg: null,
  sugarG: 3,
  fiberG: 4,
  potassiumMg: null,
  phosphorusMg: null,
  saturatedFatG: null,
  ingredients: [{ foodItemId: 'fnri-rice-1', gramsPerServing: 160 }],
};

test('admin meal authoring requires complete per-serving recipe and nutrition source context', () => {
  assert.equal(adminMealInputSchema.safeParse(completeDraft).success, true);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, instructions: '' }).success, false);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, nutritionBasis: '' }).success, false);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, ingredients: [] }).success, false);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, calories: -1 }).success, false);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, sodiumMg: -1 }).success, false);
  assert.equal(adminMealInputSchema.safeParse({ ...completeDraft, unexpectedClearance: true }).success, false);
  assert.equal(adminMealUpdateSchema.safeParse({ ...completeDraft, expectedRevision: 0 }).success, false);
  assert.equal(adminMealUpdateSchema.safeParse({ ...completeDraft, expectedRevision: 1 }).success, true);
});

test('admin authored incomplete evidence cannot enter matching even with complete ingredient links', () => {
  const result = evaluateMealLibrarySafetyEvidence({
    status: 'APPROVED',
    safetyEvidenceStatus: 'INCOMPLETE',
    safetyEvidenceOrigin: 'LEGACY_UNREVIEWED',
    conditionDeclarationState: 'NOT_REVIEWED',
    allergenDeclarationState: 'NOT_REVIEWED',
    crossContactAssessment: 'NOT_ASSESSED',
    safetyEvidenceRevision: 1,
    certifiedEvidenceRevision: null,
    safetyPolicyVersion: null,
    safetyInvalidatedAt: null,
    reviewerEligible: false,
    ingredients: [{ dataSource: 'FNRI', foodItemId: 'fnri-rice-1' }],
    safetyDeclarations: [],
  });
  assert.equal(result.complete, false);
  assert.equal(result.adapterEvidence.baseComplete, false);
});
