'use client';

import {
  Users,
  Stethoscope,
  CalendarDays,
  CheckCircle2,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  FileText,
} from 'lucide-react';
import WorkspaceMetricStrip from '@/components/shared/WorkspaceMetricStrip';
import { cn } from '@/lib/utils';
import { format, HeroMetricCard } from './AdminStatistics.shared';
import type { useAdminStatisticsModel } from './useAdminStatisticsModel';
type Model = Extract<ReturnType<typeof useAdminStatisticsModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'activeTab' | 'data'> };

export default function PlatformTotalsSection({ model }: SectionProps) {
  const { activeTab, data } = model;
  return (
    <div
      id="analytics-tab-totals"
      role="tabpanel"
      aria-labelledby="analytics-tab-totals-btn"
      hidden={activeTab !== 'totals'}
      className={cn('space-y-6', activeTab !== 'totals' && 'hidden')}
    >
      <section aria-labelledby="platform-totals" className="space-y-4">
        <div>
          <h2 id="platform-totals" className="font-display text-lg font-bold">
            Platform totals
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            Core population scale, clinical capacity, and food database records.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetricCard
            label="Member accounts"
            count={data.totalUsers}
            note="Accounts with the member role, including suspended accounts."
            href="/admin/users"
            icon={Users}
            badgeTone="emerald"
          />
          <HeroMetricCard
            label="Eligible RNDs"
            count={data.verifiedNutritionists}
            note={`Of ${format(data.totalNutritionists)} nutritionist accounts with profiles. Verified, unsuspended, with a current PRC license.`}
            href="/admin/users?tab=nutritionists"
            icon={Stethoscope}
            badgeTone="teal"
          />
          <HeroMetricCard
            label="Current plan cycles"
            count={data.activeMealPlans}
            note="Latest current cycle per active member, based on the Manila date."
            icon={CalendarDays}
            badgeTone="amber"
          />
          <HeroMetricCard
            label="Approved upcoming slots"
            count={data.approvedUpcomingMealSlots}
            note="Recorded approved slots from today onward; excludes superseded plans and safety holds."
            icon={CheckCircle2}
            badgeTone="emerald"
          />
        </div>
      </section>
      <section aria-labelledby="food-estate-title" className="space-y-4">
        <div>
          <h2 id="food-estate-title" className="font-display text-lg font-bold">
            Food catalogue &amp; serving records
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            Government datasets, alias mappings, and approved serving variations
          </p>
        </div>
        <WorkspaceMetricStrip
          label="Food catalogue & serving records"
          metrics={[
            {
              label: 'FNRI food records',
              value: format(data.totalFoodItems),
              detail: 'Food composition records sourced from FNRI.',
              icon: BookOpen,
              href: '/admin/data',
            },
            {
              label: 'USDA food records',
              value: format(data.usdaFoodItems),
              detail: `${format(data.totalAliases)} food aliases across the catalogue.`,
              icon: FileText,
              href: '/admin/data',
            },
            {
              label: 'Library servings',
              value: format(data.libraryCount),
              detail: 'Saved serving records, including variants and archived records.',
              icon: UtensilsCrossed,
              href: '/admin/meals?tab=library',
            },
            {
              label: 'Food logs recorded',
              value: format(data.totalMealLogs),
              detail: 'Logs marked done. Skipped, pending, and voided logs are excluded.',
              icon: ClipboardList,
            },
          ]}
        />
      </section>
    </div>
  );
}
