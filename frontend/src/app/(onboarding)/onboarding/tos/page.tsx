'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import Checkbox from '@/components/ui/Checkbox';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Pencil } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import type { UserProfileData } from '@/hooks/useProfile';
import { normalizeExclusiveNone, normalizeFoodCulture } from '@/lib/profile-normalization';
import type { SafetyProfileEntry } from '@/types';

function formatOnboardingValue(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not provided';
  if (typeof value === 'number') return String(value);
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function joinSelections(values: string[], custom?: string) {
  const selections = normalizeExclusiveNone(values)
    .filter((value) => value !== 'NONE')
    .map(formatOnboardingValue);
  if (custom) selections.push(custom);
  return selections.length > 0 ? selections.join(', ') : 'None declared';
}

function joinStructuredSelections(
  entries: readonly SafetyProfileEntry[] | undefined,
  domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT',
  legacy: string
) {
  if (!entries?.length) return legacy;
  const values = entries
    .filter((entry) => entry.domain === domain && entry.canonicalCode !== 'NONE')
    .map((entry) => entry.displayName);
  return values.length > 0 ? values.join(', ') : 'None declared';
}

const shoppingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatPlanSchedule(dayOfWeek?: number, legacyGroup?: string) {
  if (typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6) {
    const cycleStart = (dayOfWeek + 1) % 7;
    const cycleEnd = (cycleStart + 6) % 7;
    return `${shoppingDays[dayOfWeek]} shopping · ${shoppingDays[cycleStart]} to ${shoppingDays[cycleEnd]} plan`;
  }
  if (legacyGroup === 'WEEKEND') return 'Weekend shopping · Sunday to Saturday plan';
  if (legacyGroup === 'WEEKDAY') return 'Weekday shopping · Monday to Sunday plan';
  return 'Not provided';
}

function formatPlanningLocation(profile?: UserProfileData['userProfile']) {
  if (!profile || profile.planningGeographyLevel === 'NATIONAL' || !profile.planningGeographyLevel) {
    return 'Philippines — national evidence';
  }
  if (profile.planningGeographyLevel === 'PROVINCE_HUC' && profile.planningProvinceHucName) {
    return `${profile.planningProvinceHucName}, ${profile.planningRegionName}`;
  }
  return profile.planningRegionName || 'Philippines — national evidence';
}

function formatMealLocality(profile?: UserProfileData['userProfile']) {
  if (profile?.mealLocalityPreference === 'NATIONAL_REGIONAL') return `Philippines & ${profile.planningRegionName}`;
  if (profile?.mealLocalityPreference === 'REGIONAL_LOCAL')
    return `${profile.planningRegionName} & ${profile.planningProvinceHucName}`;
  if (profile?.mealLocalityPreference === 'LOCAL' && profile.planningProvinceHucName) {
    return profile.planningProvinceHucName;
  }
  if (profile?.mealLocalityPreference === 'REGIONAL' && profile.planningRegionName) {
    return profile.planningRegionName;
  }
  return 'Philippines';
}

export default function OnboardingTosPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { profile, isLoading: isHydrating } = useProfile();
  const [medicalDisclaimer, setMedicalDisclaimer] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [healthDataProcessing, setHealthDataProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const userProfile = profile?.userProfile;
  const legacyConditions = joinSelections(profile?.healthConditions ?? [], userProfile?.otherConditions);
  const legacyAllergies = joinSelections(profile?.allergies ?? [], userProfile?.otherAllergies);
  const reviewSections = [
    {
      title: 'Body & goal',
      editPath: '/onboarding/stats?from=review',
      items: [
        ['Age', userProfile?.age ? `${userProfile.age} years` : 'Not provided'],
        ['Biological sex', formatOnboardingValue(userProfile?.biologicalSex)],
        ['Height', userProfile?.heightCm ? `${userProfile.heightCm} cm` : 'Not provided'],
        ['Current weight', userProfile?.weightKg ? `${userProfile.weightKg} kg` : 'Not provided'],
        ['Target weight', userProfile?.targetWeightKg ? `${userProfile.targetWeightKg} kg` : 'Not provided'],
        ['Goal', formatOnboardingValue(userProfile?.goal)],
        ['Activity', formatOnboardingValue(userProfile?.activityLevel)],
      ],
    },
    {
      title: 'Food preferences',
      editPath: '/onboarding/preferences?from=review',
      items: [
        ['Diet', formatOnboardingValue(userProfile?.dietaryPreference)],
        ['Rice preference', formatOnboardingValue(userProfile?.ricePreference)],
        ['Food culture', normalizeFoodCulture(userProfile?.foodCulture)],
        ['Meal-planning location', formatPlanningLocation(userProfile)],
        ['Meal locality strength', formatMealLocality(userProfile)],
      ],
    },
    {
      title: 'Medical conditions',
      editPath: '/onboarding/conditions?from=review',
      items: [['Conditions', joinStructuredSelections(profile?.safetyEntries, 'CONDITION', legacyConditions)]],
    },
    {
      title: 'Food safety',
      editPath: '/onboarding/allergies?from=review',
      items: [
        ['Allergies', joinStructuredSelections(profile?.safetyEntries, 'ALLERGY', legacyAllergies)],
        ['Intolerances', joinStructuredSelections(profile?.safetyEntries, 'INTOLERANCE', 'None declared')],
        ['Avoided foods', joinStructuredSelections(profile?.safetyEntries, 'AVOIDED_INGREDIENT', 'None declared')],
      ],
    },
    {
      title: 'Plan schedule',
      editPath: '/onboarding/shopping-day?from=review',
      items: [['Weekly cycle', formatPlanSchedule(userProfile?.shoppingDayOfWeek, userProfile?.shoppingDayGroup)]],
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!medicalDisclaimer || !privacyPolicy || !healthDataProcessing) {
      setError('You must accept all terms to complete your onboarding.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Accept ToS
      const termsVersion = profile?.onboardingStatus?.currentTermsVersion;
      const privacyVersion = profile?.onboardingStatus?.currentPrivacyVersion;
      if (!termsVersion || !privacyVersion) {
        throw new Error('Unable to load the current consent versions. Please refresh and try again.');
      }
      await api.post('/user/onboarding/tos', {
        termsVersion,
        privacyVersion,
        medicalDisclaimerAccepted: true,
        privacyPolicyAccepted: true,
        healthDataProcessingAccepted: true,
      });

      // 2. Complete Onboarding (Backend calculates targets & updates profiles)
      const completion = await api.post('/user/onboarding/complete');

      // 3. Refresh Auth session context to pull new onboardingDone & tosAccepted parameters
      const refreshed = await refreshSession();

      // 4. The first real report must be generated, read, and acknowledged
      // before the backend permits meal planning or other protected actions.
      const nextPath = completion.data?.data?.nextPath;
      router.replace(
        nextPath === '/dashboard' && refreshed?.reportAcknowledged ? '/dashboard' : '/profile/nutrition-report?next=dashboard'
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'An error occurred while finalizing onboarding. Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-4">
        {/* Onboarding progress */}
        <OnboardingProgressSlider currentStep={6} totalSteps={6} />

        <Card className="p-5 sm:p-7 glass-panel shadow-2xl border-brand-border/80">
          <button
            type="button"
            onClick={() => router.push('/onboarding/shopping-day')}
            className="mb-4 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors w-fit"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            <span>Back to Step 5</span>
          </button>

          <section aria-labelledby="onboarding-review-heading" className="mb-5">
            <div className="mb-3 flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h1
                  id="onboarding-review-heading"
                  className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-brand-text"
                >
                  Review your onboarding details
                </h1>
                <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                  Confirm the information used for your calorie target, safety checks, nutrition report, and meal-plan
                  recommendations before giving consent.
                </p>
              </div>
            </div>

            {isHydrating ? (
              <div
                className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 px-4 py-4 text-center text-xs text-brand-muted"
                role="status"
              >
                Loading your saved onboarding details…
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {reviewSections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/45 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-text">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => router.push(section.editPath)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-brand-green transition-colors hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                        aria-label={`Edit ${section.title.toLowerCase()}`}
                      >
                        <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                    <dl className="space-y-1.5">
                      {section.items.map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-start justify-between gap-3 border-t border-brand-border/35 pt-1.5 first:border-0 first:pt-0"
                        >
                          <dt className="text-[10px] text-brand-muted">{label}</dt>
                          <dd className="max-w-[62%] text-right text-[10px] font-semibold leading-relaxed text-brand-text">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-0.5 mb-4">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display text-brand-green">
              LEGAL TERMS & PROTECTION
            </h2>
            <p className="text-xs text-brand-muted">
              Please review our clinical guidelines, medical disclaimers, and data protection terms below.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Checkbox
              id="medicalDisclaimer"
              checked={medicalDisclaimer}
              onCheckedChange={(checked) => setMedicalDisclaimer(!!checked)}
              label={
                <span className="text-xs text-brand-text leading-relaxed">
                  I understand that AI-generated meal plans are NOT medical advice. If managing chronic conditions, I
                  agree to follow our{' '}
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                  >
                    Clinical Guidelines & Disclaimers
                  </a>
                  .
                </span>
              }
              error={error !== null && !medicalDisclaimer}
            />

            <Checkbox
              id="healthDataProcessing"
              checked={healthDataProcessing}
              onCheckedChange={(checked) => setHealthDataProcessing(!!checked)}
              label={
                <span className="text-xs text-brand-text leading-relaxed">
                  I explicitly consent to KAINARA processing my health data and transmitting required meal parameters to
                  Google Gemini under the Philippine Data Privacy Act of 2012 (R.A. 10173). Learn more in our{' '}
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                  >
                    Data Protection Notice
                  </a>
                  .
                </span>
              }
              error={error !== null && !healthDataProcessing}
            />

            <div className="rounded-xl border border-brand-border/50 bg-brand-bgAlt/40 px-3 py-2 text-[10px] leading-relaxed text-brand-muted">
              Consent versions: Terms {profile?.onboardingStatus?.currentTermsVersion || 'loading'} · Privacy{' '}
              {profile?.onboardingStatus?.currentPrivacyVersion || 'loading'}
            </div>

            <Checkbox
              id="privacyPolicy"
              checked={privacyPolicy}
              onCheckedChange={(checked) => setPrivacyPolicy(!!checked)}
              label={
                <span className="text-xs text-brand-text leading-relaxed">
                  I agree to the{' '}
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover hover:decoration-brand-green"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              }
              error={error !== null && !privacyPolicy}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 mt-2 text-sm font-bold tracking-wide"
              disabled={!medicalDisclaimer || !privacyPolicy || !healthDataProcessing || isHydrating}
              isLoading={isLoading}
            >
              Complete Onboarding & Review Report
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
