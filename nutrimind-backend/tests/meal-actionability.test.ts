import assert from 'node:assert/strict';
import test from 'node:test';
import { MealLibraryStatus, MealPlanStatus } from '@prisma/client';
import {
  MealPlanNotActionableError,
  assertUserActionableMealPlan,
  filterUserActionableMealPlans,
  getApprovedMealPlanStatusWhere,
  getApprovedMealLibraryWhere,
  getNutritionEligibleMealLogWhere,
  getNutritionistReviewableMealPlanWhere,
  getOwnedMealPlanWhere,
  getStartOfManilaBusinessDay,
  getUserActionableMealPlanWhere,
  isApprovedMealLibraryStatus,
  isMealPlanHistoryVisible,
  isMealPlanScheduleCurrent,
  isNutritionEligibleMealLog,
  isNutritionistReviewableMealPlanStatus,
  isUserActionableMealPlan,
  isUserActionableMealPlanStatus,
} from '../src/domain/meal-actionability.policy';

const now = new Date('2026-08-19T16:30:00.000Z'); // 2026-08-20 in Asia/Manila
const currentSchedule = new Date('2026-08-19T16:00:00.000Z');
const futureSchedule = new Date('2026-08-20T16:00:00.000Z');
const expiredSchedule = new Date('2026-08-18T16:00:00.000Z');

function plan(status: unknown, scheduledDate: Date = currentSchedule) {
  return { status, scheduledDate };
}

test('[TEST-013] only the actual APPROVED meal-plan status is user-actionable', () => {
  assert.equal(isUserActionableMealPlanStatus(MealPlanStatus.APPROVED), true);
  assert.equal(isUserActionableMealPlanStatus(MealPlanStatus.PENDING_REVIEW), false);
  assert.equal(isUserActionableMealPlanStatus(MealPlanStatus.REJECTED), false);
  assert.equal(isUserActionableMealPlanStatus(MealPlanStatus.CANCELLED), false);
});

test('[TEST-013] unknown, null, and unsupported statuses default to non-actionable', () => {
  assert.equal(isUserActionableMealPlanStatus('FUTURE_STATUS'), false);
  assert.equal(isUserActionableMealPlanStatus(null), false);
  assert.equal(isUserActionableMealPlanStatus(undefined), false);
});

test('[TEST-013] APPROVED meals remain actionable on current and future Manila business dates', () => {
  assert.equal(isUserActionableMealPlan(plan(MealPlanStatus.APPROVED), now), true);
  assert.equal(
    isUserActionableMealPlan(plan(MealPlanStatus.APPROVED, futureSchedule), now),
    true
  );
});

test('[TEST-014] expired schedules are non-actionable at the Asia/Manila boundary', () => {
  assert.equal(isMealPlanScheduleCurrent(expiredSchedule, now), false);
  assert.equal(isMealPlanScheduleCurrent(currentSchedule, now), true);
  assert.equal(isMealPlanScheduleCurrent(futureSchedule, now), true);
  assert.equal(isMealPlanScheduleCurrent('invalid-date', now), false);
});

test('[TEST-014] current-plan filtering excludes pending, rejected, cancelled, and expired rows', () => {
  const rows = [
    { id: 'approved', ...plan(MealPlanStatus.APPROVED) },
    { id: 'pending', ...plan(MealPlanStatus.PENDING_REVIEW) },
    { id: 'rejected', ...plan(MealPlanStatus.REJECTED) },
    { id: 'cancelled', ...plan(MealPlanStatus.CANCELLED) },
    { id: 'expired', ...plan(MealPlanStatus.APPROVED, expiredSchedule) },
  ];

  assert.deepEqual(
    filterUserActionableMealPlans(rows, now).map((row) => row.id),
    ['approved']
  );
});

test('[TEST-014] a rejected original cannot reappear beside its approved replacement', () => {
  const sameSlot = [
    { id: 'rejected-original', ...plan(MealPlanStatus.REJECTED) },
    { id: 'approved-replacement', ...plan(MealPlanStatus.APPROVED) },
  ];

  assert.deepEqual(
    filterUserActionableMealPlans(sameSlot, now).map((row) => row.id),
    ['approved-replacement']
  );
});

test('[TEST-013] planned logging accepts an approved current plan and rejects other states', () => {
  assert.doesNotThrow(() => assertUserActionableMealPlan(plan(MealPlanStatus.APPROVED), now));

  for (const candidate of [
    plan(MealPlanStatus.PENDING_REVIEW),
    plan(MealPlanStatus.REJECTED),
    plan(MealPlanStatus.CANCELLED),
    plan(MealPlanStatus.APPROVED, expiredSchedule),
  ]) {
    assert.throws(
      () => assertUserActionableMealPlan(candidate, now),
      MealPlanNotActionableError
    );
  }
});

test('[TEST-013] done and skipped mutations share the same actionability guard', () => {
  assert.throws(
    () => assertUserActionableMealPlan(plan(MealPlanStatus.PENDING_REVIEW), now),
    /not currently actionable/
  );
});

test('[TEST-013] swap originals share the same actionability guard', () => {
  assert.throws(
    () => assertUserActionableMealPlan(plan(MealPlanStatus.REJECTED), now),
    MealPlanNotActionableError
  );
});

test('[TEST-014] current-plan and grocery database filters require approval and a current schedule', () => {
  const expectedStart = new Date('2026-08-19T16:00:00.000Z');
  assert.deepEqual(getUserActionableMealPlanWhere(now), {
    status: MealPlanStatus.APPROVED,
    scheduledDate: { gte: expectedStart },
  });
  assert.deepEqual(getStartOfManilaBusinessDay(now), expectedStart);
  assert.deepEqual(getApprovedMealPlanStatusWhere(), {
    status: MealPlanStatus.APPROVED,
  });
});

test('[TEST-013] owner-scoped lookup preserves cross-user not-found behavior', () => {
  assert.deepEqual(getOwnedMealPlanWhere('fixture-user-001', 'fixture-plan-001'), {
    id: 'fixture-plan-001',
    userId: 'fixture-user-001',
  });
});

test('[TEST-014] nutrition totals include outside logs and approved-plan logs only', () => {
  assert.equal(isNutritionEligibleMealLog({ mealPlan: null }), true);
  assert.equal(
    isNutritionEligibleMealLog({ mealPlan: { status: MealPlanStatus.APPROVED } }),
    true
  );
  assert.equal(
    isNutritionEligibleMealLog({ mealPlan: { status: MealPlanStatus.PENDING_REVIEW } }),
    false
  );
  assert.equal(
    isNutritionEligibleMealLog({ mealPlan: { status: MealPlanStatus.REJECTED } }),
    false
  );
  assert.deepEqual(getNutritionEligibleMealLogWhere(), {
    OR: [
      { mealPlanId: null },
      { mealPlan: { status: MealPlanStatus.APPROVED } },
    ],
  });
});

test('[TEST-013] only APPROVED library meals are replacement candidates', () => {
  assert.equal(isApprovedMealLibraryStatus(MealLibraryStatus.APPROVED), true);
  assert.equal(isApprovedMealLibraryStatus(MealLibraryStatus.FLAGGED), false);
  assert.equal(isApprovedMealLibraryStatus('FUTURE_STATUS'), false);
  assert.deepEqual(getApprovedMealLibraryWhere(), {
    status: MealLibraryStatus.APPROVED,
  });
});

test('[TEST-014] nutritionist review policy still includes pending-review meals', () => {
  assert.equal(
    isNutritionistReviewableMealPlanStatus(MealPlanStatus.PENDING_REVIEW),
    true
  );
  assert.equal(isNutritionistReviewableMealPlanStatus(MealPlanStatus.APPROVED), false);
  assert.equal(isNutritionistReviewableMealPlanStatus(MealPlanStatus.REJECTED), false);
  assert.equal(isNutritionistReviewableMealPlanStatus(MealPlanStatus.CANCELLED), false);
  assert.deepEqual(getNutritionistReviewableMealPlanWhere(), {
    status: MealPlanStatus.PENDING_REVIEW,
  });
});

test('[TEST-014] known meal-plan states remain history-visible without becoming actionable', () => {
  for (const status of Object.values(MealPlanStatus)) {
    assert.equal(isMealPlanHistoryVisible(status), true);
  }
  assert.equal(isMealPlanHistoryVisible('FUTURE_STATUS'), false);
});
