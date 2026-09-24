import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  classifyMealIngredients,
  hasDefiniteDietaryConflict,
} from '../src/domain/meal-ingredient-classification.policy';
import { evaluateConditionNutrientRule } from '../src/domain/condition-rule-evaluation.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';

test('[TEST-202] deterministic classifier finds definite allergens and hierarchical diet compatibility', () => {
  const vegan = classifyMealIngredients([
    { name: 'brown rice', category: 'grain' },
    { name: 'tofu', category: 'protein' },
    { name: 'broccoli', category: 'vegetable' },
  ]);
  assert.equal(vegan.status, 'COMPLETE');
  assert.deepEqual(vegan.compatibleDietaryPreferences, ['OMNIVORE', 'PESCATARIAN', 'VEGETARIAN', 'VEGAN']);

  const shrimp = classifyMealIngredients([{ name: 'shrimp' }, { name: 'soy sauce' }, { name: 'rice' }]);
  assert.deepEqual(shrimp.detectedAllergens, ['GLUTEN', 'SHELLFISH']);
  assert.equal(hasDefiniteDietaryConflict(shrimp, 'VEGETARIAN'), true);
  assert.equal(hasDefiniteDietaryConflict(shrimp, 'PESCATARIAN'), false);

  const stew = classifyMealIngredients([{ name: 'chicken' }, { name: 'carrots' }, { name: 'broth' }]);
  assert.equal(stew.status, 'COMPLETE');
  assert.deepEqual(stew.unknownIngredients, []);
});

test('[TEST-203] unknown ingredients never become inferred vegetarian or allergen-free evidence', () => {
  const result = classifyMealIngredients([{ name: 'proprietary house mix' }]);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.deepEqual(result.compatibleDietaryPreferences, ['OMNIVORE']);
  assert.deepEqual(result.unknownIngredients, ['proprietary house mix']);
});

test('[TEST-203A] exact FNRI soybean curd is plant based without hiding real dairy', () => {
  for (const name of ['Soybean cheese, soft curd', 'Soybean cheese, hard curd', 'Soybean cheese, salted']) {
    const tofu = classifyMealIngredients([{ name, category: 'PROTEIN' }]);
    assert.equal(tofu.status, 'COMPLETE');
    assert.deepEqual(tofu.detectedAllergens, []);
    assert.ok(tofu.compatibleDietaryPreferences.includes('VEGAN'));
  }
  const withMilk = classifyMealIngredients([{ name: 'Soybean cheese, soft curd with milk' }]);
  assert.ok(withMilk.detectedAllergens.includes('DAIRY'));
  const cheese = classifyMealIngredients([{ name: 'Goat cheese' }]);
  assert.ok(cheese.detectedAllergens.includes('DAIRY'));
});

test('[TEST-204] condition evaluator ignores drafts and evaluates approved rules in their declared basis', () => {
  const base = {
    id: 'sodium-rule',
    nutrient: 'SODIUM_MG',
    operator: 'LESS_THAN_OR_EQUAL',
    threshold: 2300,
    basis: 'DAILY_TOTAL',
    severity: 'HARD_BLOCK',
    reviewStatus: 'DRAFT',
    active: false,
    approvedByNutritionistId: null,
  };
  assert.equal(evaluateConditionNutrientRule(base, {}, { dailyTotals: { sodiumMg: 2200 } }).decision, 'NOT_EVALUABLE');

  const approved = { ...base, reviewStatus: 'APPROVED', active: true, approvedByNutritionistId: 'rnd-1' };
  assert.equal(evaluateConditionNutrientRule(approved, {}, { dailyTotals: { sodiumMg: 2200 } }).decision, 'PASS');
  assert.equal(evaluateConditionNutrientRule(approved, {}, { dailyTotals: { sodiumMg: 2400 } }).decision, 'FAIL');
  assert.equal(evaluateConditionNutrientRule(approved, {}).decision, 'NOT_EVALUABLE');
});

test('[TEST-205] recipe signatures are order-independent and change with recipe evidence', () => {
  const base = {
    mealName: 'Beef and Broccoli',
    mealType: 'DINNER',
    calories: 508,
    proteinG: 24,
    carbsG: 18,
    fatG: 38,
    ingredients: [
      { ingredientName: 'beef', quantity: 100, unit: 'g' },
      { ingredientName: 'broccoli', quantity: 80, unit: 'g' },
    ],
  };
  const first = buildMealLibraryRecipeSignature(base);
  const reordered = buildMealLibraryRecipeSignature({ ...base, ingredients: [...base.ingredients].reverse() });
  const changed = buildMealLibraryRecipeSignature({ ...base, calories: 509 });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.match(first, /^[a-f0-9]{64}$/u);
});

test('[TEST-206] checkpoint-2 migration and draft-rule seed preserve review governance', () => {
  const root = path.resolve(__dirname, '..');
  const migration = fs.readFileSync(
    path.join(root, 'prisma/migrations/20260920120000_checkpoint2_classification_rules/migration.sql'),
    'utf8'
  );
  const seed = fs.readFileSync(path.join(root, 'prisma/seed-condition-rules.ts'), 'utf8');
  assert.match(migration, /ConditionNutrientRule_approval_integrity/u);
  assert.match(migration, /"recipeSignature"/u);
  assert.match(seed, /reviewStatus:\s*ConditionRuleReviewStatus\.DRAFT/gu);
  assert.match(seed, /approvedByNutritionistId:\s*null/gu);
  assert.match(seed, /active:\s*false/gu);
  assert.doesNotMatch(seed, /potassium-[0-9]/u);
  assert.doesNotMatch(seed, /phosphorus-[0-9]/u);
});

test('[TEST-207] user approval and reusable library publication remain separate actions', () => {
  const root = path.resolve(__dirname, '..');
  const review = fs.readFileSync(path.join(root, 'src/services/nutritionist-review.service.ts'), 'utf8');
  const replacement = fs.readFileSync(path.join(root, 'src/services/nutritionist-replacement.service.ts'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'src/routes/nutritionist.routes.ts'), 'utf8');
  const publication = fs.readFileSync(path.join(root, 'src/services/meal-library-publication.service.ts'), 'utf8');

  assert.doesNotMatch(review, /mealLibrary\.create\(/u);
  assert.doesNotMatch(replacement, /mealLibrary\.create\(/u);
  assert.match(routes, /approved\/:id\/reusable-draft/u);
  assert.match(publication, /recipeSignature/u);
  assert.match(publication, /P2002/u);
});

test('[TEST-208] meal generation uses bounded database candidate queries', () => {
  const root = path.resolve(__dirname, '..');
  const generation = fs.readFileSync(path.join(root, 'src/services/meal-generation.service.ts'), 'utf8');
  const composition = fs.readFileSync(path.join(root, 'src/services/meal-plan-composition.service.ts'), 'utf8');
  const candidateQuery = fs.readFileSync(
    path.join(root, 'src/services/meal-library-candidate-query.service.ts'),
    'utf8'
  );

  assert.doesNotMatch(generation, /prisma\.mealLibrary\.findMany/u);
  assert.doesNotMatch(composition, /prisma\.mealLibrary\.findMany/u);
  assert.match(generation, /generate7DayPlan/u);
  assert.match(composition, /queryEligibleLibraryMeals/gu);
  assert.match(candidateQuery, /take:\s*limit/u);
  assert.match(candidateQuery, /Math\.max\(1,\s*Math\.min\(input\.limit/gu);
});
