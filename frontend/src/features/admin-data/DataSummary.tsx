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
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                <Icon className="h-4 w-4" />
              </span>
              <p className="font-display text-2xl font-black tracking-[-0.04em] text-brand-text sm:text-3xl">{value}</p>
            </div>
            <p className="mt-4 text-xs font-bold text-brand-text">{label}</p>
            <p className="mt-1 text-[11px] text-brand-muted">{detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
