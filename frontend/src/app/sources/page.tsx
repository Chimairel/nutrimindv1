import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, BookOpenCheck, Database, FlaskConical, ShieldCheck } from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import {
  EVIDENCE_CATEGORY_LABELS,
  EVIDENCE_SOURCES,
  EVIDENCE_STATUS_LABELS,
  type EvidenceSourceCategory,
} from '@/data/evidence-sources';

export const metadata: Metadata = {
  title: 'Evidence & data sources | KAINARA',
  description:
    'The published methods, Philippine nutrition data, safety guidance, and recipe provenance used by KAINARA.',
};

const categoryIcons = {
  PHILIPPINE_NUTRITION: Database,
  CLINICAL_METHOD: FlaskConical,
  SAFETY_GUIDANCE: ShieldCheck,
  RECIPE_PROVENANCE: BookOpenCheck,
} satisfies Record<EvidenceSourceCategory, typeof Database>;

const categories = Object.keys(EVIDENCE_CATEGORY_LABELS) as EvidenceSourceCategory[];

export default function SourcesPage() {
  return (
    <div className="min-h-screen text-brand-text">
      <PublicHeader />
      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-14 sm:px-8 lg:px-12 lg:pt-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to KAINARA
        </Link>

        <section className="mt-10 max-w-4xl">
          <div className="eyebrow inline-flex items-center gap-2">
            <BookOpenCheck className="h-3.5 w-3.5" /> Evidence register
          </div>
          <h1 className="mt-5 font-display text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl">
            Built from traceable methods, data, and recipe provenance.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-brand-muted">
            KAINARA names the independent sources behind its calculations and content. Each source has a defined role
            and authority level. A citation means that KAINARA uses or is reviewing the published material; it does not
            mean the organization sponsors, endorses, clinically approves, or formally cooperates with KAINARA.
          </p>
        </section>

        <div className="mt-14 space-y-14">
          {categories.map((category) => {
            const Icon = categoryIcons[category];
            const sources = EVIDENCE_SOURCES.filter((source) => source.category === category);
            return (
              <section key={category} aria-labelledby={`source-${category}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 id={`source-${category}`} className="font-display text-2xl font-extrabold tracking-tight">
                    {EVIDENCE_CATEGORY_LABELS[category]}
                  </h2>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sources.map((source) => (
                    <article key={source.id} className="surface-panel flex min-h-[260px] flex-col rounded-[28px] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <span className="flex h-14 min-w-14 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 px-3 font-mono text-xs font-black tracking-wider text-brand-green">
                          {source.mark}
                        </span>
                        <span className="max-w-[190px] rounded-full border border-brand-border px-3 py-1 text-right font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-brand-muted">
                          {EVIDENCE_STATUS_LABELS[source.status]}
                        </span>
                      </div>
                      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-green">
                        {source.shortName}
                      </p>
                      <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">{source.name}</h3>
                      <p className="mt-3 flex-1 text-sm leading-6 text-brand-muted">{source.role}</p>
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:underline"
                      >
                        Open original source <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-16 rounded-[30px] border border-amber-400/25 bg-amber-400/5 p-7 sm:p-9">
          <h2 className="font-display text-2xl font-extrabold">How to read this register</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-brand-muted md:grid-cols-3">
            <li>
              <strong className="text-brand-text">Used in system</strong> means the data or calculation method is
              currently integrated.
            </li>
            <li>
              <strong className="text-brand-text">Draft policy</strong> means the source informs an inactive rule that
              still requires the configured RND approvals.
            </li>
            <li>
              <strong className="text-brand-text">Provenance only</strong> identifies where a recipe came from and never
              establishes nutrition or safety.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
