import assert from 'node:assert/strict';
import test from 'node:test';
import { ActivityLevel, Goal } from '@prisma/client';
import { calculateDailyTarget } from '../src/lib/calculations';

type CalorieInput = Parameters<typeof calculateDailyTarget>[0];

const baseMaleInput = {
  age: 30,
  heightCm: 170,
  weightKg: 70,
  goal: Goal.MAINTAIN,
  activityLevel: ActivityLevel.SEDENTARY,
  biologicalSex: 'MALE',
} satisfies CalorieInput;

test('[TEST-010] calculates the documented male Mifflin-St Jeor baseline', () => {
  assert.deepEqual(calculateDailyTarget(baseMaleInput), {
    bmr: 1618,
    tdee: 1941,
    dailyCalorieTarget: 1941,
  });
});

test('[TEST-010] calculates the documented female Mifflin-St Jeor baseline', () => {
  const result = calculateDailyTarget({
    ...baseMaleInput,
    biologicalSex: 'FEMALE',
  });

  assert.deepEqual(result, {
    bmr: 1452,
    tdee: 1742,
    dailyCalorieTarget: 1742,
  });
});

const activityCases: Array<{
  level: ActivityLevel;
  expectedTdee: number;
}> = [
  { level: ActivityLevel.SEDENTARY, expectedTdee: 1941 },
  { level: ActivityLevel.LIGHTLY_ACTIVE, expectedTdee: 2224 },
  { level: ActivityLevel.ACTIVE, expectedTdee: 2507 },
  { level: ActivityLevel.VERY_ACTIVE, expectedTdee: 2790 },
];

for (const { level, expectedTdee } of activityCases) {
  test(`[TEST-011] applies the documented ${level} activity multiplier`, () => {
    const result = calculateDailyTarget({
      ...baseMaleInput,
      activityLevel: level,
    });

    assert.equal(result.tdee, expectedTdee);
    assert.equal(result.dailyCalorieTarget, expectedTdee);
  });
}

const goalCases: Array<{
  goal: Goal;
  expectedTarget: number;
}> = [
  { goal: Goal.LOSE_WEIGHT, expectedTarget: 2007 },
  { goal: Goal.GAIN_WEIGHT, expectedTarget: 3007 },
  { goal: Goal.MAINTAIN, expectedTarget: 2507 },
  { goal: Goal.BUILD_MUSCLE, expectedTarget: 2807 },
];

for (const { goal, expectedTarget } of goalCases) {
  test(`[TEST-012] applies the documented ${goal} goal adjustment`, () => {
    const result = calculateDailyTarget({
      ...baseMaleInput,
      activityLevel: ActivityLevel.ACTIVE,
      goal,
    });

    assert.equal(result.dailyCalorieTarget, expectedTarget);
  });
}

// The current 500 kcal floor is intentionally not asserted as correct here.
// Its permanent expected behavior requires the clinical decision represented by TEST-021.
