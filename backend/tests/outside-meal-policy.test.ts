import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseOutsideMealItems,
  resolveOutsideMealAiAllowance,
  resolveOutsideMealAiLimits,
  scalePer100GramMacros,
  summarizeOutsideMealNutrition,
} from '../src/domain/outside-meal.policy';

test('[TEST-174] comma-delimited outside foods preserve spaces and the word and', () => {
  assert.deepEqual(parseOutsideMealItems('chicken adobo, brown rice - 150g, fish and chips (220 grams)'), [
    { name: 'chicken adobo', portionGrams: null },
    { name: 'brown rice', portionGrams: 150 },
    { name: 'fish and chips', portionGrams: 220 },
  ]);
  assert.throws(() => parseOutsideMealItems(', ,'));
  assert.throws(() => parseOutsideMealItems(Array.from({ length: 11 }, (_, i) => `food ${i}`).join(',')));
});

test('[TEST-175] FNRI per-100g values require and scale a measured portion', () => {
  assert.deepEqual(scalePer100GramMacros({ calories: 200, proteinG: 10, carbsG: 20, fatG: 5 }, 150), {
    calories: 300,
    proteinG: 15,
    carbsG: 30,
    fatG: 7.5,
  });
  assert.throws(() => scalePer100GramMacros({ calories: 200, proteinG: 10, carbsG: 20, fatG: 5 }, 0));
});

test('[TEST-176] provisional AI values count now while unresolved values never become zero-food', () => {
  const summary = summarizeOutsideMealNutrition([
    {
      source: 'FNRI',
      nutritionStatus: 'REFERENCE_RESOLVED',
      includedInTotals: true,
      calories: 200,
      proteinG: 4,
      carbsG: 40,
      fatG: 2,
    },
    {
      source: 'GEMINI_ESTIMATED',
      nutritionStatus: 'PENDING_REVIEW',
      includedInTotals: true,
      calories: 350,
      proteinG: 20,
      carbsG: 30,
      fatG: 12,
    },
    {
      source: 'UNRESOLVED',
      nutritionStatus: 'UNRESOLVED',
      includedInTotals: false,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    },
    {
      source: 'GEMINI_ESTIMATED',
      nutritionStatus: 'NEEDS_MORE_INFO',
      includedInTotals: true,
      calories: 50,
      proteinG: 1,
      carbsG: 10,
      fatG: 0,
    },
  ]);
  assert.equal(summary.totals.calories, 600);
  assert.equal(summary.provisionalCalories, 400);
  assert.equal(summary.unresolvedItemCount, 1);
  assert.equal(summary.completeness, 'PARTIAL');
});

test('[TEST-177] AI estimation is Premium-only and subject to both quotas', () => {
  assert.equal(
    resolveOutsideMealAiAllowance({ tier: 'FREE', requestedItems: 1, usedToday: 0, usedRolling30Days: 0 }).reason,
    'PREMIUM_REQUIRED'
  );
  assert.equal(
    resolveOutsideMealAiAllowance({ tier: 'PREMIUM', requestedItems: 1, usedToday: 5, usedRolling30Days: 5 }).reason,
    'DAILY_LIMIT_REACHED'
  );
  assert.equal(
    resolveOutsideMealAiAllowance({ tier: 'PREMIUM', requestedItems: 1, usedToday: 0, usedRolling30Days: 30 }).reason,
    'ROLLING_LIMIT_REACHED'
  );
  assert.equal(
    resolveOutsideMealAiAllowance({ tier: 'PREMIUM', requestedItems: 2, usedToday: 1, usedRolling30Days: 10 }).allowed,
    true
  );
});

test('[TEST-177] AI limits have bounded server configuration', () => {
  assert.deepEqual(resolveOutsideMealAiLimits({} as NodeJS.ProcessEnv), { dailyCap: 5, rolling30DayCap: 30 });
  assert.deepEqual(
    resolveOutsideMealAiLimits({
      OUTSIDE_MEAL_AI_DAILY_CAP: '7',
      OUTSIDE_MEAL_AI_30_DAY_CAP: '45',
    } as NodeJS.ProcessEnv),
    { dailyCap: 7, rolling30DayCap: 45 }
  );
  assert.throws(() => resolveOutsideMealAiLimits({ OUTSIDE_MEAL_AI_DAILY_CAP: '0' } as NodeJS.ProcessEnv));
  assert.throws(() =>
    resolveOutsideMealAiLimits({ OUTSIDE_MEAL_AI_DAILY_CAP: '9', OUTSIDE_MEAL_AI_30_DAY_CAP: '8' } as NodeJS.ProcessEnv)
  );
});
