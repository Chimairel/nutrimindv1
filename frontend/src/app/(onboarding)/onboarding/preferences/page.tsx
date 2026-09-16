'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import { DietaryPreference, CarbPreference } from '@/types';
import { Egg, Apple, Wheat, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { normalizeFoodCulture } from '@/lib/profile-normalization';
import PlanningLocationFields from '@/components/user/PlanningLocationFields';
import type { MealLocalityPreference, PlanningGeographyLevel } from '@/types';

export default function OnboardingPreferencesPage() {
  const router = useRouter();
  const { profile, isLoading: isHydrating } = useProfile();
  const { refreshSession } = useAuth();
  const [dietary, setDietary] = useState<DietaryPreference>('OMNIVORE');
  const [carb, setCarb] = useState<CarbPreference>('MODERATE');
  const [culture, setCulture] = useState('Filipino');
  const [planningLevel, setPlanningLevel] = useState<PlanningGeographyLevel>('NATIONAL');
  const [planningRegion, setPlanningRegion] = useState('');
  const [planningProvinceHuc, setPlanningProvinceHuc] = useState('');
  const [mealLocalityPreference, setMealLocalityPreference] = useState<MealLocalityPreference>('NATIONAL');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = profile?.userProfile;
    if (!saved) return;
    if (saved.dietaryPreference) setDietary(saved.dietaryPreference as DietaryPreference);
    if (saved.carbPreference) setCarb(saved.carbPreference as CarbPreference);
    if (saved.foodCulture) setCulture(normalizeFoodCulture(saved.foodCulture));
    if (saved.planningGeographyLevel) setPlanningLevel(saved.planningGeographyLevel);
    setPlanningRegion(saved.planningRegionName || '');
    setPlanningProvinceHuc(saved.planningProvinceHucName || '');
    setMealLocalityPreference(saved.mealLocalityPreference || 'NATIONAL');
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
        foodCulture: normalizeFoodCulture(culture),
        planningGeographyLevel: planningLevel,
        planningRegionName: planningLevel === 'NATIONAL' ? null : planningRegion.trim(),
        planningProvinceHucName: planningLevel === 'PROVINCE_HUC' ? planningProvinceHuc.trim() : null,
        mealLocalityPreference,
      });
      await refreshSession();

      // Proceed to Step 3: Conditions
      router.push('/onboarding/conditions');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save preferences. Please check your connection.'));
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
    <div className="min-h-screen bg-brand-bg text-brand-text p-4 sm:p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-4 my-auto">
        {/* Onboarding progress slider */}
        <OnboardingProgressSlider currentStep={2} totalSteps={6} />

        <Card className="p-5 sm:p-6 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-3">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display text-brand-green">
              DIETARY PREFERENCES
            </h2>
            <p className="text-xs text-brand-muted">
              Select your food guidelines and meal planning preferences to tailor the AI recommendations.
            </p>
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-bold tracking-wide text-brand-text/90">Dietary Pattern</label>
              <div className="grid grid-cols-2 gap-2">
                {dietaryList.map((item) => {
                  const isSelected = dietary === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setDietary(item.value)}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-xl border-2 text-left transition-all duration-200 outline-none
                        ${
                          isSelected
                            ? 'border-brand-border bg-brand-green text-white dark:bg-brand-accent dark:text-brand-black font-bold shadow-md'
                            : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                        }
                      `}
                    >
                      <div className="min-w-0 pr-1">
                        <h4
                          className={`text-xs sm:text-sm font-bold tracking-wide ${
                            isSelected ? 'text-white dark:text-brand-black' : 'text-brand-text'
                          }`}
                        >
                          {item.label}
                        </h4>
                        <p
                          className={`text-[10px] mt-0.5 leading-tight truncate ${
                            isSelected ? 'text-white/85 dark:text-brand-black/80' : 'text-brand-muted'
                          }`}
                        >
                          {item.desc}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white dark:text-brand-black stroke-[3px] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carb preference */}
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-bold tracking-wide text-brand-text/90">Carb Intake Target</label>
              <div className="grid grid-cols-3 gap-2.5">
                {carbList.map((item) => {
                  const isSelected = carb === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setCarb(item.value)}
                      className={`
                        flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 text-center transition-all duration-200 outline-none
                        ${
                          isSelected
                            ? 'border-brand-border bg-brand-green text-white dark:bg-brand-accent dark:text-brand-black font-bold shadow-md'
                            : 'border-brand-border bg-brand-bgAlt/50 text-brand-muted hover:text-brand-text'
                        }
                      `}
                    >
                      <span className={`shrink-0 ${isSelected ? 'text-white dark:text-brand-black' : 'text-brand-green'}`}>
                        {item.icon}
                      </span>
                      <span className={`text-xs font-bold ${isSelected ? 'text-white dark:text-brand-black' : 'text-brand-text'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <PlanningLocationFields
              level={planningLevel}
              regionName={planningRegion}
              provinceHucName={planningProvinceHuc}
              onLevelChange={setPlanningLevel}
              onRegionNameChange={setPlanningRegion}
              onProvinceHucNameChange={setPlanningProvinceHuc}
              disabled={isLoading}
              idPrefix="onboarding-planning-location"
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 mt-2 text-sm font-bold tracking-wide"
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
