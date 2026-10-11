import { BookOpenCheck, Database, FileClock, MapPinned, Tags } from 'lucide-react';
import WorkspaceMetricStrip, { type WorkspaceMetric } from '@/components/shared/WorkspaceMetricStrip';
import type { WorkspaceSummary } from './types';

export default function DataSummary({ summary }: { summary: WorkspaceSummary }) {
  const metrics: WorkspaceMetric[] = [
    {
      label: 'Food records',
      value: summary.foodItems.toLocaleString('en-PH'),
      detail: 'FNRI and USDA nutrient records',
      icon: Database,
    },
    {
      label: 'Verified aliases',
      value: summary.foodAliases.toLocaleString('en-PH'),
      detail: 'search and import labels',
      icon: Tags,
    },
    {
      label: 'Clinical meal library',
      value: `${summary.completeMealLibrary.toLocaleString('en-PH')} / ${summary.mealLibrary.toLocaleString('en-PH')}`,
      detail: 'complete evidence / total',
      icon: BookOpenCheck,
    },
    {
      label: 'Consumption rows',
      value: summary.consumptionStats.toLocaleString('en-PH'),
      detail: 'aggregate survey observations',
      icon: MapPinned,
    },
    {
      label: 'Active releases',
      value: `${summary.activeReleases} / ${summary.dataSources}`,
      detail: 'active versions / sources',
      icon: FileClock,
    },
  ];

  return <WorkspaceMetricStrip label="Data estate" metrics={metrics} columns={5} />;
}
