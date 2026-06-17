'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import { AllergenType } from '@/types';

import axios from 'axios';

export default function OnboardingAllergiesPage() {
  const router = useRouter();
  const [selectedAllergens, setSelectedAllergens] = useState<AllergenType[]>([]);
  const [otherAllergies, setOtherAllergies] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const allergensList: { value: AllergenType; label: string; desc: string; icon: string }[] = [
    { value: 'SHELLFISH', label: 'Shellfish', desc: 'Shrimps, crabs, lobsters, mussels, etc.', icon: '🦐' },
    { value: 'NUTS', label: 'Tree Nuts & Peanuts', desc: 'Peanuts, cashews, almonds, and spreads', icon: '🥜' },
    { value: 'DAIRY', label: 'Dairy', desc: 'Cow milk, cheese, butter, cream, and yogurt', icon: '🥛' },
    { value: 'GLUTEN', label: 'Gluten / Wheat', desc: 'Wheat flour, bread, pasta, and baked goods', icon: '🌾' },
    { value: 'EGGS', label: 'Eggs', desc: 'Chicken eggs, duck eggs (balut), and mayonnaise', icon: '🥚' },
    { value: 'NONE', label: 'No Allergies', desc: 'No food allergies or hypersensitivities', icon: '✨' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 4 of 6</span>
            <span className="text-brand-green">66% Completed</span>
          </div>
          <Progress value={66} className="bg-brand-border/40" />
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
              <span>⚠️</span>
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
              <span>←</span>
              <span>Back to Step 3</span>
            </button>

            <div className="flex flex-col gap-3">
              {allergensList.map((item) => {
                const isSelected = selectedAllergens.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleAllergen(item.value)}
                    className={`
                      flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-200 outline-none
                      ${isSelected 
                        ? 'border-brand-green bg-brand-green/10 shadow-lg shadow-brand-green/5' 
                        : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                      }
                    `}
                  >
                    <span className="text-2xl bg-brand-border/30 p-2 rounded-xl flex items-center justify-center">
                      {item.icon}
                    </span>
                    <div className="flex-1">
                      <h4 className={`text-sm font-bold tracking-wide ${isSelected ? 'text-brand-green' : 'text-brand-text'}`}>
                        {item.label}
                      </h4>
                      <p className="text-xs text-brand-muted mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="text-brand-green text-sm font-bold bg-brand-green/10 h-6 w-6 rounded-full flex items-center justify-center">
                        ✓
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
              <textarea
                id="other-allergies"
                value={otherAllergies}
                onChange={(e) => setOtherAllergies(e.target.value)}
                placeholder={selectedAllergens.includes('NONE') ? 'N/A — No allergies selected' : 'e.g., Soy, Sesame, Fish, Mango...'}
                rows={2}
                disabled={selectedAllergens.includes('NONE')}
                className={`w-full px-4 py-3 rounded-xl bg-brand-bgAlt/50 border border-brand-border text-brand-text text-sm placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-green transition-all resize-none ${
                  selectedAllergens.includes('NONE') ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              />
              <p className="text-[10px] text-brand-muted leading-relaxed">
                Type any allergy not listed above. The AI will completely exclude these ingredients.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-5 text-sm font-bold tracking-wide"
              isLoading={isLoading}
            >
              Continue to Step 5
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
