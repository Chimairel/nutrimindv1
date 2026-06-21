'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import AutocompleteInput from '@/components/ui/AutocompleteInput';
import { HealthConditionType } from '@/types';
import { Activity, Heart, Dna, Sparkles, CheckCircle, AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';

export default function OnboardingConditionsPage() {
  const router = useRouter();
  const [selectedConditions, setSelectedConditions] = useState<HealthConditionType[]>([]);
  const [otherConditions, setOtherConditions] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get('/user/onboarding/suggestions')
      .then((res) => {
        if (res.data?.success && res.data?.data?.conditions) {
          setSuggestions(res.data.data.conditions);
        }
      })
      .catch((err) => {
        console.error('Failed to load suggestions:', err);
      });
  }, []);

  const toggleCondition = (condition: HealthConditionType) => {
    if (condition === 'NONE') {
      // Selecting 'None' clears all other conditions
      setSelectedConditions(['NONE']);
    } else {
      setSelectedConditions((prev) => {
        // Remove 'None' if active
        const filtered = prev.filter((item) => item !== 'NONE');
        
        if (filtered.includes(condition)) {
          return filtered.filter((item) => item !== condition);
        } else {
          return [...filtered, condition];
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedConditions.length === 0) {
      setError('Please select at least one condition (or select "None").');
      return;
    }

    setIsLoading(true);
    try {
      // Send selected health conditions + optional custom text to the database
      await api.post('/user/onboarding/conditions', {
        conditions: selectedConditions,
        otherConditions: otherConditions.trim() || undefined,
      });

      // Proceed to Step 4: Allergies
      router.push('/onboarding/allergies');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Failed to save health conditions. Please verify your connection.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const conditionsList: { value: HealthConditionType; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'DIABETES', label: 'Diabetes', desc: 'Prioritize low-glycemic, portion-controlled index grains', icon: <Activity className="w-5 h-5 text-brand-green" /> },
    { value: 'HYPERTENSION', label: 'Hypertension', desc: 'Restrict high sodium, processed spices, and canned items', icon: <Heart className="w-5 h-5 text-brand-green" /> },
    { value: 'KIDNEY_DISEASE', label: 'Kidney Disease', desc: 'Strict limits on potassium, sodium, and high protein', icon: <Dna className="w-5 h-5 text-brand-green" /> },
    { value: 'HEART_CONDITION', label: 'Heart Condition', desc: 'Focus on low cholesterol, healthy fats, and low trans fats', icon: <Heart className="w-5 h-5 text-brand-green" /> },
    { value: 'PREGNANT', label: 'Pregnant / Lactating', desc: 'Increase essential folate, calcium, and iron resources', icon: <Sparkles className="w-5 h-5 text-brand-green" /> },
    { value: 'NONE', label: 'None / Healthy', desc: 'No clinical health or dietary restrictions present', icon: <CheckCircle className="w-5 h-5 text-brand-green" /> },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 3 of 5</span>
            <span className="text-brand-green">60% Completed</span>
          </div>
          <Progress value={60} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              CLINICAL HEALTH CONDITIONS
            </h2>
            <p className="text-xs text-brand-muted">
              Select any existing health conditions so the AI can filter out medically unsafe ingredients.
            </p>
          </div>

          {/* Critical Warning Label */}
          <div className="mb-6 p-3 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-xs font-semibold flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-status-pending-text shrink-0 mt-0.5" />
            <span>
              <strong>Crucial Safety Warning</strong>: This configuration directly impacts your meal suggestions. The AI filters out high-sodium foods for hypertension, monitors sugars for diabetes, and structures kidney-safe nutrients. Please confirm all selections.
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Back button row */}
            <button
              type="button"
              onClick={() => router.push('/onboarding/preferences')}
              className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors w-fit mb-1"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>Back to Step 2</span>
            </button>

            <div className="flex flex-col gap-3">
              {conditionsList.map((item) => {
                const isSelected = selectedConditions.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleCondition(item.value)}
                    className={`
                      flex items-center gap-4 px-5 py-4.5 rounded-xl border-2 text-left transition-all duration-200 outline-none
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

            {/* Other / Custom Conditions — always visible, disabled only when NONE selected */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Other Conditions <span className="text-brand-border font-normal normal-case">(optional)</span>
              </label>
              <AutocompleteInput
                id="other-conditions"
                value={otherConditions}
                onChange={setOtherConditions}
                suggestions={suggestions}
                placeholder={selectedConditions.includes('NONE') ? 'N/A — No conditions selected' : 'e.g., Gout, Celiac disease, Thyroid disorder...'}
                disabled={selectedConditions.includes('NONE')}
              />
              <p className="text-[10px] text-brand-muted leading-relaxed">
                Type any condition not listed above and press Enter. The AI will account for it in your meal plan.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-5 text-sm font-bold tracking-wide"
              isLoading={isLoading}
            >
              Continue to Step 4
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
