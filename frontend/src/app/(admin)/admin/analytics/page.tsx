'use client';

import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, BookOpenText, Bot, ClipboardCheck, Database, Info, ScrollText, Stethoscope, Tags, UtensilsCrossed, Users } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

interface Analytics { totalUsers: number; totalNutritionists: number; verifiedNutritionists: number; activeMealPlans: number; pendingReviews: number; libraryCount: number; totalMealLogs: number; totalFoodItems: number; totalAliases: number; }
interface Metric { label: string; value: number; icon: LucideIcon; tone: string; }

const MetricCard = ({ metric }: { metric: Metric }) => {
  const Icon = metric.icon;
  return <Card className="p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${metric.tone}`}><Icon className="h-[18px] w-[18px]" /></span><p className="mt-6 font-display text-3xl font-black tracking-tight text-brand-text">{metric.value.toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-brand-muted">{metric.label}</p></Card>;
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try { const response = await api.get('/admin/analytics'); if (response.data?.success) setData(response.data.data); }
      catch (error) { console.error('Failed to fetch analytics:', error); }
      finally { setIsLoading(false); }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="mt-20 text-center text-brand-muted">Failed to load analytics data.</div>;

  const verificationRate = data.totalNutritionists > 0 ? Math.round((data.verifiedNutritionists / data.totalNutritionists) * 100) : 0;
  const people: Metric[] = [
    { label: 'Patient accounts', value: data.totalUsers, icon: Users, tone: 'bg-brand-cyan/10 text-brand-green dark:text-brand-cyan' },
    { label: 'Nutritionists', value: data.totalNutritionists, icon: Stethoscope, tone: 'bg-brand-green/10 text-brand-green' },
    { label: 'Verified RNDs', value: data.verifiedNutritionists, icon: ClipboardCheck, tone: 'bg-brand-green/10 text-brand-green' },
  ];
  const meals: Metric[] = [
    { label: 'Active plans', value: data.activeMealPlans, icon: UtensilsCrossed, tone: 'bg-brand-green/10 text-brand-green' },
    { label: 'Pending reviews', value: data.pendingReviews, icon: ClipboardCheck, tone: 'bg-amber-500/10 text-amber-500' },
    { label: 'Meal library', value: data.libraryCount, icon: BookOpenText, tone: 'bg-brand-green/10 text-brand-green' },
    { label: 'Meal logs', value: data.totalMealLogs, icon: ScrollText, tone: 'bg-brand-cyan/10 text-brand-green dark:text-brand-cyan' },
  ];
  const intelligence: Metric[] = [
    { label: 'FNRI food items', value: data.totalFoodItems, icon: Database, tone: 'bg-brand-accent/20 text-brand-green' },
    { label: 'Food aliases', value: data.totalAliases, icon: Tags, tone: 'bg-brand-green/10 text-brand-green' },
  ];

  return (
    <div className="portal-page space-y-8">
      <PortalPageHeader icon={BarChart3} eyebrow="Platform intelligence" title="Analytics observatory" description="Understand adoption, professional coverage, meal activity, and the nutrition-data layer at a glance." />
      <section><p className="portal-section-label mb-4">People and professional coverage</p><div className="grid gap-4 md:grid-cols-3">{people.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
        <Card className="mt-4 p-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold text-brand-text">Nutritionist verification rate</p><p className="mt-1 text-[11px] text-brand-muted">{data.verifiedNutritionists} of {data.totalNutritionists} professional accounts verified</p></div><span className="font-display text-3xl font-black text-brand-green">{verificationRate}%</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-brand-bgAlt"><div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-cyan transition-all duration-500" style={{ width: `${verificationRate}%` }} /></div></Card>
      </section>
      <section><p className="portal-section-label mb-4">Meal system</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{meals.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div></section>
      <section><p className="portal-section-label mb-4">Data and AI layer</p><div className="grid gap-4 md:grid-cols-2">{intelligence.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div><Card className="mt-4 p-5"><div className="flex items-start gap-3 text-xs leading-6 text-brand-muted"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><Info className="h-4 w-4" /></span><p>FNRI food items form the Philippine nutrition-data reference layer. Food aliases support faster ingredient matching across meal-generation and lookup workflows.</p><Bot className="ml-auto hidden h-5 w-5 shrink-0 text-brand-green/50 sm:block" /></div></Card></section>
    </div>
  );
}
