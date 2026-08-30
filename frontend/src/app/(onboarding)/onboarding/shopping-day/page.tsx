'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import { ShoppingDayOfWeek } from '@/types';
import { ShoppingCart, Calendar, AlertTriangle, ArrowLeft, Check, Lightbulb } from 'lucide-react';
import axios from 'axios';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const options = dayNames.map((day, index) => ({
  value: index as ShoppingDayOfWeek,
  icon: index === 0 || index === 6
    ? <ShoppingCart className="h-5 w-5" />
    : <Calendar className="h-5 w-5" />,
  title: day,
  desc: `Your 7-day meal cycle starts ${dayNames[(index + 1) % 7]}`,
}));

export default function OnboardingShoppingDayPage() {
  const router = useRouter();
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
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to save your preference. Please try again.');
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
        {/* Progress */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 5 of 6</span>
            <span className="text-brand-green">83% Completed</span>
          </div>
          <Progress value={83} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              GROCERY SHOPPING DAY
            </h2>
            <p className="text-xs text-brand-muted">
              This helps us time your weekly meal plan so it&apos;s ready before you shop — keeping your grocery list perfectly in sync.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Back button */}
            <button
              type="button"
              onClick={() => router.push('/onboarding/allergies')}
              className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors w-fit mb-1"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Back to Step 4</span>
            </button>

            {/* Exact day cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all duration-200 outline-none
                      ${isSelected
                        ? 'border-brand-border bg-brand-green text-white shadow-lg shadow-brand-green/5'
                        : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                      }
                    `}
                  >
                    <span className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-brand-border/30 text-brand-green'}`}>
                      {opt.icon}
                    </span>
                    <div className="flex-1">
                      <h4 className={`text-sm font-bold tracking-wide ${isSelected ? 'text-white' : 'text-brand-text'}`}>
                        {opt.title}
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-brand-muted'}`}>{opt.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="text-white text-sm font-bold bg-white/20 h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white stroke-[3px]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Info note */}
            <div className="mt-2 p-3 rounded-xl bg-brand-bgAlt/40 border border-brand-border/40">
              <p className="text-[11px] text-brand-muted leading-relaxed flex items-start gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold text-brand-text/70">How this works:</span> Your starter plan bridges the days until your first full cycle. Future plans are prepared three days before your grocery day so staff have time to review any newly generated meals.
                </span>
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-3 text-sm font-bold tracking-wide"
              isLoading={isLoading}
              disabled={isHydrating}
            >
              Continue to Step 6
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
