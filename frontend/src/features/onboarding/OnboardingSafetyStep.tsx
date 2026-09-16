'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import type { SafetyEntryDomain } from '@/types';

interface OnboardingSafetyStepProps {
  step: number;
  progress?: number;
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  guidance: string;
  editableDomains: SafetyEntryDomain[];
  nextHref: string;
}

export default function OnboardingSafetyStep({
  step,
  backHref,
  backLabel,
  title,
  description,
  guidance,
  editableDomains,
  nextHref,
}: OnboardingSafetyStepProps) {
  const router = useRouter();
  const { profile, isLoading } = useProfile();
  const { refreshSession } = useAuth();
  const initialEntries = useMemo(() => safetyInputsFromProfile(profile), [profile]);

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-6 text-brand-text sm:px-6 sm:py-8 flex flex-col items-center justify-center relative select-none">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {/* Step Slider */}
        <OnboardingProgressSlider currentStep={step} totalSteps={6} />

        <Card className="border-brand-border/80 p-5 shadow-2xl sm:p-7 glass-panel">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="mb-3 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" /> {backLabel}
          </button>
          <h1 className="font-display text-2xl font-extrabold text-brand-green">{title}</h1>
          <p className="mt-1 text-xs text-brand-muted leading-relaxed">{description}</p>
          <div className="my-3 flex gap-2 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-2.5 text-xs text-status-pending-text">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {guidance}
          </div>
          {isLoading ? (
            <p className="text-sm text-brand-muted">Loading your safety profile…</p>
          ) : (
            <StructuredSafetyIntake
              initialEntries={initialEntries}
              editableDomains={editableDomains}
              submitLabel="Save and continue"
              onSaved={async () => {
                await refreshSession();
                router.push(nextHref);
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
