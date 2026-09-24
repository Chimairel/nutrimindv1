import assert from 'node:assert/strict';
import test from 'node:test';
import { DietaryPreference, MealType } from '@prisma/client';
import { selectRawRecipeCandidates, sourceRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';

function candidate(
  id: string,
  name: string,
  ingredient: string,
  signature = id
): RecipeCandidateProjection & {
  _ranking: { score: number; reasonCodes: [] };
} {
  return {
    id,
    providerRecordId: id,
    provenance: 'PANLASANG_PINOY',
    displayName: name,
    normalizedName: name.toLowerCase(),
    category: null,
    description: null,
    contentSignature: signature,
    sourceUrl: 'https://example.invalid/recipe',
    applicableMealTypes: [MealType.LUNCH],
    dietaryTags: [DietaryPreference.OMNIVORE],
    ingredients: [{ name: ingredient, quantity: 100, unit: 'g' }],
    ingredientsComplete: true,
    nutrition: { calories: 600, proteinG: 30, carbsG: 40, fatG: 20 },
    servingDescription: null,
    riceRole: null,
    imageUrl: null,
    videoUrl: null,
    state: 'ACTIVE',
    _ranking: { score: 50, reasonCodes: [] },
  };
}

test('raw selection skips definite allergen conflicts and exact duplicate signatures', () => {
  const slot = (dayNumber: number) => ({
    dayNumber,
    mealType: MealType.LUNCH,
    scheduledDate: new Date('2031-01-01T00:00:00Z'),
  });
  const selected = selectRawRecipeCandidates({
    slots: [slot(1), slot(2), slot(3)],
    candidatesByType: new Map([
      [
        MealType.LUNCH,
        [
          candidate('a', 'Shrimp dish', 'shrimp'),
          candidate('b', 'Chicken dish', 'chicken', 'same-chicken'),
          candidate('c', 'Chicken copy', 'chicken', 'same-chicken'),
          candidate('d', 'Pork dish', 'pork'),
        ],
      ],
    ]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: ['SHELLFISH'],
  });
  assert.deepEqual(
    selected.meals.map((meal) => meal.rawCandidateId),
    ['b', 'd']
  );
  assert.deepEqual(
    selected.remainingSlots.map((remaining) => remaining.dayNumber),
    [3]
  );
  assert.equal(selected.meals[0].candidateRank, 2);
});

test('raw selection does not treat a dietary tag or blank ingredient list as sufficient', () => {
  const invalid = candidate('a', 'Unspecified', 'chicken');
  invalid.ingredients = [];
  const wrongDiet = candidate('b', 'Tagged otherwise', 'chicken');
  wrongDiet.dietaryTags = [DietaryPreference.VEGAN];
  const selected = selectRawRecipeCandidates({
    slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
    candidatesByType: new Map([[MealType.LUNCH, [invalid, wrongDiet]]]),
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergens: [],
  });
  assert.equal(selected.meals.length, 0);
  assert.equal(selected.remainingSlots.length, 1);
});

test('raw sourcing checks the next corpus page before leaving a slot for Gemini', async () => {
  const originalList = databaseRecipeCandidateProvider.list;
  const requestedCursors: Array<string | undefined> = [];
  databaseRecipeCandidateProvider.list = async (input) => {
    if (input.sourceKind === 'USER_OBSERVED') return { items: [], nextCursor: null };
    requestedCursors.push(input.cursor);
    return input.cursor
      ? { items: [candidate('safe', 'Chicken dish', 'chicken')], nextCursor: null }
      : { items: [candidate('blocked', 'Shrimp dish', 'shrimp')], nextCursor: 'next-page' };
  };
  try {
    const result = await sourceRawRecipeCandidates({
      slots: [{ dayNumber: 1, mealType: MealType.LUNCH, scheduledDate: new Date() }],
      dailyCalorieTarget: 2000,
      dietaryPreference: DietaryPreference.OMNIVORE,
      conditions: [],
      allergens: ['SHELLFISH'],
    });
    assert.deepEqual(requestedCursors, [undefined, 'next-page']);
    assert.deepEqual(
      result.meals.map((meal) => meal.rawCandidateId),
      ['safe']
    );
    assert.equal(result.remainingSlots.length, 0);
  } finally {
    databaseRecipeCandidateProvider.list = originalList;
  }
});
