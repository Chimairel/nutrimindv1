'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import Checkbox from '@/components/ui/Checkbox';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Pencil } from 'lucide-react';
import axios from 'axios';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExclusiveNone, normalizeFoodCulture } from '@/lib/profile-normalization';

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
  const selections = normalizeExclusiveNone(values).filter((value) => value !== 'NONE').map(formatOnboardingValue);
  if (custom) selections.push(custom);
  return selections.length > 0 ? selections.join(', ') : 'None declared';
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
  const reviewSections = [
    {
      title: 'Body & goal',
      editPath: '/onboarding/stats',
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
      editPath: '/onboarding/preferences',
      items: [
        ['Diet', formatOnboardingValue(userProfile?.dietaryPreference)],
        ['Carbohydrate preference', formatOnboardingValue(userProfile?.carbPreference)],
        ['Food culture', normalizeFoodCulture(userProfile?.foodCulture)],
      ],
    },
    {
      title: 'Health context',
      editPath: '/onboarding/conditions',
      items: [
        ['Conditions', joinSelections(profile?.healthConditions ?? [], userProfile?.otherConditions)],
        ['Allergies', joinSelections(profile?.allergies ?? [], userProfile?.otherAllergies)],
      ],
    },
    {
      title: 'Plan schedule',
      editPath: '/onboarding/shopping-day',
      items: [[
        'Weekly cycle',
        formatPlanSchedule(userProfile?.shoppingDayOfWeek, userProfile?.shoppingDayGroup),
      ]],
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
      await api.post('/user/onboarding/complete');

      // 3. Refresh Auth session context to pull new onboardingDone & tosAccepted parameters
      await refreshSession();

      // 4. Redirect to the newly generated Nutrition Report screen
      router.push('/nutrition-report');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'An error occurred while finalizing onboarding. Please try again.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 6 of 6</span>
            <span className="text-brand-green">100% Completed</span>
          </div>
          <Progress value={100} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <section aria-labelledby="onboarding-review-heading" className="mb-8">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-green/25 bg-brand-green/10 text-brand-green">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 id="onboarding-review-heading" className="font-display text-xl font-extrabold tracking-tight text-brand-text">
                  Review your onboarding details
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                  Confirm the information used for your calorie target, safety checks, nutrition report, and meal-plan recommendations before giving consent.
                </p>
              </div>
            </div>

            {isHydrating ? (
              <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/40 px-4 py-6 text-center text-xs text-brand-muted" role="status">
                Loading your saved onboarding details…
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {reviewSections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/45 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-text">{section.title}</h2>
                      <button
                        type="button"
                        onClick={() => router.push(section.editPath)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-brand-green transition-colors hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                        aria-label={`Edit ${section.title.toLowerCase()}`}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                    <dl className="space-y-2">
                      {section.items.map(([label, value]) => (
                        <div key={label} className="flex items-start justify-between gap-4 border-t border-brand-border/35 pt-2 first:border-0 first:pt-0">
                          <dt className="text-[11px] text-brand-muted">{label}</dt>
                          <dd className="max-w-[62%] text-right text-[11px] font-semibold leading-relaxed text-brand-text">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              LEGAL TERMS & PROTECTION
            </h2>
            <p className="text-xs text-brand-muted">
              Please review our clinical guidelines, medical disclaimers, and data protection terms.
            </p>
          </div>

          {/* Terms Scrollbox */}
          <div className="w-full h-48 overflow-y-auto bg-brand-bgAlt border border-brand-border rounded-xl p-4 text-xs text-brand-muted leading-relaxed mb-6">
            <h4 className="font-bold text-brand-text mb-2">1. AI NUTRITION-PLANNING LIMITATIONS</h4>
            <p className="mb-4">
              NutriMind uses software calculations, FNRI food data, and Google Gemini-generated content to prepare nutrition reports and meal suggestions. These outputs are estimates awaiting the review states shown in the application. They are not a diagnosis, prescription, or replacement for a physician or Registered Nutritionist-Dietitian.
            </p>
            <h4 className="font-bold text-brand-text mb-2">2. HEALTH DATA PRIVACY & COMPLIANCE</h4>
            <p className="mb-4">
              NutriMind stores the profile and health information you provide to calculate targets, apply safety restrictions, generate reports and meal plans, and support nutritionist review. Selected profile and health details are transmitted to Google Gemini when AI generation is required. NutriMind does not sell this information. Read this notice before consenting to processing under the <strong>Philippine Data Privacy Act of 2012 (R.A. 10173)</strong>.
            </p>
            <h4 className="font-bold text-brand-text mb-2">3. MEDICAL CONSULTATION DISCLAIMER</h4>
            <p>
              If you suffer from chronic conditions (such as severe renal failure, heart diseases, or high-risk pregnancies), you must consult a licensed Registered Nutritionist-Dietitian (RND) or Physician (MD) before implementing our generated layouts. You acknowledge that you use our recommendations entirely at your own risk.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Back button */}
            <button
              type="button"
              onClick={() => router.push('/onboarding/shopping-day')}
              className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors w-fit"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Back to Step 5</span>
            </button>

            <Checkbox
              id="medicalDisclaimer"
              checked={medicalDisclaimer}
              onCheckedChange={(checked) => setMedicalDisclaimer(!!checked)}
              label="I understand that AI-generated meal plans are NOT medical advice and should not replace consultation with a physician or RND."
              error={error !== null && !medicalDisclaimer}
            />

            <Checkbox
              id="healthDataProcessing"
              checked={healthDataProcessing}
              onCheckedChange={(checked) => setHealthDataProcessing(!!checked)}
              label="I explicitly consent to NutriMind processing my health profile and sending the necessary profile details to Google Gemini when AI-generated reports or meals are required."
              error={error !== null && !healthDataProcessing}
            />

            <p className="rounded-xl border border-brand-border/50 bg-brand-bgAlt/40 px-4 py-3 text-[11px] leading-relaxed text-brand-muted">
              Consent versions: Terms {profile?.onboardingStatus?.currentTermsVersion || 'loading'} · Privacy {profile?.onboardingStatus?.currentPrivacyVersion || 'loading'}
            </p>

            <Checkbox
              id="privacyPolicy"
              checked={privacyPolicy}
              onCheckedChange={(checked) => setPrivacyPolicy(!!checked)}
              label="I agree to the Terms of Service, Privacy Policy, and authorize processing of my health data in compliance with R.A. 10173."
              error={error !== null && !privacyPolicy}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-4 mt-4 text-sm font-bold tracking-wide"
              disabled={!medicalDisclaimer || !privacyPolicy || !healthDataProcessing || isHydrating}
              isLoading={isLoading}
            >
              Complete Onboarding & Generate Report
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
