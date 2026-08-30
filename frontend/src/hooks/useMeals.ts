import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';

export interface MealPlan {
  id: string;
  planGroupId: string;
  mealType: string;
  mealName: string;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: string;
  aiConfidenceFlag: string;
  nutritionistNote?: string;
  scheduledDate: string;
  createdAt: string;
  ingredients: { ingredientName: string; category?: string }[];
}

export function useMeals(date?: string) {
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = date ? { date } : {};
      const res = await api.get('/user/meals/current', { params });
      if (res.data?.success) {
        setMeals(res.data.data);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to fetch meals');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const generateMeals = async () => {
    setIsLoading(true);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data?.success) {
        await fetchMeals();
      }
      return res.data;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to generate meals');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { meals, isLoading, error, generateMeals, refresh: fetchMeals };
}
