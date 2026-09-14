import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveConsumptionScopeGroups,
  interleaveScopeRows,
  type MealLocalityPreference,
} from '../src/domain/planning-location.policy';
import { googleProfileImage } from '../src/domain/google-profile-image';

test('blends retrieve both adjacent scopes and preserve row provenance', async () => {
  for (const [preference, expected] of [
    ['NATIONAL_REGIONAL', ['NATIONAL', 'REGION']],
    ['REGIONAL_LOCAL', ['REGION', 'PROVINCE_HUC']],
  ] as Array<[MealLocalityPreference, string[]]>) {
    const groups = await resolveConsumptionScopeGroups(
      {
        mealLocalityPreference: preference,
        planningRegionName: 'Central Visayas',
        planningProvinceHucName: 'Cebu City',
      },
      async (scope) => [scope.level + '1', scope.level + '2']
    );
    assert.deepEqual(
      groups.map((group) => group.scope.level),
      expected
    );
    assert.deepEqual(
      interleaveScopeRows(groups).map((item) => item.row),
      [expected[0] + '1', expected[1] + '1', expected[0] + '2', expected[1] + '2']
    );
  }
});

test('local blend falls back to national evidence when regional and local records are absent', async () => {
  const groups = await resolveConsumptionScopeGroups(
    {
      mealLocalityPreference: 'REGIONAL_LOCAL',
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: 'Cebu City',
    },
    async (scope) => (scope.level === 'NATIONAL' ? ['national record'] : [])
  );
  assert.deepEqual(
    groups.map((group) => group.scope.level),
    ['NATIONAL']
  );
});

test('Google photo serialization does not expose tokens or custom avatar URLs', () => {
  assert.equal(googleProfileImage('oauth-token'), null);
  assert.equal(googleProfileImage('https://api.dicebear.com/custom.svg'), null);
  assert.equal(
    googleProfileImage('https://lh3.googleusercontent.com/photo'),
    'https://lh3.googleusercontent.com/photo'
  );
});
