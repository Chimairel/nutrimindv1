'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Progress from '@/components/ui/Progress';
import { Goal, ActivityLevel } from '@/types';
import { Lock, TrendingUp, Dumbbell, TrendingDown, Scale, AlertTriangle, Check } from 'lucide-react';
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

  // When goal changes, auto-handle the target weight field
  const handleGoalChange = (newGoal: Goal) => {
    setGoal(newGoal);
    setError(null);
    if (newGoal === 'MAINTAIN') {
      // Lock target weight to current weight for maintain goal
      setTargetWeight(weight);
    }
  };

  // Derive live validation state for the target weight field
  const parsedWeight = parseFloat(weight);
  const parsedTargetWeight = parseFloat(targetWeight);
  const hasWeightValues = !isNaN(parsedWeight) && !isNaN(parsedTargetWeight);

  const targetWeightState: 'valid' | 'invalid' | 'neutral' = (() => {
    if (!hasWeightValues || goal === 'MAINTAIN') return 'neutral';
    if (goal === 'GAIN_WEIGHT' || goal === 'BUILD_MUSCLE') {
      return parsedTargetWeight >= parsedWeight ? 'valid' : 'invalid';
    }
    if (goal === 'LOSE_WEIGHT') {
      return parsedTargetWeight <= parsedWeight ? 'valid' : 'invalid';
    }
    return 'neutral';
  })();

  const targetWeightHint = (() => {
    if (goal === 'MAINTAIN') return (
      <span className="flex items-center gap-1">
        <Lock className="w-3 h-3 text-brand-muted shrink-0" /> Locked to your current weight
      </span>
    );
    if (goal === 'GAIN_WEIGHT') return (
      <span className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-brand-green shrink-0" /> Must be ≥ current weight
      </span>
    );
    if (goal === 'BUILD_MUSCLE') return (
      <span className="flex items-center gap-1">
        <Dumbbell className="w-3 h-3 text-brand-green shrink-0" /> Must be ≥ current weight
      </span>
    );
    if (goal === 'LOSE_WEIGHT') return (
      <span className="flex items-center gap-1">
        <TrendingDown className="w-3 h-3 text-brand-green shrink-0" /> Must be ≤ current weight
      </span>
    );
    return '';
  })();

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

    // Goal-aware target weight validation
    if ((goal === 'GAIN_WEIGHT' || goal === 'BUILD_MUSCLE') && parsedTargetWeight < parsedWeight) {
      setError(
        `Your target weight (${parsedTargetWeight} kg) should be equal to or higher than your current weight (${parsedWeight} kg) for a "${goal === 'GAIN_WEIGHT' ? 'Gain Weight' : 'Build Muscle'}" goal.`
      );
      return;
    }
    if (goal === 'LOSE_WEIGHT' && parsedTargetWeight > parsedWeight) {
      setError(
        `Your target weight (${parsedTargetWeight} kg) should be equal to or lower than your current weight (${parsedWeight} kg) for a "Lose Weight" goal.`
      );
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

  const goalsList: { value: Goal; label: string; icon: React.ReactNode }[] = [
    { value: 'LOSE_WEIGHT', label: 'Lose Weight', icon: <TrendingDown className="w-4 h-4 text-brand-green" /> },
    { value: 'GAIN_WEIGHT', label: 'Gain Weight', icon: <TrendingUp className="w-4 h-4 text-brand-green" /> },
    { value: 'MAINTAIN', label: 'Maintain Weight', icon: <Scale className="w-4 h-4 text-brand-green" /> },
    { value: 'BUILD_MUSCLE', label: 'Build Muscle', icon: <Dumbbell className="w-4 h-4 text-brand-green" /> },
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
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
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
                      onClick={() => handleGoalChange(item.value)}
                      className={`
                        flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all duration-200 outline-none
                        ${isSelected 
                          ? 'border-brand-border bg-brand-green text-white shadow-lg shadow-brand-green/5' 
                          : 'border-brand-border bg-brand-bgAlt/50 text-brand-muted hover:text-brand-text'
                        }
                      `}
                    >
                      <span className="shrink-0">{item.icon}</span>
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
                onChange={(e) => {
                  setWeight(e.target.value);
                  // Keep target weight in sync for MAINTAIN goal
                  if (goal === 'MAINTAIN') setTargetWeight(e.target.value);
                }}
                disabled={isLoading}
              />

              {/* Target Weight — smart field with live goal-aware validation */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="targetWeight"
                  className={`text-sm font-bold tracking-wide ${
                    goal === 'MAINTAIN' ? 'text-brand-muted' : 'text-brand-text/90'
                  }`}
                >
                  Target Weight (kg)
                </label>
                <input
                  id="targetWeight"
                  type="number"
                  placeholder={goal === 'MAINTAIN' ? 'Same as current weight' : '65.0'}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  disabled={isLoading || goal === 'MAINTAIN'}
                  className={`
                    w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 outline-none
                    bg-brand-bgAlt/50 text-brand-text
                    ${
                      goal === 'MAINTAIN'
                        ? 'border-brand-border/40 opacity-50 cursor-not-allowed text-brand-muted'
                        : targetWeightState === 'invalid'
                        ? 'border-status-error-text/60 bg-status-error-bg/5 focus:border-status-error-text'
                        : targetWeightState === 'valid'
                        ? 'border-brand-green/60 bg-brand-green/5 focus:border-brand-green'
                        : 'border-brand-border focus:border-brand-green'
                    }
                  `}
                />
                {/* Hint text below the field */}
                <p className={`text-[10px] font-semibold leading-tight ${
                  goal === 'MAINTAIN' ? 'text-brand-muted' :
                  targetWeightState === 'invalid' ? 'text-status-error-text' :
                  targetWeightState === 'valid' ? 'text-brand-green' :
                  'text-brand-muted'
                }`}>
                  {targetWeightHint}
                </p>
              </div>
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
