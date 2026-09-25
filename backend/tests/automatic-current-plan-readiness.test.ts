import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { isReadyForAutomaticCurrentPlan } from '../src/services/current-plan-preparation.service';

const readyAccount = {
  role: 'USER' as const,
  isSuspended: false,
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
  acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
  userProfile: { revision: 3, shoppingDayOfWeek: 6, shoppingDayGroup: 'WEEKEND' as const },
  nutritionReport: { acknowledgedAt: new Date(), isStale: false, profileRevision: 3 },
} as Parameters<typeof isReadyForAutomaticCurrentPlan>[0];

test('automatic current-plan preparation requires an acknowledged, current report and current consent', () => {
  assert.equal(isReadyForAutomaticCurrentPlan(readyAccount), true);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, nutritionReport: null }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, nutritionReport: { ...readyAccount!.nutritionReport!, acknowledgedAt: null } }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, nutritionReport: { ...readyAccount!.nutritionReport!, isStale: true } }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, userProfile: { ...readyAccount!.userProfile!, revision: 4 } }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, acceptedTermsVersion: 'old' }), false);
});

test('automatic current-plan preparation excludes unverified, unfinished, suspended, and non-user accounts', () => {
  assert.equal(isReadyForAutomaticCurrentPlan(null), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, emailVerified: false }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, onboardingDone: false }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, isSuspended: true }), false);
  assert.equal(isReadyForAutomaticCurrentPlan({ ...readyAccount!, role: 'NUTRITIONIST' }), false);
});
