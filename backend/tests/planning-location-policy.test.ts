import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConsumptionScopeChain,
  formatPlanningLocation,
  formatMealLocalityPreference,
  rankMealsByLocalizedFoodEvidence,
  resolveFirstAvailableConsumptionScope,
} from '../src/domain/planning-location.policy';
import { onboardingProfileSchema } from '../src/validation/onboarding.schemas';
import {
  calculateFoodGroupFamiliarityScore,
  classifyIngredientIntoEnnsFoodGroup,
  resolveEnnsPlanningGeography,
} from '../src/domain/enns-food-group.policy';

test('[TEST-196] planning location falls back from province/HUC to region and national evidence', () => {
  const scopes = buildConsumptionScopeChain({
    planningGeographyLevel: 'PROVINCE_HUC',
    planningRegionName: 'Central Visayas',
    planningProvinceHucName: 'Cebu City',
    mealLocalityPreference: 'LOCAL',
  });

  assert.deepEqual(
    scopes.map((scope) => scope.level),
    ['PROVINCE_HUC', 'REGION', 'NATIONAL']
  );
  assert.equal(scopes[0].label, 'Cebu City, Central Visayas');
  assert.equal(
    formatPlanningLocation({ planningGeographyLevel: 'REGION', planningRegionName: 'Bicol Region' }),
    'Bicol Region'
  );
  assert.equal(
    formatMealLocalityPreference({
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: 'Cebu City',
      mealLocalityPreference: 'REGIONAL',
    }),
    'Central Visayas'
  );
});

test('[TEST-200] meal-locality preference is independent from saved location', () => {
  const location = {
    planningGeographyLevel: 'PROVINCE_HUC' as const,
    planningRegionName: 'Central Visayas',
    planningProvinceHucName: 'Cebu City',
  };
  assert.deepEqual(
    buildConsumptionScopeChain({ ...location, mealLocalityPreference: 'NATIONAL' }).map((s) => s.level),
    ['NATIONAL']
  );
  assert.deepEqual(
    buildConsumptionScopeChain({ ...location, mealLocalityPreference: 'REGIONAL' }).map((s) => s.level),
    ['REGION', 'NATIONAL']
  );
  assert.deepEqual(
    buildConsumptionScopeChain({ ...location, mealLocalityPreference: 'LOCAL' }).map((s) => s.level),
    ['PROVINCE_HUC', 'REGION', 'NATIONAL']
  );
  assert.equal(
    formatPlanningLocation({ ...location, mealLocalityPreference: 'NATIONAL' }),
    'Cebu City, Central Visayas'
  );
});

test('[TEST-196] profile validation accepts only coherent coarse location shapes', () => {
  assert.equal(onboardingProfileSchema.safeParse({ planningGeographyLevel: 'NATIONAL' }).success, true);
  assert.equal(
    onboardingProfileSchema.safeParse({
      planningGeographyLevel: 'REGION',
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: null,
    }).success,
    true
  );
  assert.equal(
    onboardingProfileSchema.safeParse({
      planningGeographyLevel: 'PROVINCE_HUC',
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: 'Cebu City',
      mealLocalityPreference: 'LOCAL',
    }).success,
    true
  );
  assert.equal(onboardingProfileSchema.safeParse({ planningRegionName: 'Central Visayas' }).success, false);
  assert.equal(
    onboardingProfileSchema.safeParse({ planningGeographyLevel: 'REGION', planningRegionName: null }).success,
    false
  );
  assert.equal(
    onboardingProfileSchema.safeParse({
      planningGeographyLevel: 'NATIONAL',
      planningRegionName: 'Central Visayas',
    }).success,
    false
  );
});

test('[TEST-196] retrieval stops at the first populated fallback scope', async () => {
  const visited: string[] = [];
  const result = await resolveFirstAvailableConsumptionScope(
    {
      planningGeographyLevel: 'PROVINCE_HUC',
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: 'Cebu City',
      mealLocalityPreference: 'LOCAL',
    },
    async (scope) => {
      visited.push(scope.level);
      return scope.level === 'REGION' ? ['grounded-region-row'] : [];
    }
  );

  assert.deepEqual(visited, ['PROVINCE_HUC', 'REGION']);
  assert.equal(result.scope?.level, 'REGION');
  assert.deepEqual(result.rows, ['grounded-region-row']);
});

test('[TEST-196] retrieval returns empty evidence after exhausting every scope', async () => {
  const visited: string[] = [];
  const result = await resolveFirstAvailableConsumptionScope(
    { planningGeographyLevel: 'REGION', planningRegionName: 'Bicol Region', mealLocalityPreference: 'REGIONAL' },
    async (scope) => {
      visited.push(scope.level);
      return [];
    }
  );

  assert.deepEqual(visited, ['REGION', 'NATIONAL']);
  assert.equal(result.scope, null);
  assert.deepEqual(result.rows, []);
});

test('[TEST-196] local evidence ranks only already-eligible certified meals and preserves equal-score order', () => {
  const ranked = rankMealsByLocalizedFoodEvidence(
    [
      { id: 'closer-calorie-fit', ingredients: [{ foodItemId: 'national-only' }] },
      { id: 'localized-fit', ingredients: [{ foodItemId: 'local-1' }, { foodItemId: 'local-2' }] },
      { id: 'same-local-score-later', ingredients: [{ foodItemId: 'local-1' }] },
      { id: 'same-local-score-earlier', ingredients: [{ foodItemId: 'local-2' }] },
    ],
    new Set(['local-1', 'local-2'])
  );

  assert.deepEqual(
    ranked.map((meal) => meal.id),
    ['localized-fit', 'same-local-score-later', 'same-local-score-earlier', 'closer-calorie-fit']
  );
});

test('[TEST-201] ENNS food groups classify grounded and plain-text meal ingredients', () => {
  assert.equal(
    classifyIngredientIntoEnnsFoodGroup({ name: 'Bangus, cooked', category: 'Fish & Shellfish' }),
    'FISH_PRODUCTS'
  );
  assert.equal(classifyIngredientIntoEnnsFoodGroup({ name: 'Steamed white rice' }), 'RICE_PRODUCTS');
  assert.equal(classifyIngredientIntoEnnsFoodGroup({ name: 'Chicken breast' }), 'POULTRY');
  assert.equal(
    classifyIngredientIntoEnnsFoodGroup({ name: 'Pechay leaves', category: 'Vegetables' }),
    'GREEN_LEAFY_YELLOW_VEGETABLES'
  );
});

test('[TEST-201] historical ENNS geography resolves to current planning names without fabricating split-province data', () => {
  assert.deepEqual(resolveEnnsPlanningGeography('Lapu-Lapu City (Opon)', '7'), {
    provinceHucName: 'Lapu-Lapu',
    regionName: 'Central Visayas',
    isHistoricalProxy: false,
  });
  assert.deepEqual(resolveEnnsPlanningGeography('Negros Occidental', '6'), {
    provinceHucName: 'Negros Occidental',
    regionName: 'Negros Island Region',
    isHistoricalProxy: false,
  });
  assert.deepEqual(resolveEnnsPlanningGeography('Maguindanao', '15'), {
    provinceHucName: null,
    regionName: 'Bangsamoro Autonomous Region in Muslim Mindanao',
    isHistoricalProxy: true,
  });
});

test('[TEST-201] weighted locality signals prioritize a locally stronger food group', () => {
  const fishScore = calculateFoodGroupFamiliarityScore({
    rank: 2,
    percentConsuming: 68.3,
    relativeToNational: 1.3,
  });
  const meatScore = calculateFoodGroupFamiliarityScore({
    rank: 9,
    percentConsuming: 28,
    relativeToNational: 0.7,
  });
  const ranked = rankMealsByLocalizedFoodEvidence(
    [
      { id: 'meat', ingredients: [{ ingredientName: 'Beef strips' }] },
      { id: 'fish', ingredients: [{ ingredientName: 'Grilled tuna' }] },
    ],
    new Set(),
    new Map([
      ['MEAT_PRODUCTS', meatScore],
      ['FISH_PRODUCTS', fishScore],
    ])
  );
  assert.deepEqual(
    ranked.map(({ id }) => id),
    ['fish', 'meat']
  );
});
