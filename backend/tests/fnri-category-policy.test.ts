import assert from 'node:assert/strict';
import test from 'node:test';
import { getFNRICategory } from '../src/domain/fnri-category.policy';

test('[TEST-056] FNRI meat, fish, egg, dairy, fat, and sweet prefixes are not shifted', () => {
  assert.equal(getFNRICategory('F015'), 'Meat & Poultry');
  assert.equal(getFNRICategory('G001'), 'Fish & Shellfish');
  assert.equal(getFNRICategory('H001'), 'Eggs');
  assert.equal(getFNRICategory('J001'), 'Milk & Dairy');
  assert.equal(getFNRICategory('K001'), 'Fats & Oils');
  assert.equal(getFNRICategory('M001'), 'Sugars & Sweets');
});

test('[TEST-057] FNRI beverage and miscellaneous prefixes use supported application categories', () => {
  assert.equal(getFNRICategory('P001'), 'Beverages');
  assert.equal(getFNRICategory('Q001'), 'Beverages');
  assert.equal(getFNRICategory('N001'), 'Miscellaneous');
  assert.equal(getFNRICategory('R001'), 'Miscellaneous');
  assert.equal(getFNRICategory('T001'), 'Miscellaneous');
  assert.equal(getFNRICategory('unknown'), 'Miscellaneous');
});
