'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import MealCard from '@/components/user/MealCard';
import { MealPlan } from '@/types';
import axios from 'axios';

export default function WeeklyPlanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setMeals(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to fetch weekly plan menu.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMeals();
    }
  }, [user]);

  // Handles scheduled status checkoff toggles in the weekly view
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Reload current meals to update checkboxes and macro sums
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setMeals(res.data.data);
      }
    } catch (err) {
      console.error('[WeeklyPlan] Status toggle failed:', err);
    }
  };

  // Triggers full 7-day meal plan regeneration
  const handleRegeneratePlan = async () => {
    if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?')) return;
    
    setIsRegenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setMeals(res.data.data.meals);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Gemini failed to regenerate weekly plan.');
      } else {
        setError('Regeneration failed.');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  // Group meals by date
  const groupMealsByDate = () => {
    const grouped: Record<string, MealPlan[]> = {};
    
    meals.forEach((meal) => {
      const dateKey = new Date(meal.scheduledDate).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    // Sort the keys chronologically
    return Object.keys(grouped)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        // Parse date for headers
        const parsedDate = new Date(dateKey);
        const weekday = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Sum calories and macros targets for the day
        const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const dayProtein = dayMeals.reduce((sum, m) => sum + m.proteinG, 0);
        const dayCarbs = dayMeals.reduce((sum, m) => sum + m.carbsG, 0);
        const dayFat = dayMeals.reduce((sum, m) => sum + m.fatG, 0);

        return {
          dateKey,
          weekday,
          dateStr,
          mealsList: dayMeals,
          dayCalories,
          dayProtein,
          dayCarbs,
          dayFat,
        };
      });
  };

  if (isLoading || isRegenerating) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-brand-muted animate-pulse font-display font-semibold">
            {isRegenerating ? 'Regenerating 7-day AI plan...' : 'Analyzing weekly schedule...'}
          </p>
        </div>
      </div>
    );
  }

  const groupedDays = groupMealsByDate();

  // Detect if the current plan is a Starter Plan
  const isStarterPlan = meals.length > 0 && meals[0].planType === 'STARTER';

  // For Starter Plan banner: compute day range and next cycle start
  const starterFirstDate = isStarterPlan && groupedDays.length > 0
    ? new Date(groupedDays[0].dateKey)
    : null;
  const starterLastDate = isStarterPlan && groupedDays.length > 0
    ? new Date(groupedDays[groupedDays.length - 1].dateKey)
    : null;

  // Determine next weekStartDay label from the plan group
  const nextCycleDay = (() => {
    if (!isStarterPlan || !starterLastDate) return null;
    const dayAfter = new Date(starterLastDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return dayAfter.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  })();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 md:p-12 pb-32 select-none relative">
      <div className="absolute top-[10%] left-[50%] translate-x-[-50%] h-[300px] w-[500px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Starter Plan Banner — shown only for STARTER plans */}
        {isStarterPlan && starterFirstDate && starterLastDate && nextCycleDay && (
          <div className="w-full rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌱</span>
              <h2 className="text-base font-extrabold text-brand-green font-display tracking-tight">
                Your Starter Plan
              </h2>
            </div>
            <p className="text-xs text-brand-muted">
              {groupedDays.length} day{groupedDays.length !== 1 ? 's' : ''} ·{' '}
              {starterFirstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} to{' '}
              {starterLastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-brand-text/60 leading-relaxed">
              Your full 7-day plan begins on <span className="font-semibold text-brand-text/80">{nextCycleDay}</span>, matching your preferred shopping day.
            </p>
          </div>
        )}

        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6 text-left">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{isStarterPlan ? '🌱' : '🗓️'}</span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green">
                {isStarterPlan ? 'STARTER PLAN' : 'WEEKLY MEAL PLAN'}
              </h1>
            </div>
            <p className="text-xs text-brand-muted uppercase tracking-wider font-bold">
              {isStarterPlan
                ? `${groupedDays.length}-day kickoff plan · Full weekly cycle starts ${nextCycleDay}`
                : 'Complete 7-day scheduled breakdown and macro targets'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')} className="text-xs font-semibold py-2">
              🏠 Dashboard
            </Button>
            <Button variant="primary" onClick={handleRegeneratePlan} className="text-xs font-bold py-2 bg-red-500 hover:bg-red-600 border-red-500/20 text-white shadow-xl shadow-red-500/10">
              🔄 Regenerate Plan
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {groupedDays.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon="📅"
              title="No Active Meal Plan"
              description="Generate a customized 7-day plan (21 meals) mapped to your clinical target calories and Filipino food culture."
              actionText="Generate 7-Day Plan"
              onAction={handleRegeneratePlan}
            />
          </div>
        ) : (
          /* Weekly Grid List */
          <div className="flex flex-col gap-10 text-left">
            {groupedDays.map((day) => (
              <div key={day.dateKey} className="flex flex-col gap-4">
                
                {/* Day Header with sum targets */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-brand-surface/40 p-4 border border-brand-border/60 rounded-2xl">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-brand-green uppercase leading-none">
                      {day.weekday}
                    </h3>
                    <span className="text-[10px] text-brand-muted font-bold mt-1 block">
                      {day.dateStr}
                    </span>
                  </div>
                  
                  {/* Macros summing indicators */}
                  <div className="flex gap-3 flex-wrap text-[10px] font-bold text-brand-text">
                    <Badge variant="user" showIcon={false} className="py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
                      Target: {Math.round(day.dayCalories)} kcal
                    </Badge>
                    <Badge variant="verified" showIcon={false} className="py-0.5 px-2 bg-[#52B788]/10 text-brand-green border-brand-green/20">
                      {Math.round(day.dayProtein)}g Protein
                    </Badge>
                    <Badge variant="pending" showIcon={false} className="py-0.5 px-2 bg-amber-400/10 text-amber-500 border-amber-500/20">
                      {Math.round(day.dayCarbs)}g Carbs
                    </Badge>
                    <Badge variant="user" showIcon={false} className="py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
                      {Math.round(day.dayFat)}g Fat
                    </Badge>
                  </div>
                </div>

                {/* Day's 3 Meals Column Stack */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {day.mealsList.map((meal) => (
                    <MealCard
                      key={meal.id}
                      id={meal.id}
                      mealName={meal.mealName}
                      mealType={meal.mealType}
                      description={meal.description || undefined}
                      calories={meal.calories}
                      proteinG={meal.proteinG}
                      carbsG={meal.carbsG}
                      fatG={meal.fatG}
                      status={meal.status}
                      aiConfidenceFlag={meal.aiConfidenceFlag}
                      ingredients={meal.ingredients}
                      mealLogs={meal.mealLogs}
                      onStatusToggle={handleMealStatusToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
