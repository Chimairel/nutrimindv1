import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isInvalidSourceIngredientLabel,
  matchSourceIngredientToFnri,
  normalizeSourceIngredientName,
} from '../src/domain/source-ingredient-fnri-match.policy';

const foods = [
  { id: 'rice', name: 'Rice, well-milled, boiled' },
  { id: 'egg', name: 'Egg, chicken, whole' },
  { id: 'egg-boiled', name: 'Egg, chicken, whole, boiled' },
  { id: 'garlic', name: 'Garlic bulb' },
  { id: 'onion', name: 'Onion, Bombay bulb' },
  { id: 'spring-onion', name: 'Onion, spring' },
  { id: 'carrot', name: 'Carrot' },
  { id: 'beef-chuck', name: 'Beef chuck' },
  { id: 'beef-brisket', name: 'Beef brisket' },
  { id: 'coconut-oil', name: 'Oil, coconut' },
  { id: 'corn-oil', name: 'Oil, corn' },
  { id: 'chicken-broth', name: 'Chicken noodle broth, inst' },
  { id: 'malunggay-powder', name: 'Malunggay leaves powder, dry' },
  { id: 'calamansi', name: 'Calamansi/Philippine lemon' },
  { id: 'macaroni', name: 'Pasta, macaroni' },
  { id: 'cashew-fruit', name: 'Cashew fruit' },
];

test('source ingredient cleanup removes quantities and preparation-only text', () => {
  assert.equal(normalizeSourceIngredientName('½ cup carrot (julienned)'), 'carrot');
  assert.equal(normalizeSourceIngredientName('lbs. beef chuck (cubed)'), 'beef chuck');
  assert.equal(normalizeSourceIngredientName('garlic (crushed and minced)'), 'garlic');
});

test('curated equivalents resolve cooking-state and Filipino recipe language', () => {
  assert.equal(matchSourceIngredientToFnri('leftover rice', foods)?.food.id, 'rice');
  assert.equal(matchSourceIngredientToFnri('cold leftover rice', foods)?.food.id, 'rice');
  assert.equal(matchSourceIngredientToFnri('raw eggs (beaten)', foods)?.food.id, 'egg');
  assert.equal(matchSourceIngredientToFnri('hard boiled eggs', foods)?.food.id, 'egg-boiled');
  assert.equal(matchSourceIngredientToFnri('green onions (chopped)', foods)?.food.id, 'spring-onion');
});

test('unique lexical matching resolves a specific cut but rejects ambiguous bases', () => {
  assert.equal(matchSourceIngredientToFnri('beef chuck (cubed)', foods)?.food.id, 'beef-chuck');
  assert.equal(matchSourceIngredientToFnri('beef', foods), null);
  assert.equal(matchSourceIngredientToFnri('cooking oil', foods), null);
  assert.equal(matchSourceIngredientToFnri('chicken broth', foods), null);
  assert.equal(matchSourceIngredientToFnri('malunggay leaves', foods), null);
  assert.equal(matchSourceIngredientToFnri('chopped cashew', foods), null);
});

test('curated regional and staple names map only to explicit equivalents', () => {
  assert.equal(matchSourceIngredientToFnri('calamansi', foods)?.food.id, 'calamansi');
  assert.equal(matchSourceIngredientToFnri('elbow macaroni', foods)?.food.id, 'macaroni');
});

test('verified admin aliases resolve source ingredients without trusting unverified or conflicting aliases', () => {
  const aliasFoods = [
    ...foods,
    { id: 'okra', name: 'Okra' },
    { id: 'radish', name: 'Radish' },
    { id: 'radish-boiled', name: 'Radish, boiled' },
    { id: 'malunggay-leaves', name: 'Horseradish tree lvs' },
  ];
  const verifiedAt = new Date('2026-09-26T00:00:00.000Z');
  const aliases = [
    { alias: 'okra pods', foodItemId: 'okra', verifiedAt },
    { alias: 'daikon radish', foodItemId: 'radish', verifiedAt },
    { alias: 'malunggay leaves', foodItemId: 'malunggay-leaves', verifiedAt },
    { alias: 'olive oil', foodItemId: 'coconut-oil', verifiedAt: null },
  ];
  assert.equal(matchSourceIngredientToFnri('okra pods (chopped)', aliasFoods, aliases)?.food.id, 'okra');
  assert.equal(matchSourceIngredientToFnri('daikon radish', aliasFoods, aliases)?.method, 'VERIFIED_ALIAS');
  assert.equal(matchSourceIngredientToFnri('fresh malunggay leaves', aliasFoods, aliases), null);
  assert.equal(matchSourceIngredientToFnri('malunggay leaves', aliasFoods, aliases)?.food.id, 'malunggay-leaves');
  assert.equal(matchSourceIngredientToFnri('olive oil', aliasFoods, aliases), null);
  assert.equal(
    matchSourceIngredientToFnri('daikon radish', aliasFoods, [
      ...aliases,
      { alias: 'daikon radish', foodItemId: 'radish-boiled', verifiedAt },
    ]),
    null
  );
});

test('scraper fragments are invalid ingredients rather than foods', () => {
  assert.equal(isInvalidSourceIngredientLabel('(beaten)'), true);
  assert.equal(isInvalidSourceIngredientLabel('Cooking Procedure'), true);
});
