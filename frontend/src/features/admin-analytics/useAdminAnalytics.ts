'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

export interface AdminAnalytics {
  totalUsers: number;
  totalNutritionists: number;
  verifiedNutritionists: number;
  activeMealPlans: number;
  pendingReviews: number;
  libraryCount: number;
  totalMealLogs: number;
  totalFoodItems: number;
  totalAliases: number;
  overdueReviews: number;
  activeReviewClaims: number;
  expiredVerifiedNutritionists: number;
  completeLibraryEvidence: number;
  incompleteLibraryEvidence: number;
  staleLibraryEvidence: number;
  failedGenerationJobs24h: number;
  stuckGenerationJobs: number;
  aiSuccess24h: number;
  aiFailures24h: number;
  adaptationReviews30d: number;
  pendingPlansStartingSoon: number;
}

const CACHE_KEY = 'admin-analytics';

export function useAdminAnalytics() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const initialCached = useRef(readSessionResource<AdminAnalytics>(ownerId, CACHE_KEY));
  const [data, setData] = useState<AdminAnalytics | null>(initialCached.current);
  const [isLoading, setIsLoading] = useState(!initialCached.current);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;

    let active = true;
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/admin/analytics');
        if (!active || !response.data?.success) return;
        const next = response.data.data as AdminAnalytics;
        setData(next);
        writeSessionResource(ownerId, CACHE_KEY, next);
        setError(null);
      } catch (reason) {
        console.error('Failed to fetch analytics:', reason);
        if (active && !initialCached.current) setError('Failed to load analytics.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchAnalytics();
    return () => {
      active = false;
    };
  }, [ownerId]);

  return { data, error, isLoading };
}
