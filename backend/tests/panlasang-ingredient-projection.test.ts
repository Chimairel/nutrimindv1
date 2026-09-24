import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecipeCandidateIngredients } from '../src/services/panlasang-recipe-candidate.provider';

test('candidate projection preserves reviewed FNRI identity metadata', () => {
  assert.deepEqual(
    parseRecipeCandidateIngredients([
      {
        name: 'leftover rice',
        quantity: 1.33,
        unit: 'cups',
        foodItemId: 'rice-id',
        fnriFoodName: 'Rice, well-milled, boiled',
        fnriMatchMethod: 'CURATED_EQUIVALENT',
        fnriMappingVersion: 'PANLASANG_FNRI_IDENTITY_V1',
      },
    ]),
    [
      {
        name: 'leftover rice',
        quantity: 1.33,
        unit: 'cups',
        foodItemId: 'rice-id',
        fnriFoodName: 'Rice, well-milled, boiled',
        fnriMatchMethod: 'CURATED_EQUIVALENT',
        fnriMappingVersion: 'PANLASANG_FNRI_IDENTITY_V1',
      },
    ]
  );
});

test('candidate projection excludes scraper fragments marked invalid', () => {
  assert.deepEqual(
    parseRecipeCandidateIngredients([
      { name: '(chopped)', excludedFromPlanning: true },
      { name: 'garlic', excludedFromPlanning: false },
    ]),
    [
      {
        name: 'garlic',
        quantity: undefined,
        unit: undefined,
        foodItemId: undefined,
        fnriFoodName: undefined,
        fnriMatchMethod: undefined,
        fnriMappingVersion: undefined,
      },
    ]
  );
});
