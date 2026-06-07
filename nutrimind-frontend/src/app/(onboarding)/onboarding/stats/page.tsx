'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import { Goal, ActivityLevel } from '@/types';

import axios from 'axios';

export default function OnboardingStatsPage() {
  const router = useRouter();
  const [goal, setGoal] = useState<Goal>('MAINTAIN');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('LIGHTLY_ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic layout validations
    const parsedAge = parseInt(age);
    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const parsedTargetWeight = parseFloat(targetWeight);

    if (isNaN(parsedAge) || parsedAge < 15 || parsedAge > 100) {
      setError('Please provide a realistic age (15 to 100 years).');
      return;
    }
    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
      setError('Please provide a realistic height (100 to 250 cm).');
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      setError('Please provide a realistic weight (30 to 300 kg).');
      return;
    }
    if (isNaN(parsedTargetWeight) || parsedTargetWeight < 30 || parsedTargetWeight > 300) {
      setError('Please provide a realistic target weight.');
      return;
    }

    setIsLoading(true);
    try {
      // Send stats to backend onboarding profile endpoint
      await api.post('/user/onboarding/profile', {
        age: parsedAge,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        targetWeightKg: parsedTargetWeight,
        goal,
        activityLevel,
      });

      // Advance to step 2: Preferences
      router.push('/onboarding/preferences');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Failed to save stats. Please verify your connection.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goalsList: { value: Goal; label: string; icon: string }[] = [
    { value: 'LOSE_WEIGHT', label: 'Lose Weight', icon: '📉' },
    { value: 'GAIN_WEIGHT', label: 'Gain Weight', icon: '📈' },
    { value: 'MAINTAIN', label: 'Maintain Weight', icon: '⚖️' },
    { value: 'BUILD_MUSCLE', label: 'Build Muscle', icon: '💪' },
  ];

  const activityLevelsList: { value: ActivityLevel; label: string; desc: string }[] = [
    { value: 'SEDENTARY', label: 'Sedentary', desc: 'Little to no exercise' },
    { value: 'LIGHTLY_ACTIVE', label: 'Lightly Active', desc: '1-3 days/week exercise' },
    { value: 'ACTIVE', label: 'Active', desc: '3-5 days/week intense exercise' },
    { value: 'VERY_ACTIVE', label: 'Very Active', desc: 'Daily athletic sports/jobs' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 flex flex-col items-center justify-center select-none relative">
      <div className="absolute top-[20%] left-[50%] translate-x-[-50%] h-[300px] w-[300px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Onboarding progress */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold text-brand-muted tracking-widest uppercase">
            <span>Step 1 of 5</span>
            <span className="text-brand-green">20% Completed</span>
          </div>
          <Progress value={20} className="bg-brand-border/40" />
        </div>

        <Card className="p-8 glass-panel shadow-2xl border-brand-border/80">
          <div className="flex flex-col gap-1 mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight font-display text-brand-green">
              PERSONAL METRICS
            </h2>
            <p className="text-xs text-brand-muted">
              Specify your primary fitness objective and body stats to calculate your targets.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Goal Chips */}
            <div className="flex flex-col gap-2.5">
              <label className="text-sm font-bold tracking-wide text-brand-text/90">
                Primary Goal
              </label>
              <div className="grid grid-cols-2 gap-3">
                {goalsList.map((item) => {
                  const isSelected = goal === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setGoal(item.value)}
                      className={`
                        flex items-center gap-2.5 px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200 outline-none
                        ${isSelected 
                          ? 'border-brand-green bg-brand-green/10 text-brand-green shadow-lg shadow-brand-green/5' 
                          : 'border-brand-border bg-brand-bgAlt/50 text-brand-muted hover:text-brand-text'
                        }
                      `}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="age"
                label="Age (Years)"
                type="number"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="height"
                label="Height (cm)"
                type="number"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="weight"
                label="Weight (kg)"
                type="number"
                placeholder="68.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="targetWeight"
                label="Target Weight (kg)"
                type="number"
                placeholder="65.0"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Activity Level Selector */}
            <div className="flex flex-col gap-2.5">
              <label className="text-sm font-bold tracking-wide text-brand-text/90">
                Daily Activity Level
              </label>
              <div className="flex flex-col gap-2.5">
                {activityLevelsList.map((item) => {
                  const isSelected = activityLevel === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActivityLevel(item.value)}
                      className={`
                        flex items-center justify-between px-5 py-3 rounded-xl border text-left transition-all duration-200 outline-none
                        ${isSelected 
                          ? 'border-brand-green bg-brand-green/10 shadow-lg shadow-brand-green/5' 
                          : 'border-brand-border bg-brand-bgAlt/50 hover:bg-brand-border/40'
                        }
                      `}
                    >
                      <div>
                        <h4 className={`text-sm font-bold tracking-wide ${isSelected ? 'text-brand-green' : 'text-brand-text'}`}>
                          {item.label}
                        </h4>
                        <p className="text-xs text-brand-muted mt-0.5 leading-tight">{item.desc}</p>
                      </div>
                      {isSelected && <span className="text-brand-green font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 mt-4 text-sm font-bold tracking-wide"
              isLoading={isLoading}
            >
              Continue to Step 2
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
