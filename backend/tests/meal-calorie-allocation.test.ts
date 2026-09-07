import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMealSlotCalorieRange,
  getMealSlotCalorieTarget,
  isMealWithinSlotCalorieRange,
  rankCalorieCompatibleMeals,
} from '../src/domain/meal-calorie-allocation.policy';

test('[TEST-162] primary meal allocation covers the full daily calorie target', () => {
  const dailyTarget = 2780;
  const breakfast = getMealSlotCalorieTarget(dailyTarget, 'BREAKFAST');
  const lunch = getMealSlotCalorieTarget(dailyTarget, 'LUNCH');
  const dinner = getMealSlotCalorieTarget(dailyTarget, 'DINNER');

  assert.equal(breakfast, 834);
  assert.equal(lunch, 1112);
  assert.equal(dinner, 834);
  assert.equal(breakfast + lunch + dinner, dailyTarget);
});

test('[TEST-162] severely under-target library portions are not generation matches', () => {
  assert.equal(isMealWithinSlotCalorieRange({ calories: 234, dailyCalorieTarget: 2780, mealType: 'BREAKFAST' }), false);
  assert.equal(isMealWithinSlotCalorieRange({ calories: 442, dailyCalorieTarget: 2780, mealType: 'LUNCH' }), false);
  assert.equal(isMealWithinSlotCalorieRange({ calories: 447, dailyCalorieTarget: 2780, mealType: 'DINNER' }), false);
});

test('[TEST-162] meals inside the documented fifteen-percent slot band remain eligible', () => {
  const range = getMealSlotCalorieRange(2000, 'LUNCH');

  assert.deepEqual(range, { minimum: 680, target: 800, maximum: 920 });
  assert.equal(isMealWithinSlotCalorieRange({ calories: 680, dailyCalorieTarget: 2000, mealType: 'LUNCH' }), true);
  assert.equal(isMealWithinSlotCalorieRange({ calories: 920, dailyCalorieTarget: 2000, mealType: 'LUNCH' }), true);
  assert.equal(isMealWithinSlotCalorieRange({ calories: 679, dailyCalorieTarget: 2000, mealType: 'LUNCH' }), false);
  assert.equal(isMealWithinSlotCalorieRange({ calories: 921, dailyCalorieTarget: 2000, mealType: 'LUNCH' }), false);
});

test('[TEST-162] invalid calories and unsupported snack allocation fail closed', () => {
  for (const calories of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isMealWithinSlotCalorieRange({ calories, dailyCalorieTarget: 2000, mealType: 'DINNER' }), false);
  }
  assert.equal(isMealWithinSlotCalorieRange({ calories: 200, dailyCalorieTarget: 2000, mealType: 'SNACK' }), false);
});

test('[TEST-163] library candidates are filtered and ranked by calorie fit without mutating input', () => {
  const candidates = [
    { id: 'under-target', calories: 442, usageCount: 0 },
    { id: 'farther-fit', calories: 975, usageCount: 0 },
    { id: 'closest-used', calories: 1090, usageCount: 4 },
    { id: 'closest-fresh', calories: 1090, usageCount: 1 },
  ];
  const before = structuredClone(candidates);

  assert.deepEqual(
    rankCalorieCompatibleMeals(candidates, 2780, 'LUNCH').map((meal) => meal.id),
    ['closest-fresh', 'closest-used', 'farther-fit']
  );
  assert.deepEqual(candidates, before);
});
