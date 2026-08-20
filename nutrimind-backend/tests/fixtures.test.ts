import assert from 'node:assert/strict';
import test from 'node:test';
import {
  syntheticMealPlans,
  syntheticProfiles,
  syntheticUsers,
} from './fixtures/synthetic';

test('[FIXTURE-INTEGRITY] synthetic identities use reserved domains and fixture identifiers', () => {
  for (const user of Object.values(syntheticUsers)) {
    assert.match(user.id, /^fixture-/);
    assert.match(user.email, /@nutrimind\.invalid$/);
    assert.match(user.name, /^Fixture /);
  }
});

test('[FIXTURE-INTEGRITY] synthetic fixtures cover all application roles and restriction variants', () => {
  assert.deepEqual(
    new Set(Object.values(syntheticUsers).map((user) => user.role)),
    new Set(['USER', 'NUTRITIONIST', 'ADMIN'])
  );
  assert.deepEqual(Object.keys(syntheticProfiles).sort(), [
    'withCustomRestrictions',
    'withEnumRestrictions',
    'withoutRestrictions',
  ]);
});

test('[FIXTURE-INTEGRITY] synthetic meal fixtures cover approved, pending, rejected, cancelled, and expired states', () => {
  assert.equal(syntheticMealPlans.approved.status, 'APPROVED');
  assert.equal(syntheticMealPlans.pending.status, 'PENDING_REVIEW');
  assert.equal(syntheticMealPlans.rejected.status, 'REJECTED');
  assert.equal(syntheticMealPlans.cancelled.status, 'CANCELLED');
  assert.equal(syntheticMealPlans.expired.expired, true);
});
