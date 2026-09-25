'use client';

import ReportHistory from '@/features/reports/ReportHistory';
import NutritionGuidanceDocument from '@/features/reports/NutritionGuidanceDocument';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { NutritionReport } from '@/types';
import { AlertTriangle } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasSameRestrictionContext, normalizeRestrictionContext } from '@/lib/restriction-context';
import { toast } from '@/components/ui/Sonner';
import type { PlanningReadiness } from '@/types/planning-readiness';

export default function NutritionReportPage() {
  const router = useRouter();
  const { user, refreshSession, updateUserSession } = useAuth();
  const userId = user?.userId;
  const [history, setHistory] = useState<
    Array<{ id: string; version: number; generatedAt: string; content: NutritionReport }>
  >([]);
  const [report, setReport] = useState<NutritionReport | null>(null);
  const [profileData, setProfileData] = useState<{
    name: string;
    goal: string;
    dailyCalorieTarget: number;
    conditions: string[];
    allergies: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const extractRestrictionKeys = (values: unknown, objectKey: 'condition' | 'allergen') => {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && objectKey in value) {
          const candidate = (value as Record<string, unknown>)[objectKey];
          return typeof candidate === 'string' ? candidate : '';
        }
        return '';
      })
      .filter((value) => value && value !== 'NONE');
  };

  const extractStructuredRestrictions = (values: unknown, domainGroup: 'condition' | 'food') => {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
      .filter((entry) =>
        domainGroup === 'condition'
          ? entry.domain === 'CONDITION'
          : entry.domain === 'ALLERGY' || entry.domain === 'INTOLERANCE' || entry.domain === 'AVOIDED_INGREDIENT'
      )
      .map((entry) =>
        typeof entry.canonicalCode === 'string' && entry.canonicalCode
          ? entry.canonicalCode
          : typeof entry.displayName === 'string'
            ? entry.displayName
            : ''
      )
      .filter((value) => value && value !== 'NONE');
  };

  const applyProfile = useCallback((p: Record<string, unknown>) => {
    const structuredConditions = extractStructuredRestrictions(p.safetyEntries, 'condition');
    const structuredFoodRestrictions = extractStructuredRestrictions(p.safetyEntries, 'food');
    setProfileData({
      name: typeof p.name === 'string' ? p.name : 'User',
      goal: (p.userProfile as { goal?: string } | undefined)?.goal || 'MAINTAIN',
      dailyCalorieTarget: (p.userProfile as { dailyCalorieTarget?: number } | undefined)?.dailyCalorieTarget || 0,
      conditions: normalizeRestrictionContext(
        structuredConditions ?? extractRestrictionKeys(p.healthConditions, 'condition')
      ),
      allergies: normalizeRestrictionContext(
        structuredFoodRestrictions ?? extractRestrictionKeys(p.allergies, 'allergen')
      ),
    });
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Parallelize fetching profile, history, and existing report
        const [profileRes, historyRes, getRes] = await Promise.all([
          api.get('/user/profile'),
          api.get('/user/nutrition-report/history').catch(() => ({ data: { data: [] } })),
          api.get('/user/nutrition-report'),
        ]);

        if (profileRes.data?.success) applyProfile(profileRes.data.data);

        setHistory(historyRes.data?.data || []);

        // Try getting existing report first
        const activeRevision = profileRes.data?.data?.userProfile?.revision;
        const existingReport = getRes?.data?.data;
        const isReportFresh =
          existingReport &&
          !existingReport.isStale &&
          (activeRevision === undefined ||
            existingReport.profileRevision === undefined ||
            existingReport.profileRevision === activeRevision);

        if (getRes?.data && getRes.data.success && isReportFresh) {
          setReport(getRes.data.data);
        } else {
          // If none exists, is stale, or out of sync with current profile revision, trigger a generation
          const genRes = await api.post('/user/nutrition-report/generate');
          if (genRes.data && genRes.data.success) {
            setReport(genRes.data.data);
            const freshHistory = await api.get('/user/nutrition-report/history').catch(() => ({ data: { data: [] } }));
            setHistory(freshHistory.data?.data || []);
          } else {
            setError('Failed to load your nutrition report.');
          }
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'Unable to load your customized report. Please verify your connection.'));
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchReport();
    }
  }, [userId, applyProfile]);

  const handleAcknowledge = async () => {
    if (!report || report.isStale) return;
    setError(null);
    setIsAcknowledging(true);
    try {
      const acknowledgment = await api.post('/user/nutrition-report/acknowledge', { version: report?.version });

      // Confirm current server state before continuing to a meal action.
      const refreshed = await refreshSession();
      if (!refreshed?.reportAcknowledged) {
        setError('Unable to confirm the current report status. Please reload before continuing.');
        return;
      }

      const readiness = acknowledgment.data?.data?.planningReadiness as PlanningReadiness | undefined;
      if (readiness) {
        const options = {
          description: readiness.message,
          duration: 9000,
          action: readiness.canRequestPlan
            ? undefined
            : { label: 'Review context', onClick: () => router.push(readiness.actionPath) },
        };
        if (!readiness.canRequestPlan) toast.warning(readiness.title, options);
        else if (readiness.status === 'REQUEST_ALLOWED_REVIEW_EXPECTED') toast.info(readiness.title, options);
        else toast.success(readiness.title, options);
        window.dispatchEvent(new Event('nutrimind:notifications-updated'));
      }

      // Only support the explicit internal continuation, never an arbitrary redirect URL.
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(
        readiness?.canRequestPlan === false
          ? readiness.actionPath
          : next === 'regenerate' ? '/meals?regenerate=true' : next === 'dashboard' ? '/dashboard' : '/profile'
      );
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 409) {
        setReport((current) => (current ? { ...current, isStale: true } : current));
      }
      setError(getApiErrorMessage(err, 'Failed to acknowledge the report. Please try again.'));
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleRegenerate = async () => {
    setError(null);
    setIsRegenerating(true);
    try {
      const response = await api.post('/user/nutrition-report/generate');
      if (!response.data?.success || !response.data.data) {
        throw new Error('The updated report was not returned.');
      }
      setReport(response.data.data);
      updateUserSession({ reportAcknowledged: false });
      const profileResponse = await api.get('/user/profile');
      if (profileResponse.data?.success) applyProfile(profileResponse.data.data);
      setHistory((await api.get('/user/nutrition-report/history')).data.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to regenerate your report. Please try again.'));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Stream PDF directly from backend PDF endpoint
      const response = await api.get('/user/nutrition-report/pdf', {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `KAINARA_Nutrition_Report_${user?.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileURL);
    } catch (err) {
      console.error('[Nutrition Report] Failed to fetch report PDF:', err);
      setError('Could not download the current report. Refresh it and try again.');
    }
  };

  if (isLoading) {
    return <PortalLoadingState fullScreen message="Preparing your nutrition guidance..." />;
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center text-slate-900">
        <Card className="max-w-md p-8 border-slate-300 bg-white">
          <AlertTriangle className="w-12 h-12 text-status-error-text mx-auto mb-4" />
          <h3 className="mb-2 text-lg font-bold text-slate-900">Report Resolution Failed</h3>
          <p className="mb-6 text-sm leading-relaxed text-slate-700">{error || 'An unexpected error occurred.'}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
          <ReportHistory history={history} />
        </Card>
      </div>
    );
  }

  const reportMatchesCurrentProfile =
    !report.isStale && profileData
      ? hasSameRestrictionContext(report.basedOnConditions, profileData.conditions) &&
        hasSameRestrictionContext(report.basedOnAllergies, profileData.allergies)
      : false;

  if (!reportMatchesCurrentProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-center text-slate-900">
        <Card className="max-w-lg border-slate-300 bg-white p-8 shadow-card-lg">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-status-pending-text" />
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Health context changed</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Your nutrition guidance needs an update</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Your conditions, allergies, intolerances, or avoided foods changed after this report was created. The older
            guidance is hidden so it cannot conflict with your current health profile.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-xs font-semibold text-status-error-text">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={handleRegenerate} isLoading={isRegenerating} className="mt-6 w-full">
            Prepare updated guidance
          </Button>
          <ReportHistory history={history} />
        </Card>
      </div>
    );
  }

  if (report.reportPolicyVersion && report.referenceItems) {
    return <NutritionGuidanceDocument
      report={report}
      name={profileData?.name || user?.name || 'User'}
      goal={profileData?.goal || 'MAINTAIN'}
      dailyCalorieTarget={profileData?.dailyCalorieTarget || 0}
      conditions={profileData?.conditions || []}
      foodRestrictions={profileData?.allergies || []}
      history={history}
      error={error}
      isAcknowledging={isAcknowledging}
      onAcknowledge={handleAcknowledge}
      onDownload={handleDownloadPDF}
    />;
  }

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Nutrition guidance needs an update</h1>
        <p className="mt-3">This report uses an older format. Prepare a current, source-linked version before continuing.</p>
        {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
        <button type="button" onClick={handleRegenerate} disabled={isRegenerating}
          className="mt-5 rounded bg-slate-900 px-5 py-3 text-white disabled:opacity-50">
          {isRegenerating ? 'Preparing...' : 'Prepare current guidance'}
        </button>
        <ReportHistory history={history} />
      </div>
    </main>
  );
}
