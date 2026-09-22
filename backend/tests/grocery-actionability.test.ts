import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MealPlanCycleDeadlineOutcome,
  MealPlanCycleStatus,
  ProfileCycleAdaptationState,
} from '@prisma/client';
import { deriveGroceryActionability } from '../src/domain/grocery-actionability.policy';

const base = {
  profileAdaptationState: ProfileCycleAdaptationState.CURRENT,
  deadlineOutcome: null,
  incompleteAcknowledgedAt: null,
  shoppingStartedAt: null,
  listIsStale: false,
};

test('[BATCH-5] preparing and under-review groceries remain preview-only', () => {
  for (const status of [MealPlanCycleStatus.PREPARING, MealPlanCycleStatus.UNDER_REVIEW]) {
    const result = deriveGroceryActionability({ ...base, status });
    assert.equal(result.canCheckItems, false);
    assert.equal(result.canExportPdf, false);
    assert.equal(result.quantitiesMayIncrease, true);
  }
});

test('[BATCH-5] complete ready and shopping-started cycles are final and actionable', () => {
  for (const status of [MealPlanCycleStatus.READY_TO_SHOP, MealPlanCycleStatus.SHOPPING_STARTED]) {
    const result = deriveGroceryActionability({ ...base, status });
    assert.equal(result.canCheckItems, true);
    assert.equal(result.canExportPdf, true);
    assert.equal(result.isFinal, true);
  }
});

test('[BATCH-5] incomplete lists require acknowledgment and export as incomplete afterward', () => {
  const incomplete = {
    ...base,
    status: MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE,
    deadlineOutcome: MealPlanCycleDeadlineOutcome.INCOMPLETE,
  };
  const before = deriveGroceryActionability(incomplete);
  assert.equal(before.requiresIncompleteAcknowledgment, true);
  assert.equal(before.canCheckItems, false);

  const after = deriveGroceryActionability({ ...incomplete, incompleteAcknowledgedAt: new Date() });
  assert.equal(after.canCheckItems, true);
  assert.equal(after.canExportPdf, true);
  assert.equal(after.isIncomplete, true);
  assert.equal(after.quantitiesMayIncrease, false);
});

test('[BATCH-5] stale or revalidation-required projections fail closed', () => {
  const stale = deriveGroceryActionability({
    ...base,
    status: MealPlanCycleStatus.READY_TO_SHOP,
    listIsStale: true,
  });
  assert.equal(stale.canCheckItems, false);
  assert.equal(stale.canExportPdf, false);

  const revalidation = deriveGroceryActionability({
    ...base,
    status: MealPlanCycleStatus.REVALIDATION_REQUIRED,
  });
  assert.equal(revalidation.canCheckItems, false);
  assert.equal(revalidation.canExportPdf, false);
});
