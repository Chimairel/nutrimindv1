'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import { ShoppingDayOfWeek } from '@/types';
import { ShoppingCart, Calendar, AlertTriangle, ArrowLeft, Check, Lightbulb } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const options = dayNames.map((day, index) => ({
  value: index as ShoppingDayOfWeek,
  icon: index === 0 || index === 6 ? <ShoppingCart className="h-5 w-5" /> : <Calendar className="h-5 w-5" />,
  title: day,
  desc: `Your 7-day meal cycle starts ${dayNames[(index + 1) % 7]}`,
}));

export default function OnboardingShoppingDayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromReview = searchParams.get('from') === 'review';
  const { profile, isLoading: isHydrating } = useProfile();
  const { refreshSession } = useAuth();
  const [selected, setSelected] = useState<ShoppingDayOfWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const exactDay = profile?.userProfile?.shoppingDayOfWeek;
    if (typeof exactDay === 'number' && exactDay >= 0 && exactDay <= 6) {
      setSelected(exactDay as ShoppingDayOfWeek);
      return;
    }
    const legacyGroup = profile?.userProfile?.shoppingDayGroup;
    if (legacyGroup === 'WEEKEND') setSelected(6);
    if (legacyGroup === 'WEEKDAY') setSelected(0);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selected === null) {
      setError('Please select your preferred shopping day to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/user/onboarding/shopping-day', { shoppingDayOfWeek: selected });
      await refreshSession();
      router.push('/onboarding/tos');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save your preference. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-4">
        {/* Progress Slider */}
        <OnboardingProgressSlider currentStep={5} totalSteps={6} />

        <Card className="p-5 sm:p-7 glass-panel shadow-2xl border-brand-border/80">
          <button
            type="button"
            onClick={() => router.push(isFromReview ? '/onboarding/tos' : '/onboarding/allergies')}
            className="mb-3 flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors w-fit"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            <span>{isFromReview ? 'Back to Review' : 'Back to Step 4'}</span>
          </button>

          <div className="flex flex-col gap-1 mb-4">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              GROCERY SHOPPING DAY
            </h2>
            <p className="text-xs text-brand-muted">
              This helps us time your weekly meal plan so it&apos;s ready before you shop — keeping your grocery list
              perfectly in sync.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Exact day cards */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {options.map((opt) => {
                const isSelected = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    id={`shopping-day-${opt.value}`}
                    onClick={() => setSelected(opt.value)}
                    className={`
                      flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all duration-200 outline-none
                      ${
                        isSelected
                          ? 'border-brand-green bg-brand-green text-white dark:border-brand-accent dark:bg-brand-accent dark:text-black shadow-md font-bold'
                          : 'border-brand-border/70 bg-brand-bgAlt/50 text-brand-text hover:bg-brand-border/40'
                      }
                    `}
                  >
                    <span
                      className={`p-2 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 dark:bg-black/15 text-white dark:text-black'
                          : 'bg-brand-border/30 text-brand-green'
                      }`}
                    >
                      {opt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-xs sm:text-sm font-bold tracking-wide ${
                          isSelected ? 'text-white dark:text-black' : 'text-brand-text'
                        }`}
                      >
                        {opt.title}
                      </h4>
                      <p
                        className={`text-[11px] mt-0.5 truncate sm:whitespace-normal font-semibold ${
                          isSelected ? 'text-emerald-100 dark:text-neutral-900' : 'text-brand-muted'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-white dark:text-black bg-white/20 dark:bg-black/15 h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Info note */}
            <div className="mt-1 p-2.5 rounded-xl bg-brand-bgAlt/40 border border-brand-border/40">
              <p className="text-[11px] text-brand-muted leading-relaxed flex items-start gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold text-brand-text/70">How this works:</span> Your starter plan bridges
                  the days until your first full cycle. Future plans are prepared three days before your grocery day so
                  staff have time to review any newly generated meals.
                </span>
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 mt-1 text-sm font-bold tracking-wide"
              isLoading={isLoading}
              disabled={isHydrating}
            >
              {isFromReview ? 'Save & Return to Review' : 'Continue to Step 6'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
