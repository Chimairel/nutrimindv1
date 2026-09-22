import assert from 'node:assert/strict';
import test from 'node:test';
import { DietaryPreference } from '@prisma/client';
import { introducesHardDietRestriction } from '@/domain/profile-update-policy';
import { deriveMissedCheckinCycles } from '@/domain/checkin-cycle.policy';
import { resolvePlanTargetCalories } from '@/domain/plan-cycle-target.policy';

test('hard dietary exclusions trigger immediate safety handling while relaxations do not', () => {
  assert.equal(introducesHardDietRestriction(DietaryPreference.OMNIVORE, DietaryPreference.VEGAN), true);
  assert.equal(introducesHardDietRestriction(DietaryPreference.PESCATARIAN, DietaryPreference.VEGETARIAN), true);
  assert.equal(introducesHardDietRestriction(DietaryPreference.VEGAN, DietaryPreference.OMNIVORE), false);
});

test('unanswered expired check-in cycles are derived as missed', () => {
  const anchor = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(deriveMissedCheckinCycles(anchor, new Date('2026-09-08T00:00:00.000Z'), false), 0);
  assert.equal(deriveMissedCheckinCycles(anchor, new Date('2026-09-22T00:00:00.000Z'), false), 2);
});

test('an immutable cycle target wins over a later live-profile target', () => {
  assert.equal(resolvePlanTargetCalories(2000, 3000), 2000);
  assert.equal(resolvePlanTargetCalories(null, 3000), 3000);
});
