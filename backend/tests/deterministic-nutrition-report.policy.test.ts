import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeterministicNutritionGuidance } from '../src/domain/deterministic-nutrition-report.policy';

const base = {
  age: 25, dailyCalories: 2000, weightKg: 70,
  conditions: [] as string[], allergens: [] as string[],
  otherConditions: [] as string[], otherFoodRestrictions: [] as string[],
};

test('adult references use energy-relative PDRI ranges and cite their source', () => {
  const report = buildDeterministicNutritionGuidance(base);
  assert.equal(report.referenceItems.find((item) => item.heading === 'Protein reference')?.value, '50–75 g/day');
  assert.equal(report.referenceItems.find((item) => item.heading === 'Carbohydrate reference')?.value, '275–375 g/day');
  assert.ok(report.referenceItems.every((item) => item.sourceUrl.startsWith('https://')));
});

test('an 18-year-old does not receive the adult AMDR row', () => {
  const report = buildDeterministicNutritionGuidance({ ...base, age: 18 });
  assert.ok(report.referenceItems.some((item) => item.heading === 'Age-specific nutrient ranges'));
  assert.ok(!report.referenceItems.some((item) => item.heading === 'Protein reference'));
});

test('diabetes and kidney disease do not acquire invented universal limits', () => {
  const report = buildDeterministicNutritionGuidance({ ...base, conditions: ['DIABETES', 'KIDNEY_DISEASE'] });
  assert.equal(report.referenceItems.find((item) => item.heading === 'Dietary fiber reference')?.value, '28 g/day');
  assert.equal(report.referenceItems.find((item) => item.heading === 'Carbohydrate plan for diabetes')?.value, 'Individual review required');
  assert.equal(report.referenceItems.find((item) => item.heading === 'Kidney-related nutrient limits')?.value, 'Individual review required');
  assert.ok(!report.referenceItems.some((item) => item.value.includes('56 g/day')));
});

test('reported allergens and custom conditions produce review notes rather than safe doses', () => {
  const report = buildDeterministicNutritionGuidance({ ...base, allergens: ['DAIRY'], otherConditions: ['unclassified condition'] });
  assert.ok(report.referenceItems.some((item) => item.heading === 'Declared food restrictions' && item.explanation.includes('cross-contact')));
  assert.ok(report.referenceItems.some((item) => item.heading === 'Additional reported conditions' && item.value === 'Individual review required'));
});
