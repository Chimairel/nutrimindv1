'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import AutocompleteInput from '@/components/ui/AutocompleteInput';
import { AllergenType } from '@/types';
import { Fish, ShieldAlert, Milk, Wheat, Egg, Sparkles, AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingAllergiesPage() {
  const router = useRouter();
  const { profile, isLoading: isHydrating } = useProfile();
  const { refreshSession } = useAuth();
  const [selectedAllergens, setSelectedAllergens] = useState<AllergenType[]>([]);
  const [otherAllergies, setOtherAllergies] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get('/user/onboarding/suggestions')
      .then((res) => {
        if (res.data?.success && res.data?.data?.allergies) {
          setSuggestions(res.data.data.allergies);
        }
      })
      .catch((err) => {
        console.error('Failed to load suggestions:', err);
      });
  }, []);

  useEffect(() => {
    if (!profile) return;
    setSelectedAllergens(profile.allergies as AllergenType[]);
    setOtherAllergies(profile.userProfile?.otherAllergies || '');
  }, [profile]);

  const toggleAllergen = (allergen: AllergenType) => {
    if (allergen === 'NONE') {
      // Selecting 'None' clears all other choices
      setSelectedAllergens(['NONE']);
    } else {
      setSelectedAllergens((prev) => {
        // Clear 'None' if selected
        const filtered = prev.filter((item) => item !== 'NONE');
        
        if (filtered.includes(allergen)) {
          return filtered.filter((item) => item !== allergen);
        } else {
          return [...filtered, allergen];
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedAllergens.length === 0) {
      setError('Please select at least one choice (or select "None").');
      return;
    }

    setIsLoading(true);
    try {
      // Send allergens + optional custom text to backend
      await api.post('/user/onboarding/allergies', {
        allergies: selectedAllergens,
        otherAllergies: otherAllergies.trim() || undefined,
      });
      await refreshSession();

      // Advance to step 5: Shopping Day
      router.push('/onboarding/shopping-day');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Failed to save allergen settings. Please try again.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const allergensList: { value: AllergenType; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'SHELLFISH', label: 'Shellfish', desc: 'Shrimps, crabs, lobsters, mussels, etc.', icon: <Fish className="w-5 h-5 text-brand-green" /> },
    { value: 'NUTS', label: 'Tree Nuts & Peanuts', desc: 'Peanuts, cashews, almonds, and spreads', icon: <ShieldAlert className="w-5 h-5 text-brand-green" /> },
    { value: 'DAIRY', label: 'Dairy', desc: 'Cow milk, cheese, butter, cream, and yogurt', icon: <Milk className="w-5 h-5 text-brand-green" /> },
    { value: 'GLUTEN', label: 'Gluten / Wheat', desc: 'Wheat flour, bread, pasta, and baked goods', icon: <Wheat className="w-5 h-5 text-brand-green" /> },
    { value: 'EGGS', label: 'Eggs', desc: 'Chicken eggs, duck eggs (balut), and mayonnaise', icon: <Egg className="w-5 h-5 text-brand-green" /> },
    { value: 'NONE', label: 'No Allergies', desc: 'No food allergies or hypersensitivities', icon: <Sparkles className="w-5 h-5 text-brand-green" /> },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 4 of 6</span>
            <span className="text-brand-green">67% Completed</span>
          </div>
          <Progress value={67} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              FOOD ALLERGIES
            </h2>
            <p className="text-xs text-brand-muted">
              Select any specific foods or allergens you must avoid. The AI will exclude these completely.
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
              onClick={() => router.push('/onboarding/conditions')}
              className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors w-fit mb-1"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Back to Step 3</span>
            </button>

            <div className="flex flex-col gap-3">
              {allergensList.map((item) => {
                const isSelected = selectedAllergens.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleAllergen(item.value)}
                    className={`
                      flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all duration-200 outline-none
                      ${isSelected 
                        ? 'border-brand-border bg-brand-green text-white shadow-lg shadow-brand-green/5' 
                        : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                      }
                    `}
                  >
                    <span className="bg-brand-border/30 p-2 rounded-xl flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <div className="flex-1">
                      <h4 className={`text-sm font-bold tracking-wide ${isSelected ? 'text-white' : 'text-brand-text'}`}>
                        {item.label}
                      </h4>
                      <p className={`text-xs mt-0.5 leading-tight ${isSelected ? 'text-white/80' : 'text-brand-muted'}`}>{item.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="text-white text-sm font-bold bg-white/20 h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Other / Custom Allergies — always visible, disabled when NONE selected */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Other Allergies <span className="text-brand-border font-normal normal-case">(optional)</span>
              </label>
              <AutocompleteInput
                id="other-allergies"
                value={otherAllergies}
                onChange={setOtherAllergies}
                suggestions={suggestions}
                placeholder={selectedAllergens.includes('NONE') ? 'N/A — No allergies selected' : 'e.g., Soy, Sesame, Fish, Mango...'}
                disabled={selectedAllergens.includes('NONE')}
              />
              <p className="text-[10px] text-brand-muted leading-relaxed">
                Type any allergy not listed above and press Enter. The AI will completely exclude these ingredients.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-5 text-sm font-bold tracking-wide"
              isLoading={isLoading}
              disabled={isHydrating}
            >
              Continue to Step 5
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
