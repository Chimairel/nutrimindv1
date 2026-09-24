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

test('scraper fragments are invalid ingredients rather than foods', () => {
  assert.equal(isInvalidSourceIngredientLabel('(beaten)'), true);
  assert.equal(isInvalidSourceIngredientLabel('Cooking Procedure'), true);
});
