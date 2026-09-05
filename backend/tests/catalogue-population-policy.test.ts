import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import {
  CURRENT_CATALOGUE_REVIEW_REASON,
  catalogueDefinitionSignature,
  hasCurrentCatalogueDefinition,
  shouldUpdateCatalogueVerifiedCount,
} from '../src/domain/catalogue-population.policy';

test('[TEST-077] catalogue signatures are stable and definition-sensitive', () => {
  const meal = COMMON_MEAL_CATALOGUE.find((candidate) => candidate.mealName === 'Tokwa Ampalaya Rice Bowl');
  assert.ok(meal);
  assert.equal(catalogueDefinitionSignature(meal), catalogueDefinitionSignature({ ...meal }));
  assert.notEqual(
    catalogueDefinitionSignature(meal),
    catalogueDefinitionSignature({ ...meal, description: `${meal.description} changed` }),
  );
});

test('[TEST-077] a repeat population skips only complete current signed definitions', () => {
  const meal = COMMON_MEAL_CATALOGUE.find((candidate) => candidate.mealName === 'Tokwa Sayote and Sitaw Dinner Plate');
  assert.ok(meal);
  const currentReview = {
    reasonCode: CURRENT_CATALOGUE_REVIEW_REASON,
    evidenceSnapshot: { signature: catalogueDefinitionSignature(meal) },
  };

  assert.equal(hasCurrentCatalogueDefinition(meal, {
    safetyEvidenceStatus: 'COMPLETE',
    safetyReviews: [currentReview],
  }), true);
  assert.equal(hasCurrentCatalogueDefinition(meal, {
    safetyEvidenceStatus: 'INCOMPLETE',
    safetyReviews: [currentReview],
  }), false);
  assert.equal(hasCurrentCatalogueDefinition(meal, {
    safetyEvidenceStatus: 'COMPLETE',
    safetyReviews: [{ ...currentReview, reasonCode: 'NUTRIMIND_COMMON_LIBRARY_V2' }],
  }), false);
  assert.equal(hasCurrentCatalogueDefinition({ ...meal, description: `${meal.description} changed` }, {
    safetyEvidenceStatus: 'COMPLETE',
    safetyReviews: [currentReview],
  }), false);
  assert.equal(shouldUpdateCatalogueVerifiedCount(51, 51), false);
  assert.equal(shouldUpdateCatalogueVerifiedCount(49, 51), true);
});
