import type { LucideIcon } from 'lucide-react';
import { BookOpenCheck, Database, FileClock, MapPinned, Tags } from 'lucide-react';
import Card from '@/components/ui/Card';
import type { WorkspaceSummary } from './types';

interface Metric {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}

export default function DataSummary({ summary }: { summary: WorkspaceSummary }) {
  const metrics: Metric[] = [
    { label: 'FNRI foods', value: summary.foodItems, detail: 'canonical nutrient records', icon: Database },
    { label: 'Verified aliases', value: summary.foodAliases, detail: 'search and import labels', icon: Tags },
    {
      label: 'Clinical meal library',
      value: `${summary.completeMealLibrary}/${summary.mealLibrary}`,
      detail: 'complete evidence / total',
      icon: BookOpenCheck,
    },
    {
      label: 'Consumption rows',
      value: summary.consumptionStats,
      detail: 'aggregate survey observations',
      icon: MapPinned,
    },
    {
      label: 'Active releases',
      value: `${summary.activeReleases}/${summary.dataSources}`,
      detail: 'active versions / sources',
      icon: FileClock,
    },
  ];

  return (
    <section>
      <p className="portal-section-label mb-4">Data estate</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-6 font-display text-3xl font-black tracking-[-0.04em] text-brand-text">{value}</p>
            <p className="mt-1 text-xs font-bold text-brand-text">{label}</p>
            <p className="mt-1 text-[11px] text-brand-muted">{detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
