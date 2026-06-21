'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Coffee, Sun, Moon, Apple, Utensils, CheckCircle } from 'lucide-react';

interface ApprovedMeal {
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  nutritionistNote: string | null;
  reviewedAt: string;
  scheduledDate: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function NutritionistApprovedPage() {
  const [meals, setMeals] = useState<ApprovedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const res = await api.get('/nutritionist/approved');
        if (res.data?.success) {
          setMeals(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch approved meals:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApproved();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const mealTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    BREAKFAST: { label: 'Breakfast', icon: <Coffee className="w-4 h-4 text-brand-green" /> },
    LUNCH: { label: 'Lunch', icon: <Sun className="w-4 h-4 text-amber-500" /> },
    DINNER: { label: 'Dinner', icon: <Moon className="w-4 h-4 text-indigo-400" /> },
    SNACK: { label: 'Snack', icon: <Apple className="w-4 h-4 text-red-500" /> },
  };

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6 text-left">
      {/* Header */}
      <div className="border-b border-brand-border/60 pb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-brand-green shrink-0" />
          <h1 className="text-2xl font-extrabold text-brand-text font-display">Approved Plans</h1>
        </div>
        <p className="text-xs text-brand-muted mt-1 uppercase tracking-wider font-semibold">
          Meal plans you have reviewed and approved
        </p>
      </div>

      {meals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-8 w-8 text-brand-green" />}
          title="No Approved Plans Yet"
          description="Meals you approve from the review queue will appear here."
        />
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => {
            const type = mealTypeLabels[meal.mealType] || { label: meal.mealType, icon: <Utensils className="w-4 h-4 text-brand-muted" /> };
            const reviewDate = new Date(meal.reviewedAt);
            const isValidDate = !isNaN(reviewDate.getTime());

            return (
              <Card key={meal.id} className="p-5 border border-brand-green/20 hover:border-brand-green/40 transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {type.icon}
                      <span className="text-xs font-extrabold tracking-wider text-brand-muted uppercase">{type.label}</span>
                      <Badge variant="verified" className="text-[10px]">Approved</Badge>
                    </div>

                    <h3 className="text-sm font-bold text-brand-text mb-2">{meal.mealName}</h3>

                    {/* Macros */}
                    <div className="flex gap-2 flex-wrap mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20 font-bold">
                        {Math.round(meal.calories)} kcal
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 font-bold">
                        {Math.round(meal.proteinG)}g P
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 border border-amber-500/20 font-bold">
                        {Math.round(meal.carbsG)}g C
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20 font-bold">
                        {Math.round(meal.fatG)}g F
                      </span>
                    </div>

                    {/* Patient Info */}
                    <div className="text-[10px] text-brand-muted">
                      <span>Patient: <strong className="text-brand-text">{meal.user.name}</strong></span>
                      {meal.nutritionistNote && (
                        <span className="ml-3">• Note: <em>{meal.nutritionistNote}</em></span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-brand-muted">
                      {isValidDate
                        ? reviewDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                        : '—'
                      }
                    </div>
                    <div className="text-[10px] text-brand-muted">
                      {isValidDate
                        ? reviewDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                        : ''
                      }
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

