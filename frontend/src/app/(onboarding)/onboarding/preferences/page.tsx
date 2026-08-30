'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import { DietaryPreference, CarbPreference } from '@/types';
import { Egg, Apple, Wheat, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const { profile, isLoading: isHydrating } = useProfile();
  const { refreshSession } = useAuth();
  const [dietary, setDietary] = useState<DietaryPreference>('OMNIVORE');
  const [carb, setCarb] = useState<CarbPreference>('MODERATE');
  const [culture, setCulture] = useState('Filipino');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = profile?.userProfile;
    if (!saved) return;
    if (saved.dietaryPreference) setDietary(saved.dietaryPreference as DietaryPreference);
    if (saved.carbPreference) setCarb(saved.carbPreference as CarbPreference);
    if (saved.foodCulture) setCulture(saved.foodCulture);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);
    try {
      // Send preference specs to backend profile endpoint to extend user profile
      await api.post('/user/onboarding/profile', {
        dietaryPreference: dietary,
        carbPreference: carb,
        foodCulture: culture.trim() || 'Filipino',
      });
      await refreshSession();

      // Proceed to Step 3: Conditions
      router.push('/onboarding/conditions');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Failed to save preferences. Please check your connection.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const dietaryList: { value: DietaryPreference; label: string; desc: string }[] = [
    { value: 'OMNIVORE', label: 'Omnivore', desc: 'Eat everything (standard Filipino diet)' },
    { value: 'VEGETARIAN', label: 'Vegetarian', desc: 'No meat/poultry/fish. Eggs/dairy fine' },
    { value: 'VEGAN', label: 'Vegan', desc: '100% plant-based diet' },
    { value: 'PESCATARIAN', label: 'Pescatarian', desc: 'Vegetarian + seafood' },
  ];

  const carbList: { value: CarbPreference; label: string; icon: React.ReactNode }[] = [
    { value: 'LOW', label: 'Low Carb', icon: <Egg className="w-5 h-5 text-brand-green" /> },
    { value: 'MODERATE', label: 'Moderate Carb', icon: <Apple className="w-5 h-5 text-brand-green" /> },
    { value: 'HIGH', label: 'High Carb', icon: <Wheat className="w-5 h-5 text-brand-green" /> },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 2 of 6</span>
            <span className="text-brand-green">33% Completed</span>
          </div>
          <Progress value={33} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              DIETARY PREFERENCES
            </h2>
            <p className="text-xs text-brand-muted">
              Select your food guidelines and cooking background to tailor the AI recommendations.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Back button */}
            <button
              type="button"
              onClick={() => router.push('/onboarding/stats')}
              className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors w-fit"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Back to Step 1</span>
            </button>

            {/* Dietary Preference Selector */}
            <div className="flex flex-col gap-2.5">
              <label className="text-sm font-bold tracking-wide text-brand-text/90">
                Dietary Pattern
              </label>
              <div className="flex flex-col gap-2.5">
                {dietaryList.map((item) => {
                  const isSelected = dietary === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setDietary(item.value)}
                      className={`
                        flex items-center justify-between px-5 py-3 rounded-xl border-2 text-left transition-all duration-200 outline-none
                        ${isSelected 
                          ? 'border-brand-border bg-brand-green text-white shadow-lg shadow-brand-green/5' 
                          : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                        }
                      `}
                    >
                      <div>
                        <h4 className={`text-sm font-bold tracking-wide ${isSelected ? 'text-white' : 'text-brand-text'}`}>
                          {item.label}
                        </h4>
                        <p className={`text-xs mt-0.5 leading-tight ${isSelected ? 'text-white/80' : 'text-brand-muted'}`}>{item.desc}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-white stroke-[3px] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carb preference */}
            <div className="flex flex-col gap-2.5">
              <label className="text-sm font-bold tracking-wide text-brand-text/90">
                Carb Intake Target
              </label>
              <div className="grid grid-cols-3 gap-3">
                {carbList.map((item) => {
                  const isSelected = carb === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setCarb(item.value)}
                      className={`
                        flex flex-col items-center justify-center gap-1.5 px-3 py-4 rounded-xl border-2 text-center transition-all duration-200 outline-none
                        ${isSelected 
                          ? 'border-brand-border bg-brand-green text-white shadow-lg shadow-brand-green/5' 
                          : 'border-brand-border bg-brand-bgAlt/50 text-brand-muted hover:text-brand-text'
                        }
                      `}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Food Culture */}
            <Input
              id="culture"
              label="Cooking Style / Food Culture"
              type="text"
              placeholder="Filipino, Ilocano, Visayan, etc."
              value={culture}
              onChange={(e) => setCulture(e.target.value)}
              disabled={isLoading}
              maxLength={80}
              helperText="Describe your regional preferences so the AI can prioritize local ingredients (e.g. malunggay, ampalaya, kangkong)."
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-4 text-sm font-bold tracking-wide"
              isLoading={isLoading}
              disabled={isHydrating}
            >
              Continue to Step 3
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
