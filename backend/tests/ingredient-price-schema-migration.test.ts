import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260906120000_ingredient_price_foundation/migration.sql'),
  'utf8',
);

const models = [
  'IngredientPriceSource',
  'IngredientPricePublication',
  'IngredientPriceGeography',
  'IngredientPriceCommodity',
  'IngredientPriceCommodityMapping',
  'IngredientPriceObservation',
];

test('[TEST-095] price foundation is additive and has no timeless FoodItem price', () => {
  for (const model of models) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  const foodItem = schema.match(/model FoodItem \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(foodItem, /\b(price|cost|amountCentavos)\b/i);
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/im);
  assert.doesNotMatch(migration, /ALTER TABLE "(User|FoodItem|MealPlan|MealIngredient|MealLibrary|MealLibraryIngredient|GroceryList|GroceryItem)"/);
});

test('[TEST-095] observations preserve source, geography, dates, units, mappings, and PHP ranges', () => {
  assert.match(schema, /sourceObservationKey\s+String/);
  assert.match(schema, /amountMinCentavos\s+Int/);
  assert.match(schema, /amountMaxCentavos\s+Int/);
  assert.match(schema, /originalCommodityDescription\s+String/);
  assert.match(schema, /normalizedQuantity\s+Decimal\?/);
  assert.match(schema, /supersedesObservationId\s+String\?/);
  assert.match(migration, /IngredientPriceObservation_money_range/);
  assert.match(migration, /IngredientPriceObservation_period_order/);
  assert.match(migration, /IngredientPriceObservation_normalization_shape/);
  assert.match(migration, /IngredientPriceCommodityMapping_state_shape/);
});

test('[TEST-095] price evidence is append-only and deletes remain restrictive', () => {
  for (const model of models) {
    assert.match(migration, new RegExp(`"${model}_append_only"`));
  }
  assert.match(migration, /IngredientPriceEvidence_reject_mutation/);
  assert.match(migration, /IngredientPriceObservation_publicationId_fkey[\s\S]*?ON DELETE RESTRICT/);
  assert.match(migration, /IngredientPriceCommodityMapping_foodItemId_fkey[\s\S]*?ON DELETE RESTRICT/);
});
