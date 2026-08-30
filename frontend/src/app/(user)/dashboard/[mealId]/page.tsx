'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { 
  ArrowLeft, 
  Coffee, 
  Sun, 
  Moon, 
  Apple, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import axios from 'axios';
import { MealType, MealPlanStatus } from '@/types';

interface Ingredient {
  id: string;
  ingredientName: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}

interface MealDetail {
  id: string;
  mealName: string;
  mealType: MealType;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  scheduledDate: string;
  ingredients: Ingredient[];
  mealLogs: MealLog[];
}

export default function MealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const mealId = params.mealId as string;

  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMealDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/user/meals/${mealId}`);
      if (res.data && res.data.success) {
        setMeal(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to retrieve meal details.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [mealId]);

  useEffect(() => {
    if (mealId) {
      fetchMealDetails();
    }
  }, [mealId, fetchMealDetails]);

  const handleUpdateStatus = async (newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    if (isUpdating || !meal) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.patch(`/user/meals/${meal.id}/status`, { status: newStatus });
      // Reload details to sync local states
      const res = await api.get(`/user/meals/${meal.id}`);
      if (res.data && res.data.success) {
        setMeal(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to update status.');
      } else {
        setError('Failed to reach server.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !meal) {
    return (
      <div className="portal-page max-w-3xl text-left text-brand-text">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-brand-text mb-6 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Dashboard</span>
        </button>
        <Card className="p-6 border-brand-border bg-brand-surface/30">
          <div className="flex items-center gap-2 text-status-error-text mb-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-base font-bold">Error Loading Meal Details</h3>
          </div>
          <p className="text-sm text-brand-muted">{error || 'Meal record not found.'}</p>
        </Card>
      </div>
    );
  }

  // Evaluate past date condition
  const isPastDate = (() => {
    if (!meal.scheduledDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(meal.scheduledDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  })();

  // Check if meal is logged as DONE or SKIPPED
  const isCompleted = meal.mealLogs.some((l) => l.status === 'DONE');
  const isSkipped = meal.mealLogs.some((l) => l.status === 'SKIPPED') || 
    (!meal.mealLogs.some((l) => l.status === 'DONE' || l.status === 'SKIPPED' || (l.status === 'PENDING' && l.source !== 'SAFETY_REPLACED')) && isPastDate);
  const isLogged = isCompleted || isSkipped;

  const mealTypeLabels: Record<MealType, { label: string; icon: React.ComponentType<LucideProps> }> = {
    BREAKFAST: { label: 'Breakfast', icon: Coffee },
    LUNCH: { label: 'Lunch', icon: Sun },
    DINNER: { label: 'Dinner', icon: Moon },
    SNACK: { label: 'Snack', icon: Apple },
  };

  const activeLabel = mealTypeLabels[meal.mealType];
  const Icon = activeLabel.icon;

  return (
    <div className="portal-page max-w-3xl select-none text-left text-brand-text animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back to Dashboard Button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-brand-text mb-6 group transition-colors outline-none"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to Dashboard</span>
      </button>

      {/* Main Meal Details Card */}
      <Card className="relative overflow-hidden border-brand-border/70 bg-brand-surface/75 p-6 shadow-card-lg md:p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />

        {/* Header Block */}
        <div className="mb-6 flex items-start gap-3.5 rounded-[24px] bg-[#07100d] p-5 text-white shadow-card">
          <div className="mt-0.5 shrink-0 rounded-2xl bg-brand-accent p-3 text-[#07100d] shadow-neon">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-accent">
              {activeLabel.label} Details
            </span>
            <h1 className="mt-0.5 font-display text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
              {meal.mealName}
            </h1>
            <span className="mt-1 block text-xs font-bold text-white/40">
              {Math.round(meal.calories)} kcal Total Energy
            </span>
          </div>
        </div>

        {/* Macro Budges Section */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div 
            className="border rounded-2xl p-3 text-center"
            style={{ 
              backgroundColor: 'var(--macro-protein-bg)',
              borderColor: 'var(--macro-protein-border)'
            }}
          >
            <span className="block text-lg font-black font-display leading-none" style={{ color: 'var(--macro-protein)' }}>
              {Math.round(meal.proteinG)}g
            </span>
            <span className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider" style={{ color: 'var(--macro-protein)' }}>
              Protein
            </span>
          </div>
          
          <div 
            className="border rounded-2xl p-3 text-center"
            style={{ 
              backgroundColor: 'var(--macro-carbs-bg)',
              borderColor: 'var(--macro-carbs-border)'
            }}
          >
            <span className="block text-lg font-black font-display leading-none" style={{ color: 'var(--macro-carbs)' }}>
              {Math.round(meal.carbsG)}g
            </span>
            <span className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider" style={{ color: 'var(--macro-carbs)' }}>
              Carbs
            </span>
          </div>

          <div 
            className="border rounded-2xl p-3 text-center"
            style={{ 
              backgroundColor: 'var(--macro-fat-bg)',
              borderColor: 'var(--macro-fat-border)'
            }}
          >
            <span className="block text-lg font-black font-display leading-none" style={{ color: 'var(--macro-fat)' }}>
              {Math.round(meal.fatG)}g
            </span>
            <span className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider" style={{ color: 'var(--macro-fat)' }}>
              Fat
            </span>
          </div>
        </div>

        {/* Details and Ingredients */}
        <div className="flex flex-col gap-6 mb-6">
          <div>
            <h3 className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase mb-2">Description</h3>
            <p className="text-xs text-brand-text/95 leading-relaxed font-semibold">
              {meal.description || "This meal is part of your AI generation plan. Check ingredients and follow the instructions to prepare it."}
            </p>
          </div>

          {/* YouTube Cooking Tutorial Banner */}
          <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">📺</span>
              <div>
                <h5 className="text-xs font-bold text-brand-text leading-tight">Need cooking help?</h5>
                <p className="text-[10px] text-brand-muted mt-1 leading-snug">Watch Filipino cooking tutorials for this dish on YouTube.</p>
              </div>
            </div>
            <a
              href={`https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(meal.mealName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0"
            >
              Watch Video
            </a>
          </div>

          {meal.ingredients.length > 0 && (
            <div>
              <h3 className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase mb-2">Ingredients List</h3>
              <div className="flex flex-wrap gap-1.5">
                {meal.ingredients.map((ing) => (
                  <span 
                    key={ing.id} 
                    className="text-[10px] bg-brand-bgAlt border border-brand-border text-brand-text px-2.5 py-1.5 rounded-lg leading-none font-bold"
                  >
                    {ing.ingredientName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Estimation Warning */}
        {meal.status === 'PENDING_REVIEW' && (
          <div className="p-4 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-bold leading-relaxed flex items-start gap-2.5 mb-6">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>
              <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed Registered Nutritionist-Dietitian. Use with caution.
            </span>
          </div>
        )}

        {/* Actions Button panel */}
        <div className="border-t border-brand-border/60 pt-6 mt-4">
          {!isLogged ? (
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={() => handleUpdateStatus('DONE')}
                disabled={isUpdating}
                className="w-full font-bold py-3 text-xs tracking-wider uppercase shadow-lg shadow-brand-green/10"
              >
                Mark as Eaten
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleUpdateStatus('SKIPPED')}
                disabled={isUpdating}
                className="w-full font-bold text-xs py-3 bg-red-500/10 border border-red-500/25 text-red-500 hover:bg-red-600 hover:text-white uppercase tracking-wider transition-colors"
              >
                Skip Meal
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                {isCompleted && (
                  <Badge variant="verified" showIcon={false} className="text-[10px] font-extrabold py-1 px-3 bg-brand-green/10 text-brand-green border-brand-green/20 flex items-center gap-1 uppercase tracking-wider">
                    <Check className="h-3 w-3" /> Marked as Eaten
                  </Badge>
                )}
                {isSkipped && (
                  <Badge variant="rejected" showIcon={false} className="text-[10px] font-extrabold py-1 px-3 bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1 uppercase tracking-wider">
                    <X className="h-3 w-3" /> Marked as Skipped
                  </Badge>
                )}
              </div>
              
              <Button
                variant="secondary"
                onClick={() => handleUpdateStatus('PENDING')}
                disabled={isUpdating}
                className="w-full font-bold py-3 text-xs border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 uppercase tracking-wider"
              >
                Reset Meal Status
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
