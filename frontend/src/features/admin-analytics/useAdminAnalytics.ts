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
  activeConditionClearances: number;
  activeClearancesByCondition: Array<{
    condition: string;
    assuranceTier: string;
    provenance: string;
    count: number;
  }>;
  rawRecipeCandidates: number;
  aiUsageByOperation30d: Array<{ operation: string; purpose: string; status: string; count: number }>;
  planSelectionsByProvenance30d: Array<{ provenance: string; count: number }>;
  geminiFromScratchSelectionRate30d: number;
  geminiPlanningInvocationsPer100Selections30d: number;
}

const CACHE_KEY = 'admin-analytics';

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberValue(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown, fallback = 'UNKNOWN'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizeAdminAnalytics(value: unknown): AdminAnalytics | null {
  const record = objectValue(value);
  if (!record) return null;
  const clearances = Array.isArray(record.activeClearancesByCondition) ? record.activeClearancesByCondition : [];
  const aiUsage = Array.isArray(record.aiUsageByOperation30d) ? record.aiUsageByOperation30d : [];
  const selections = Array.isArray(record.planSelectionsByProvenance30d) ? record.planSelectionsByProvenance30d : [];

  return {
    totalUsers: numberValue(record, 'totalUsers'),
    totalNutritionists: numberValue(record, 'totalNutritionists'),
    verifiedNutritionists: numberValue(record, 'verifiedNutritionists'),
    activeMealPlans: numberValue(record, 'activeMealPlans'),
    pendingReviews: numberValue(record, 'pendingReviews'),
    libraryCount: numberValue(record, 'libraryCount'),
    totalMealLogs: numberValue(record, 'totalMealLogs'),
    totalFoodItems: numberValue(record, 'totalFoodItems'),
    totalAliases: numberValue(record, 'totalAliases'),
    overdueReviews: numberValue(record, 'overdueReviews'),
    activeReviewClaims: numberValue(record, 'activeReviewClaims'),
    expiredVerifiedNutritionists: numberValue(record, 'expiredVerifiedNutritionists'),
    completeLibraryEvidence: numberValue(record, 'completeLibraryEvidence'),
    incompleteLibraryEvidence: numberValue(record, 'incompleteLibraryEvidence'),
    staleLibraryEvidence: numberValue(record, 'staleLibraryEvidence'),
    failedGenerationJobs24h: numberValue(record, 'failedGenerationJobs24h'),
    stuckGenerationJobs: numberValue(record, 'stuckGenerationJobs'),
    aiSuccess24h: numberValue(record, 'aiSuccess24h'),
    aiFailures24h: numberValue(record, 'aiFailures24h'),
    adaptationReviews30d: numberValue(record, 'adaptationReviews30d'),
    pendingPlansStartingSoon: numberValue(record, 'pendingPlansStartingSoon'),
    activeConditionClearances: numberValue(record, 'activeConditionClearances'),
    rawRecipeCandidates: numberValue(record, 'rawRecipeCandidates'),
    geminiFromScratchSelectionRate30d: numberValue(record, 'geminiFromScratchSelectionRate30d'),
    geminiPlanningInvocationsPer100Selections30d: numberValue(record, 'geminiPlanningInvocationsPer100Selections30d'),
    activeClearancesByCondition: clearances.flatMap((item) => {
      const row = objectValue(item);
      return row
        ? [
            {
              condition: stringValue(row.condition),
              assuranceTier: stringValue(row.assuranceTier),
              provenance: stringValue(row.provenance),
              count: numberValue(row, 'count'),
            },
          ]
        : [];
    }),
    aiUsageByOperation30d: aiUsage.flatMap((item) => {
      const row = objectValue(item);
      return row
        ? [
            {
              operation: stringValue(row.operation),
              purpose: stringValue(row.purpose, 'UNSPECIFIED'),
              status: stringValue(row.status),
              count: numberValue(row, 'count'),
            },
          ]
        : [];
    }),
    planSelectionsByProvenance30d: selections.flatMap((item) => {
      const row = objectValue(item);
      return row ? [{ provenance: stringValue(row.provenance), count: numberValue(row, 'count') }] : [];
    }),
  };
}

export function useAdminAnalytics() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const initialCached = useRef(normalizeAdminAnalytics(readSessionResource<unknown>(ownerId, CACHE_KEY)));
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
        const next = normalizeAdminAnalytics(response.data.data);
        if (!next) throw new Error('Analytics response was malformed.');
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
