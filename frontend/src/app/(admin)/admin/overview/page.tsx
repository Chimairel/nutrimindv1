'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText,
  BrainCircuit,
  ClipboardCheck,
  Database,
  Gauge,
  ScrollText,
  Stethoscope,
  Tags,
  Users,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Bot,
} from 'lucide-react';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import AnimatedNumber from '@/components/ui/motion/AnimatedNumber';
import { useAdminAnalytics } from '@/features/admin-analytics/useAdminAnalytics';

interface Metric {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminAnalytics();

  if (isLoading) {
    return <PortalLoadingState message="Loading system pulse..." />;
  }
  if (!data) {
    return <div className="mt-20 text-center text-brand-muted">Failed to load analytics.</div>;
  }

  const metrics: Metric[] = [
    {
      label: 'Patient accounts',
      value: data.totalUsers,
      icon: Users,
      tone: 'bg-brand-cyan/10 text-brand-green dark:text-brand-cyan',
    },
    {
      label: 'Verified RNDs',
      value: `${data.verifiedNutritionists}/${data.totalNutritionists}`,
      icon: Stethoscope,
      tone: 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Pending reviews',
      value: data.pendingReviews,
      icon: ClipboardCheck,
      tone: 'text-amber-500 bg-amber-500/10',
    },
    { label: 'Active plans', value: data.activeMealPlans, icon: Gauge, tone: 'text-brand-green bg-brand-green/10' },
    { label: 'Meal library', value: data.libraryCount, icon: BookOpenText, tone: 'bg-brand-green/10 text-brand-green' },
    {
      label: 'Meal logs',
      value: data.totalMealLogs,
      icon: ScrollText,
      tone: 'bg-brand-cyan/10 text-brand-green dark:text-brand-cyan',
    },
    { label: 'FNRI foods', value: data.totalFoodItems, icon: Database, tone: 'bg-brand-accent/20 text-brand-green' },
    { label: 'Food aliases', value: data.totalAliases, icon: Tags, tone: 'bg-brand-green/10 text-brand-green' },
  ];
  const operationalSignals: Metric[] = [
    {
      label: 'Reviews overdue >2h',
      value: data.overdueReviews,
      icon: AlertTriangle,
      tone: data.overdueReviews > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Plans starting within 48h still pending',
      value: data.pendingPlansStartingSoon,
      icon: ClipboardCheck,
      tone: data.pendingPlansStartingSoon > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Stuck generation jobs',
      value: data.stuckGenerationJobs,
      icon: Activity,
      tone: data.stuckGenerationJobs > 0 ? 'bg-red-500/10 text-red-400' : 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Generation failures · 24h',
      value: data.failedGenerationJobs24h,
      icon: AlertTriangle,
      tone: data.failedGenerationJobs24h > 0 ? 'bg-red-500/10 text-red-400' : 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Expired verified RND licenses',
      value: data.expiredVerifiedNutritionists,
      icon: ShieldAlert,
      tone: data.expiredVerifiedNutritionists > 0 ? 'bg-red-500/10 text-red-400' : 'bg-brand-green/10 text-brand-green',
    },
    {
      label: 'Progress reviews recommended · 30d',
      value: data.adaptationReviews30d,
      icon: Stethoscope,
      tone: 'bg-brand-cyan/10 text-brand-cyan',
    },
  ];

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={BrainCircuit}
        eyebrow="Administration"
        title="Platform command center"
        description="A live operational view of NutriMind accounts, professional verification, meal workflows, and nutrition data."
        meta={
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan shadow-[0_0_9px_rgba(34,211,238,0.8)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">Live system pulse</span>
          </div>
        }
      />

      <div>
        <p className="portal-section-label mb-4">Operational metrics</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} interactive className="group p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-brand-muted">Live</span>
                </div>
                <p className="mt-8 font-display text-3xl font-black tracking-[-0.04em] text-brand-text">
                  {typeof metric.value === 'number' ? <AnimatedNumber value={metric.value} /> : metric.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{metric.label}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="portal-section-label">Operations and safety queues</p>
          <span className="font-mono text-[9px] uppercase tracking-wider text-brand-muted">
            {data.activeReviewClaims} active review claims
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {operationalSignals.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="p-5">
                <div className="flex items-center gap-4">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${metric.tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-black text-brand-text">
                      {typeof metric.value === 'number' ? <AnimatedNumber value={metric.value} /> : metric.value}
                    </p>
                    <p className="text-xs text-brand-muted">{metric.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
              <BookOpenText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-text">Reusable library evidence</p>
              <p className="text-xs text-brand-muted">
                Operational approval and reusable certification are tracked separately.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-brand-green/10 p-3">
              <strong className="block text-xl text-brand-green">
                <AnimatedNumber value={data.completeLibraryEvidence} />
              </strong>
              <span className="text-[9px] uppercase text-brand-muted">Certified</span>
            </div>
            <div className="rounded-xl bg-brand-bgAlt/60 p-3">
              <strong className="block text-xl text-brand-text">
                <AnimatedNumber value={data.incompleteLibraryEvidence} />
              </strong>
              <span className="text-[9px] uppercase text-brand-muted">Incomplete</span>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3">
              <strong className="block text-xl text-amber-500">
                <AnimatedNumber value={data.staleLibraryEvidence} />
              </strong>
              <span className="text-[9px] uppercase text-brand-muted">Stale</span>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-cyan">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-text">Gemini usage pulse · 24h</p>
              <p className="text-xs text-brand-muted">
                Counts requests only; prompts and health details are never stored in telemetry.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-brand-green/10 p-3">
              <strong className="block text-xl text-brand-green">
                <AnimatedNumber value={data.aiSuccess24h} />
              </strong>
              <span className="text-[9px] uppercase text-brand-muted">Succeeded</span>
            </div>
            <div className="rounded-xl bg-red-500/10 p-3">
              <strong className="block text-xl text-red-400">
                <AnimatedNumber value={data.aiFailures24h} />
              </strong>
              <span className="text-[9px] uppercase text-brand-muted">Failed</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
