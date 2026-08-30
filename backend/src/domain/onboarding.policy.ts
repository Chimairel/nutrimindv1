export const CURRENT_TERMS_VERSION = '2026-08-27';
export const CURRENT_PRIVACY_VERSION = '2026-08-27';

export const ONBOARDING_PATHS = [
  '/onboarding/stats',
  '/onboarding/preferences',
  '/onboarding/conditions',
  '/onboarding/allergies',
  '/onboarding/shopping-day',
  '/onboarding/tos',
] as const;

export type OnboardingPath = (typeof ONBOARDING_PATHS)[number];

export interface OnboardingSnapshot {
  onboardingDone: boolean;
  tosAccepted: boolean;
  acceptedTermsVersion?: string | null;
  acceptedPrivacyVersion?: string | null;
  profile?: {
    age?: number | null;
    biologicalSex?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    targetWeightKg?: number | null;
    goal?: string | null;
    activityLevel?: string | null;
    dietaryPreference?: string | null;
    carbPreference?: string | null;
    foodCulture?: string | null;
    shoppingDayGroup?: string | null;
    shoppingDayOfWeek?: number | null;
  } | null;
  conditions: readonly string[];
  allergies: readonly string[];
}

export interface OnboardingStatus {
  nextPath: OnboardingPath | '/nutrition-report';
  readyToComplete: boolean;
  missingFields: string[];
  currentTermsVersion: string;
  currentPrivacyVersion: string;
  acceptedCurrentConsent: boolean;
}

export function hasCurrentConsent(snapshot: Pick<OnboardingSnapshot,
  'onboardingDone' | 'tosAccepted' | 'acceptedTermsVersion' | 'acceptedPrivacyVersion'
>): boolean {
  if (!snapshot.tosAccepted) return false;

  const acceptedCurrentVersions =
    snapshot.acceptedTermsVersion === CURRENT_TERMS_VERSION &&
    snapshot.acceptedPrivacyVersion === CURRENT_PRIVACY_VERSION;

  // Existing onboarded accounts predate consent version storage. Preserve their
  // access while requiring every new completion to accept the current versions.
  const isGrandfatheredLegacyAccount =
    snapshot.onboardingDone &&
    !snapshot.acceptedTermsVersion &&
    !snapshot.acceptedPrivacyVersion;

  return acceptedCurrentVersions || isGrandfatheredLegacyAccount;
}

export function evaluateOnboardingStatus(snapshot: OnboardingSnapshot): OnboardingStatus {
  const profile = snapshot.profile;
  const missingFields: string[] = [];

  const statsComplete = Boolean(
    profile?.age &&
    profile.biologicalSex &&
    profile.heightCm &&
    profile.weightKg &&
    profile.targetWeightKg &&
    profile.goal &&
    profile.activityLevel
  );
  if (!statsComplete) {
    missingFields.push('age', 'biologicalSex', 'heightCm', 'weightKg', 'targetWeightKg', 'goal', 'activityLevel');
  }

  const preferencesComplete = Boolean(
    profile?.dietaryPreference && profile.carbPreference && profile.foodCulture?.trim()
  );
  if (!preferencesComplete) {
    missingFields.push('dietaryPreference', 'carbPreference', 'foodCulture');
  }

  const conditionsComplete = snapshot.conditions.length > 0;
  if (!conditionsComplete) missingFields.push('healthConditions');

  const allergiesComplete = snapshot.allergies.length > 0;
  if (!allergiesComplete) missingFields.push('allergies');

  const shoppingDayComplete =
    (typeof profile?.shoppingDayOfWeek === 'number' && profile.shoppingDayOfWeek >= 0 && profile.shoppingDayOfWeek <= 6) ||
    Boolean(profile?.shoppingDayGroup);
  if (!shoppingDayComplete) missingFields.push('shoppingDayOfWeek');

  const acceptedCurrentConsent = hasCurrentConsent(snapshot);
  if (!acceptedCurrentConsent) missingFields.push('currentConsent');

  let nextPath: OnboardingStatus['nextPath'] = snapshot.onboardingDone
    ? '/nutrition-report'
    : '/onboarding/tos';
  if (!statsComplete) nextPath = '/onboarding/stats';
  else if (!preferencesComplete) nextPath = '/onboarding/preferences';
  else if (!conditionsComplete) nextPath = '/onboarding/conditions';
  else if (!allergiesComplete) nextPath = '/onboarding/allergies';
  else if (!shoppingDayComplete) nextPath = '/onboarding/shopping-day';
  else if (!acceptedCurrentConsent) nextPath = '/onboarding/tos';

  return {
    nextPath,
    readyToComplete: missingFields.length === 0,
    missingFields: [...new Set(missingFields)],
    currentTermsVersion: CURRENT_TERMS_VERSION,
    currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedCurrentConsent,
  };
}
