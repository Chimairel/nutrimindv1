'use client';
import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';

export interface ReportVersion {
  id: string;
  version: number;
  generatedAt: string;
  content: NutritionReport;
}
export default function ReportHistory({ history }: { history: ReportVersion[] }) {
  return (
    <section className="mx-auto my-6 w-full max-w-5xl rounded-2xl border border-brand-border bg-brand-surface p-5 text-left text-brand-text">
      <h2 className="font-display text-lg font-bold">Nutrition report history</h2>
      <p className="mt-1 text-xs text-brand-muted">
        Saved guidance reflects your information at the time it was generated. Older versions may no longer match your
        current needs.
      </p>
      {!history.length && <p className="mt-3 text-sm">No saved reports yet.</p>}
      {history.map((entry) => (
        <details key={entry.id} className="mt-3 border-t border-brand-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Version {entry.version} ·{' '}
            {formatManilaDate(entry.generatedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
          </summary>
          <p className="mt-3 text-sm">{entry.content.generalSummary}</p>
          {(['foodsToAvoid', 'foodsToLimit', 'foodsRecommended', 'drinksGuidance'] as const).map((key) => (
            <div key={key} className="mt-3 text-sm">
              <p className="font-semibold">
                {
                  {
                    foodsToAvoid: 'Foods to avoid',
                    foodsToLimit: 'Foods to limit',
                    foodsRecommended: 'Recommended foods',
                    drinksGuidance: 'Drinks guidance',
                  }[key]
                }
              </p>
              <ul className="ml-5 list-disc">
                {Array.isArray(entry.content[key]) &&
                  (entry.content[key] as string[]).map((text, index) => <li key={index}>{text}</li>)}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}
