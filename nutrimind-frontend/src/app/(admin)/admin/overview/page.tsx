'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

interface Analytics {
  totalUsers: number;
  totalNutritionists: number;
  verifiedNutritionists: number;
  activeMealPlans: number;
  pendingReviews: number;
  libraryCount: number;
  totalMealLogs: number;
  totalFoodItems: number;
  totalAliases: number;
}

interface Metric {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/admin/analytics');
        if (response.data?.success) setData(response.data.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><span className="animate-pulse text-brand-muted">Loading system pulse...</span></div>;
  }
  if (!data) {
    return <div className="mt-20 text-center text-brand-muted">Failed to load analytics.</div>;
  }

  const metrics: Metric[] = [
    { label: 'Total users', value: data.totalUsers, icon: Users, tone: 'text-blue-500 bg-blue-500/10' },
    { label: 'Verified RNDs', value: `${data.verifiedNutritionists}/${data.totalNutritionists}`, icon: Stethoscope, tone: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Pending reviews', value: data.pendingReviews, icon: ClipboardCheck, tone: 'text-amber-500 bg-amber-500/10' },
    { label: 'Active plans', value: data.activeMealPlans, icon: Gauge, tone: 'text-brand-green bg-brand-green/10' },
    { label: 'Meal library', value: data.libraryCount, icon: BookOpenText, tone: 'text-violet-500 bg-violet-500/10' },
    { label: 'Meal logs', value: data.totalMealLogs, icon: ScrollText, tone: 'text-cyan-500 bg-cyan-500/10' },
    { label: 'FNRI foods', value: data.totalFoodItems, icon: Database, tone: 'text-lime-600 bg-lime-500/10' },
    { label: 'Food aliases', value: data.totalAliases, icon: Tags, tone: 'text-pink-500 bg-pink-500/10' },
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
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${metric.tone}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-brand-muted">Live</span>
                </div>
                <p className="mt-8 font-display text-3xl font-black tracking-[-0.04em] text-brand-text">{metric.value}</p>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{metric.label}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
