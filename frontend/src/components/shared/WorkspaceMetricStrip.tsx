import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';

export interface WorkspaceMetric {
  label: string;
  value: ReactNode;
  detail: string;
  icon: LucideIcon;
  href?: string;
}

/** Comparable secondary totals; callers retain the meaning, source and destinations. */
export default function WorkspaceMetricStrip({
  label,
  metrics,
  columns = 4,
}: {
  label: string;
  metrics: WorkspaceMetric[];
  columns?: 4 | 5;
}) {
  return (
    <Card contentClassName="p-0">
      <dl
        aria-label={label}
        className={`grid grid-cols-2 xl:divide-x xl:divide-brand-border/60 ${columns === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}
      >
        {metrics.map(({ label: name, value, detail, icon: Icon, href }, index) => (
          <div
            key={name}
            className={`min-w-0 border-b border-brand-border/60 px-4 py-4 last:border-b-0 sm:px-5 sm:py-5 xl:border-b-0 ${metrics.length % 2 === 1 && index === metrics.length - 1 ? 'col-span-2 xl:col-span-1' : ''}`}
          >
            <dt className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
              <Icon className="h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
              {name}
            </dt>
            <dd className="mt-2 break-words font-display text-2xl font-bold tabular-nums tracking-tight text-brand-text">
              {value}
            </dd>
            <dd className="mt-1 text-xs leading-relaxed text-brand-muted">{detail}</dd>
            {href && (
              <dd className="mt-2">
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-xs font-bold text-brand-green underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                  aria-label={`View ${name.toLowerCase()}`}
                >
                  View records <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}
