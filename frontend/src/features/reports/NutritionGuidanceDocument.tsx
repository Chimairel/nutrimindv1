'use client';

import Link from 'next/link';
import type { NutritionReport } from '@/types';
import ReportHistory from './ReportHistory';

interface Props {
  report: NutritionReport;
  name: string;
  goal: string;
  dailyCalorieTarget: number;
  conditions: string[];
  foodRestrictions: string[];
  history: Array<{ id: string; version: number; generatedAt: string; content: NutritionReport }>;
  error: string | null;
  isAcknowledging: boolean;
  onAcknowledge: () => void;
  onDownload: () => void;
}

export default function NutritionGuidanceDocument({ report, name, goal, dailyCalorieTarget, conditions,
  foodRestrictions, history, error, isAcknowledging, onAcknowledge, onDownload }: Props) {
  const refs = report.referenceItems ?? [];
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-slate-900 md:px-10 md:py-12">
      <article className="mx-auto max-w-3xl font-sans leading-relaxed">
        <nav className="mb-8 text-sm text-slate-600"><Link href="/profile" className="underline">Profile</Link> / Nutrition Guidance</nav>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">KAINARA · Personal record</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Nutrition Guidance</h1>
            <p className="mt-1 text-sm text-slate-600">Reference summary for your current profile</p>
          </div>
          <button type="button" onClick={onDownload} className="rounded border border-slate-400 px-4 py-2 text-sm font-semibold hover:bg-slate-100">
            Download PDF
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600">Version {report.version} · Prepared {new Date(report.generatedAt).toLocaleDateString()} · {report.acknowledgedAt ? 'Acknowledged' : 'Acknowledgment needed'}</p>
        {error && <p role="alert" className="mt-5 border-l-4 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        <section className="mt-8 border-b border-slate-300 pb-6">
          <h2 className="text-lg font-bold">Profile used for this guidance</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Name</dt><dd>{name}</dd></div>
            <div><dt className="font-semibold">Goal</dt><dd>{goal.replace(/_/g, ' ').toLowerCase()}</dd></div>
            <div><dt className="font-semibold">Estimated energy target</dt><dd>{dailyCalorieTarget.toLocaleString()} kcal/day</dd></div>
            <div><dt className="font-semibold">Reported conditions</dt><dd>{conditions.length ? conditions.join(', ').replace(/_/g, ' ') : 'None reported'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Reported allergies, intolerances and avoided foods</dt><dd>{foodRestrictions.length ? foodRestrictions.join(', ').replace(/_/g, ' ') : 'None reported'}</dd></div>
          </dl>
        </section>

        <section className="mt-7 border-b border-slate-300 pb-6">
          <h2 className="text-lg font-bold">What these numbers mean</h2>
          <p className="mt-3 text-sm">{report.generalSummary}</p>
          <p className="mt-3 text-sm text-slate-700">The energy target is a planning estimate based on your saved details. Population references below are calculated from that target. Conditions that need more clinical information are marked for individual review; the report does not assign an unsupported personal limit.</p>
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-bold">Calculated references and review notes</h2>
          <ol className="mt-2 divide-y divide-slate-200">
            {refs.map((item, index) => (
              <li key={`${item.sourceCode}-${item.heading}-${index}`} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{item.heading}</h3>
                  <strong className="text-sm">{item.value}</strong>
                </div>
                <p className="mt-1 text-sm text-slate-700">{item.explanation}</p>
                <p className="mt-2 text-xs text-slate-600">{item.classification === 'REQUIRES_INDIVIDUAL_REVIEW' ? 'Individual review' : item.classification === 'CALCULATED_REFERENCE' ? 'Calculated population reference' : 'General reference'} · Source: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{item.sourceTitle}</a></p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5 border-t border-slate-300 pt-5 text-sm">
          <h2 className="font-bold">Meal planning status</h2>
          <p className="mt-2">Acknowledging this document records that you reviewed it. Meal eligibility and Registered Nutritionist-Dietitian review are separate checks. Acknowledgment does not itself clear a meal or a medical condition.</p>
        </section>
        {!report.acknowledgedAt && (
          <div className="mt-7 border-y border-slate-300 py-5">
            <p className="text-sm">Please confirm that the profile above reflects what you entered and that you have read these references. This is educational guidance and does not replace your doctor or Registered Nutritionist-Dietitian.</p>
            <button type="button" onClick={onAcknowledge} disabled={isAcknowledging} className="mt-4 rounded bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{isAcknowledging ? 'Saving…' : 'Acknowledge and Continue'}</button>
          </div>
        )}
        <ReportHistory history={history} />
      </article>
    </main>
  );
}
