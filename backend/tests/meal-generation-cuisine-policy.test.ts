import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMealGenerationPrompt,
  MEAL_GENERATION_CUISINE_POLICY,
} from '../src/domain/meal-generation-cuisine.policy';

const promptInput = {
  slots: [
    { dayNumber: 1, mealType: 'BREAKFAST' as const },
    { dayNumber: 1, mealType: 'LUNCH' as const },
  ],
  dailyCalorieTarget: 2000,
  goal: 'MAINTAIN',
  dietaryPreference: 'OMNIVORE',
  carbPreference: 'MODERATE',
  foodCulture: 'Filipino',
  conditions: ['HYPERTENSION'],
  allergens: ['NUTS'],
  otherConditions: 'Gout',
  otherAllergies: 'Sesame',
  foodReference: '- Egg (Cat: Eggs, Cal: 155kcal, P: 13g, C: 1.1g, F: 11g)',
};

test('[TEST-042] meal generation treats food culture as an influence rather than a cuisine boundary', () => {
  const { prompt, systemInstruction } = buildMealGenerationPrompt(promptInput);

  assert.match(systemInstruction, /not limited to Filipino cuisine/i);
  assert.match(prompt, /influence only; this does not restrict the plan to one cuisine/i);
  assert.doesNotMatch(prompt, /native Filipino ingredients dictionary/i);
});

test('[TEST-043] meal generation explicitly allows accessible general and convenience foods', () => {
  assert.match(MEAL_GENERATION_CUISINE_POLICY, /universally familiar simple meals/i);
  assert.match(MEAL_GENERATION_CUISINE_POLICY, /ready-to-eat or convenience foods/i);
  assert.match(MEAL_GENERATION_CUISINE_POLICY, /groceries, markets, convenience stores, or common food outlets/i);
  assert.match(MEAL_GENERATION_CUISINE_POLICY, /not an exclusive ingredient whitelist/i);
});

test('[TEST-044] cuisine variety remains subordinate to recorded clinical constraints', () => {
  const { prompt } = buildMealGenerationPrompt(promptInput);

  assert.match(prompt, /Medical Conditions: HYPERTENSION; Additional: Gout/);
  assert.match(prompt, /Allergens to EXCLUDE completely: NUTS; Additional: Sesame/);
  assert.match(prompt, /Clinical safety always overrides cuisine variety, convenience, cost, or user preference/i);
});
