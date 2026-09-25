'use client';

import ReportHistory from '@/features/reports/ReportHistory';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { NutritionReport } from '@/types';
import { AlertTriangle, ClipboardList, Download, XCircle, Check, Droplet, Database, ShieldCheck } from 'lucide-react';
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
    return <PortalLoadingState fullScreen message="Analyzing metrics & compiling standard FNRI data..." />;
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 border-brand-border/60 bg-brand-surface/30">
          <AlertTriangle className="w-12 h-12 text-status-error-text mx-auto mb-4" />
          <h3 className="text-lg font-bold font-display text-brand-text mb-2">Report Resolution Failed</h3>
          <p className="text-xs text-brand-muted leading-relaxed mb-6">{error || 'An unexpected error occurred.'}</p>
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
      <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6 text-center text-brand-text">
        <Card className="max-w-lg border-status-pending-text/30 bg-brand-surface/90 p-8 shadow-card-lg">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-status-pending-text" />
          <p className="portal-kicker !text-status-pending-text">Health context changed</p>
          <h1 className="mt-3 font-display text-2xl font-black">Your nutrition report needs an update</h1>
          <p className="mt-3 text-sm leading-6 text-brand-muted">
            Your conditions, allergies, intolerances, or avoided foods changed after this report was created. The older
            guidance is hidden so it cannot conflict with your current health profile.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-xs font-semibold text-status-error-text">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={handleRegenerate} isLoading={isRegenerating} className="mt-6 w-full">
            Generate updated report
          </Button>
          <ReportHistory history={history} />
        </Card>
      </div>
    );
  }

  // Format array elements cleanly
  const renderList = (items: unknown) => {
    let arr: unknown[] = [];
    if (Array.isArray(items)) {
      arr = items;
    } else if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        arr = [];
      }
    }
    return (
      <ul className="flex flex-col gap-2.5">
        {arr
          .filter((item): item is string => typeof item === 'string')
          .map((item, idx) => (
            <li
              key={idx}
              className="text-xs leading-relaxed text-brand-text flex items-start gap-2 bg-brand-bgAlt/50 p-2.5 rounded-xl border border-brand-border/40"
            >
              <span className="text-brand-green text-sm leading-none">•</span>
              <span>{item}</span>
            </li>
          ))}
      </ul>
    );
  };

  const formatRestrictionLabel = (restriction: string) =>
    restriction
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <div className="min-h-screen overflow-x-clip bg-brand-bg text-brand-text p-4 md:p-8 flex flex-col gap-5 pb-48 relative">
      <div className="absolute top-[10%] left-[50%] translate-x-[-50%] h-[400px] w-full max-w-[600px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Link
        href="/profile"
        className="mx-auto w-full max-w-6xl text-sm font-semibold text-brand-green hover:underline inline-flex items-center gap-1.5"
      >
        ← Back to Profile
      </Link>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-6 max-w-6xl mx-auto w-full text-left">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-6 h-6 text-brand-green shrink-0" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green">
              Personalized nutrition guidance
            </h1>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-brand-muted md:text-sm">
            Built from your current profile, calculated nutrition target, structured restrictions, and Philippine food
            references.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 text-xs font-semibold py-2"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF</span>
        </Button>
      </div>

      <p className="mx-auto w-full max-w-6xl text-sm text-brand-muted">
        Version {report.version} · Prepared {new Date(report.generatedAt).toLocaleDateString()}
        {report.acknowledgedAt ? ' · Acknowledged' : ''}
      </p>
      {/* Main layout container */}
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-green">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                How KAINARA prepared this guidance
              </p>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-brand-muted md:text-sm">
                Your saved health profile and calculated target define the context. FNRI food references ground local
                choices, while AI assists in drafting the personalized guidance.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-brand-bg/50 px-3 py-1.5 text-brand-green">
                <Check className="h-3 w-3" aria-hidden="true" /> Current profile matched
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/20 bg-brand-bg/50 px-3 py-1.5 text-brand-green">
                <Database className="h-3 w-3" aria-hidden="true" /> FNRI referenced
              </span>
            </div>
          </div>
          <p className="mt-3 border-t border-brand-green/15 pt-3 text-[11px] leading-relaxed text-brand-muted md:text-xs">
            Meal approval remains a separate safeguard. Every planned meal follows an eligibility and safety-evidence
            path, with RND review required whenever reviewed reusable evidence is unavailable.
          </p>
        </div>

        {/* Core Summary card */}
        <Card className="p-6 border-brand-border/60 bg-gradient-to-br from-brand-surface to-brand-bgAlt relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-32 bg-brand-green/5 blur-xl rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-between text-left">
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">Name</span>
              <p className="text-base font-bold text-brand-text font-display">
                {profileData?.name || user?.name || 'User'}
              </p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">
                Active Goal
              </span>
              <Badge variant="verified">
                {profileData?.goal?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Maintain'}
              </Badge>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">
                Calorie Target
              </span>
              <p className="text-xl font-extrabold text-brand-green font-display">
                {profileData?.dailyCalorieTarget ? profileData.dailyCalorieTarget.toLocaleString() : '—'} kcal{' '}
                <span className="text-xs font-normal text-brand-muted">/ day</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] tracking-wider font-bold text-brand-muted uppercase block mb-1">
                Safety Profile
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {profileData && (profileData.conditions.length > 0 || profileData.allergies.length > 0) ? (
                  [...profileData.conditions, ...profileData.allergies].map((restriction, idx) =>
                    restriction ? (
                      <Badge key={idx} variant="rejected">
                        {formatRestrictionLabel(String(restriction))}
                      </Badge>
                    ) : null
                  )
                ) : (
                  <span className="text-xs text-brand-muted">None reported</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Narrative General Summary */}
        <Card className="p-6 border-brand-border/60 bg-brand-surface/40">
          <h3 className="text-sm font-bold tracking-wide uppercase text-brand-green mb-2 font-display">
            Your nutrition summary
          </h3>
          <p className="text-xs md:text-sm text-brand-muted leading-relaxed">{report.generalSummary}</p>
        </Card>

        {/* Mobile Layout: Responsive Tab View */}
        <div className="md:hidden">
          <Tabs defaultValue="avoid">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="avoid" className="flex-1">
                Avoid
              </TabsTrigger>
              <TabsTrigger value="limit" className="flex-1">
                Limit
              </TabsTrigger>
              <TabsTrigger value="good" className="flex-1">
                Suggested
              </TabsTrigger>
              <TabsTrigger value="drinks" className="flex-1">
                Drinks
              </TabsTrigger>
            </TabsList>
            <TabsContent value="avoid">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-status-error-text tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <XCircle className="w-4 h-4 text-status-error-text shrink-0" />
                  <span>Foods to avoid</span>
                </h4>
                {renderList(report.foodsToAvoid)}
              </Card>
            </TabsContent>
            <TabsContent value="limit">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-status-pending-text tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <AlertTriangle className="w-4 h-4 text-status-pending-text shrink-0" />
                  <span>Foods to Limit/Control portions</span>
                </h4>
                {renderList(report.foodsToLimit)}
              </Card>
            </TabsContent>
            <TabsContent value="good">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-brand-green tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <Check className="w-4 h-4 text-brand-green stroke-[3px] shrink-0" />
                  <span>Recommended Foods to increase</span>
                </h4>
                {renderList(report.foodsRecommended)}
              </Card>
            </TabsContent>
            <TabsContent value="drinks">
              <Card className="p-5 mt-2 bg-brand-surface/20 border-brand-border/50">
                <h4 className="text-xs font-bold text-blue-400 tracking-wide uppercase mb-4 flex items-center gap-1.5 font-display">
                  <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Drinks guidance</span>
                </h4>
                {renderList(report.drinksGuidance)}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop Layout: Sleek Grid Columns */}
        <div className="hidden md:grid grid-cols-4 gap-6">
          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-status-error-text tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <XCircle className="w-4 h-4 text-status-error-text shrink-0" />
              <span>Foods to Avoid</span>
            </h4>
            {renderList(report.foodsToAvoid)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-status-pending-text tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <AlertTriangle className="w-4 h-4 text-status-pending-text shrink-0" />
              <span>Foods to Limit</span>
            </h4>
            {renderList(report.foodsToLimit)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-brand-green tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <Check className="w-4 h-4 text-brand-green stroke-[3px] shrink-0" />
              <span>Recommended</span>
            </h4>
            {renderList(report.foodsRecommended)}
          </Card>

          <Card className="p-5 bg-brand-surface/20 border-brand-border/50">
            <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase mb-4 flex items-center gap-1.5 font-display">
              <Droplet className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Drinks guidance</span>
            </h4>
            {renderList(report.drinksGuidance)}
          </Card>
        </div>
      </div>

      <ReportHistory history={history} />
      {/* Show acknowledgement only when this version needs it. */}
      {!report.acknowledgedAt && (
        <div className="sticky bottom-24 md:bottom-0 z-30 bg-brand-surface/90 border-t border-brand-border py-4 px-6 backdrop-blur-md shadow-2xl flex items-center justify-center">
          <div className="max-w-6xl w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-[11px] md:text-xs text-brand-muted leading-relaxed max-w-2xl text-center md:text-left">
              By continuing, you confirm that the profile, target, and restrictions shown above are current and that you
              have reviewed this guidance. It supports meal planning and does not replace personal advice from your
              doctor or Registered Nutritionist-Dietitian.
            </p>
            <Button
              variant="primary"
              onClick={handleAcknowledge}
              className="px-8 py-3 text-sm font-bold tracking-wide shadow-xl min-w-[200px]"
              isLoading={isAcknowledging}
            >
              Acknowledge and Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
