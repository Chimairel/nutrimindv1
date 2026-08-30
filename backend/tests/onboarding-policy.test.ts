import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  evaluateOnboardingStatus,
  hasCurrentConsent,
  type OnboardingSnapshot,
} from '../src/domain/onboarding.policy';
import {
  canResendVerification,
  getVerificationFailureState,
} from '../src/domain/email-verification.policy';
import {
  consentSchema,
  onboardingAllergiesSchema,
  onboardingConditionsSchema,
  onboardingProfileSchema,
  shoppingDaySchema,
} from '../src/validation/onboarding.schemas';

const completeSnapshot: OnboardingSnapshot = {
  onboardingDone: false,
  tosAccepted: true,
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
  acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
  profile: {
    age: 25,
    biologicalSex: 'FEMALE',
    heightCm: 160,
    weightKg: 60,
    targetWeightKg: 55,
    goal: 'LOSE_WEIGHT',
    activityLevel: 'ACTIVE',
    dietaryPreference: 'OMNIVORE',
    carbPreference: 'MODERATE',
    foodCulture: 'Filipino',
    shoppingDayGroup: 'WEEKEND',
  },
  conditions: ['NONE'],
  allergies: ['NONE'],
};

test('onboarding status routes an incomplete profile to the first missing step', () => {
  const status = evaluateOnboardingStatus({
    ...completeSnapshot,
    profile: { ...completeSnapshot.profile, biologicalSex: null },
  });
  assert.equal(status.nextPath, '/onboarding/stats');
  assert.equal(status.readyToComplete, false);
  assert.ok(status.missingFields.includes('biologicalSex'));
});

test('onboarding status advances in canonical step order', () => {
  const status = evaluateOnboardingStatus({
    ...completeSnapshot,
    profile: { ...completeSnapshot.profile, shoppingDayGroup: null },
  });
  assert.equal(status.nextPath, '/onboarding/shopping-day');
});

test('complete current-version data is ready to finalize before report access', () => {
  const status = evaluateOnboardingStatus(completeSnapshot);
  assert.equal(status.readyToComplete, true);
  assert.equal(status.nextPath, '/onboarding/tos');
  assert.deepEqual(status.missingFields, []);

  const completed = evaluateOnboardingStatus({ ...completeSnapshot, onboardingDone: true });
  assert.equal(completed.nextPath, '/nutrition-report');
});

test('legacy consent is grandfathered only for already-onboarded accounts', () => {
  const legacy = {
    tosAccepted: true,
    acceptedTermsVersion: null,
    acceptedPrivacyVersion: null,
  };
  assert.equal(hasCurrentConsent({ ...legacy, onboardingDone: true }), true);
  assert.equal(hasCurrentConsent({ ...legacy, onboardingDone: false }), false);
});

test('profile schema rejects minors, unknown fields, and contradictory targets', () => {
  assert.equal(onboardingProfileSchema.safeParse({ age: 17 }).success, false);
  assert.equal(onboardingProfileSchema.safeParse({ age: 25, onboardingDone: true }).success, false);
  assert.equal(onboardingProfileSchema.safeParse({ weightKg: 60, targetWeightKg: 70, goal: 'LOSE_WEIGHT' }).success, false);
  assert.equal(onboardingProfileSchema.safeParse({ weightKg: 60, targetWeightKg: 60, goal: 'MAINTAIN' }).success, true);
});

test('condition and allergy schemas reject NONE contradictions', () => {
  assert.equal(onboardingConditionsSchema.safeParse({ conditions: ['NONE', 'DIABETES'] }).success, false);
  assert.equal(onboardingConditionsSchema.safeParse({ conditions: ['NONE'], otherConditions: 'asthma' }).success, false);
  assert.equal(onboardingAllergiesSchema.safeParse({ allergies: ['NONE', 'DAIRY'] }).success, false);
  assert.equal(onboardingAllergiesSchema.safeParse({ allergies: ['NONE'], otherAllergies: 'banana' }).success, false);
});

test('[TEST-051] shopping day requires one exact Sunday-through-Saturday index', () => {
  assert.equal(shoppingDaySchema.safeParse({ shoppingDayOfWeek: 0 }).success, true);
  assert.equal(shoppingDaySchema.safeParse({ shoppingDayOfWeek: 6 }).success, true);
  assert.equal(shoppingDaySchema.safeParse({ shoppingDayOfWeek: 7 }).success, false);
  assert.equal(shoppingDaySchema.safeParse({ shoppingDayGroup: 'WEEKEND' }).success, false);
});

test('consent schema requires the current versions and all explicit acknowledgements', () => {
  assert.equal(consentSchema.safeParse({
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    medicalDisclaimerAccepted: true,
    privacyPolicyAccepted: true,
    healthDataProcessingAccepted: true,
  }).success, true);
  assert.equal(consentSchema.safeParse({
    termsVersion: 'old',
    privacyVersion: CURRENT_PRIVACY_VERSION,
    medicalDisclaimerAccepted: true,
    privacyPolicyAccepted: true,
    healthDataProcessingAccepted: true,
  }).success, false);
});

test('email verification policy enforces resend cooldown and persistent lock threshold', () => {
  const now = new Date('2026-08-27T00:01:00.000Z');
  assert.equal(canResendVerification(new Date('2026-08-27T00:00:30.000Z'), now), false);
  assert.equal(canResendVerification(new Date('2026-08-26T23:59:00.000Z'), now), true);

  const beforeLock = getVerificationFailureState(3, now);
  assert.equal(beforeLock.failedAttempts, 4);
  assert.equal(beforeLock.lockedUntil, null);

  const locked = getVerificationFailureState(4, now);
  assert.equal(locked.failedAttempts, 5);
  assert.ok(locked.lockedUntil && locked.lockedUntil > now);
});
