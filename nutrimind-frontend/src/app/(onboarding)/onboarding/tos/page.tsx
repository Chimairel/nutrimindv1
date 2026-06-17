'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import Checkbox from '@/components/ui/Checkbox';

import axios from 'axios';

export default function OnboardingTosPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [medicalDisclaimer, setMedicalDisclaimer] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!medicalDisclaimer || !privacyPolicy) {
      setError('You must accept all terms to complete your onboarding.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Accept ToS
      await api.post('/user/onboarding/tos');
      
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
            <h4 className="font-bold text-brand-text mb-2">1. AI CLINICAL PLANNING LIMITATIONS</h4>
            <p className="mb-4">
              NutriMind utilizes the Google Gemini API to generate personalized meal structures. Although suggestions are validated against the Philippine Food and Nutrition Research Institute (FNRI) Table of Food Compositions, they do NOT constitute formal medical or dietetic prescriptions. All nutrition projections are software estimations.
            </p>
            <h4 className="font-bold text-brand-text mb-2">2. HEALTH DATA PRIVACY & COMPLIANCE</h4>
            <p className="mb-4">
              By inputting health indices (including ages, weights, heights, diabetes/hypertension status, and allergens), you authorize NutriMind to process sensitive personal data strictly to support your meal layout calculations. In complete compliance with the <strong>Philippine Data Privacy Act of 2012 (R.A. 10173)</strong>, your records are fully encrypted and will never be shared with third parties without your explicit request.
            </p>
            <h4 className="font-bold text-brand-text mb-2">3. MEDICAL CONSULTATION DISCLAIMER</h4>
            <p>
              If you suffer from chronic conditions (such as severe renal failure, heart diseases, or high-risk pregnancies), you must consult a licensed Registered Nutritionist-Dietitian (RND) or Physician (MD) before implementing our generated layouts. You acknowledge that you use our recommendations entirely at your own risk.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <span>⚠️</span>
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
              <span>←</span>
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
              disabled={!medicalDisclaimer || !privacyPolicy}
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
