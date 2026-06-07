'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';

interface LibraryMeal {
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  description?: string;
  usageCount: number;
  addedAt: string;
}

export default function MealLibraryPage() {
  const [meals, setMeals] = useState<LibraryMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/nutritionist/library');
        if (res.data?.success) setMeals(res.data.data);
      } catch (err) {
        console.error('Failed to fetch library:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><span className="text-brand-muted animate-pulse">Loading library...</span></div>;
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-text font-display">Meal Library</h1>
        <span className="text-xs text-brand-muted">{meals.length} verified meals</span>
      </div>

      {meals.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="text-5xl block mb-4">📚</span>
          <p className="text-brand-muted">The library is empty. Approved meals will appear here.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {meals.map((meal) => (
            <Card key={meal.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-brand-text">{meal.mealName}</h3>
                <span className="text-[10px] text-brand-muted bg-brand-border/40 px-2 py-1 rounded-md">{meal.mealType}</span>
              </div>
              {meal.description && (
                <p className="text-xs text-brand-muted line-clamp-1 mb-2">{meal.description}</p>
              )}
              <div className="flex gap-3 text-xs text-brand-muted">
                <span>🔥 {meal.calories} kcal</span>
                <span>P: {meal.proteinG}g</span>
                <span>C: {meal.carbsG}g</span>
                <span>F: {meal.fatG}g</span>
                <span className="ml-auto">Used {meal.usageCount}x</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
