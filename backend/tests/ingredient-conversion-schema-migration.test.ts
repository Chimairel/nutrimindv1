import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260906234500_ingredient_conversion_evidence/migration.sql'), 'utf8');

test('[TEST-135] conversion evidence schema is normalized, additive, and has no shortcut food price fields', () => {
  assert.match(schema, /model IngredientConversionSource \{/);
  assert.match(schema, /model IngredientConversionEvidence \{/);
  assert.match(schema, /enum IngredientConversionBasis \{[\s\S]*PURCHASED_AS_SOLD[\s\S]*RAW_EDIBLE[\s\S]*COOKED_EDIBLE/);
  assert.match(migration, /CREATE TABLE "IngredientConversionSource"/);
  assert.match(migration, /CREATE TABLE "IngredientConversionEvidence"/);
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/im);
  const foodItem = schema.match(/model FoodItem \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(foodItem, /conversionFactor|yieldFactor|cookedPrice|ediblePrice/i);
});

test('[TEST-135] SQL constraints enforce factors, basis, identity, review, dates, and supersession', () => {
  for (const constraint of [
    'IngredientConversionEvidence_positive_factors',
    'IngredientConversionEvidence_ordered_factor_range',
    'IngredientConversionEvidence_period_order',
    'IngredientConversionEvidence_review_shape',
    'IngredientConversionEvidence_no_self_supersession',
    'IngredientConversionEvidence_identity_shape',
    'IngredientConversionEvidence_kind_shape',
  ]) assert.match(migration, new RegExp(constraint));
  assert.match(migration, /IngredientConversionEvidence_supersedesEvidenceId_key/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test('[TEST-135] both provenance tables reject update and delete mutations', () => {
  assert.match(migration, /IngredientConversionSource_append_only/);
  assert.match(migration, /IngredientConversionEvidence_append_only/);
  assert.match(migration, /IngredientConversionEvidence_reject_mutation/);
  assert.match(migration, /IngredientConversionEvidence_usable_source_only/);
  assert.match(migration, /conversion factors require reviewed source-use rights/);
});
