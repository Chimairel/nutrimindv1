import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  BookMarked,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  HeartHandshake,
  Lightbulb,
  Quote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';

export const metadata: Metadata = {
  title: 'Project Documentation | NutriMind',
  description: 'The research, design decisions, and development story behind NutriMind.',
};

const chapters = [
  ['01', 'Origin', '#origin'],
  ['02', 'Discovery', '#discovery'],
  ['03', 'Product principles', '#principles'],
  ['04', 'System loop', '#system-loop'],
  ['05', 'Timeline', '#timeline'],
];

const principles = [
  {
    icon: HeartHandshake,
    title: 'Culturally familiar first',
    text: 'A healthy meal plan should feel recognizable, accessible, and possible in a Filipino household—not imported from a generic Western template.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety state must be visible',
    text: 'Generated and verified are not the same thing. The interface keeps review status legible wherever a meal appears.',
  },
  {
    icon: BrainCircuit,
    title: 'AI fills gaps, not authority',
    text: 'The product searches compatible verified meals first and treats generation as a fallback within a human-review lifecycle.',
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen text-brand-text">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-brand-border/60">
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-50" />
          <div className="pointer-events-none absolute left-[12%] top-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[110px]" />
          <div className="pointer-events-none absolute right-[8%] top-20 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px]" />

          <div className="relative mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-bold text-brand-muted transition hover:text-brand-green">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to the experience
            </Link>
            <div className="grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
              <div>
                <div className="eyebrow inline-flex items-center gap-2"><BookMarked className="h-3.5 w-3.5" />Project documentation · draft</div>
                <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.9] tracking-[-0.065em]">
                  The thinking behind <span className="text-gradient">NutriMind.</span>
                </h1>
              </div>
              <div className="border-l border-brand-border/70 pl-6">
                <p className="text-sm leading-7 text-brand-muted">
                  A living journal for the research, product decisions, design process, and technical evolution of a Filipino nutrition capstone.
                </p>
                <div className="mt-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-muted">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Placeholder editorial content
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-12 lg:py-24">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-muted">On this page</p>
              <nav className="mt-5 space-y-1" aria-label="Documentation chapters">
                {chapters.map(([number, label, href]) => (
                  <a key={number} href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-xs font-semibold text-brand-muted transition hover:bg-brand-surface/60 hover:text-brand-text">
                    <span className="font-mono text-[9px] text-brand-green/60 group-hover:text-brand-green">{number}</span>
                    {label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 rounded-2xl border border-brand-border/70 bg-brand-surface/60 p-4">
                <p className="text-[11px] font-bold text-brand-text">Editorial note</p>
                <p className="mt-2 text-[10px] leading-5 text-brand-muted">Replace the marked placeholders with validated capstone research, team photos, and adviser-approved references.</p>
              </div>
            </div>
          </aside>

          <article className="min-w-0">
            <section id="origin" className="scroll-mt-28">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]"><Lightbulb className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter 01</p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Where the idea began</h2>
                </div>
              </div>

              <div className="mt-8 grid gap-8 text-sm leading-7 text-brand-muted md:grid-cols-2">
                <p>
                  Many nutrition products make healthy eating feel geographically generic. Their suggestions can be nutritionally impressive on paper yet culturally distant, expensive, or difficult to source in an ordinary Philippine routine. NutriMind began with a practical question: what would personalized nutrition look like if Filipino context were a first-class input?
                </p>
                <p>
                  The capstone explores a connected workflow rather than a single AI prompt. Users provide context, the system composes a plan, and nutrition professionals can review meals before those meals become part of a reusable verified library. This page is an editorial shell for the team to replace with its final, evidence-backed narrative.
                </p>
              </div>

              <blockquote className="relative mt-10 overflow-hidden rounded-[28px] border border-brand-green/20 bg-brand-green/[0.07] p-7 sm:p-9">
                <Quote className="absolute right-6 top-5 h-14 w-14 text-brand-green/10" />
                <p className="relative max-w-3xl font-display text-xl font-bold leading-8 tracking-tight text-brand-text sm:text-2xl">
                  “How might we make personalized nutrition feel local, understandable, and responsibly reviewable?”
                </p>
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-brand-muted">Working design question · placeholder wording</p>
              </blockquote>
            </section>

            <section id="discovery" className="scroll-mt-28 border-t border-brand-border/70 pt-16 mt-20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-cyan/15 text-brand-cyan"><ScanSearch className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter 02</p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Discovery and field notes</h2>
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-sm leading-7 text-brand-muted">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. This section is reserved for the team&apos;s problem validation, participant profile, survey method, interview themes, and synthesis. Avoid presenting sample numbers as findings until the underlying evidence is cited.
              </p>

              <div className="mt-9 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="relative min-h-[390px] overflow-hidden rounded-[30px] border border-white/10 bg-[#08110e] p-7 text-white futuristic-grid">
                  <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-brand-cyan/15 blur-3xl" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="eyebrow border-white/10 bg-white/5 text-white/60">Image placeholder 01</div>
                      <Users className="h-5 w-5 text-brand-cyan" />
                    </div>
                    <div>
                      <div className="mb-5 grid grid-cols-4 gap-2">
                        {[60, 85, 48, 72].map((height, index) => (
                          <div key={height} className="flex h-24 items-end rounded-xl bg-white/[0.035] p-2">
                            <div className={`w-full rounded-lg ${index % 2 ? 'bg-brand-cyan/50' : 'bg-brand-accent/55'}`} style={{ height: `${height}%` }} />
                          </div>
                        ))}
                      </div>
                      <h3 className="font-display text-xl font-bold">Participant research visual</h3>
                      <p className="mt-2 max-w-md text-xs leading-5 text-white/40">Replace this generated visual block with a consent-cleared research photo, chart, or affinity map.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {[
                    ['Research question', 'What prevents young Filipino adults from sustaining a personalized meal plan?'],
                    ['Behavior lens', 'Shopping rhythm, cooking time, budget, food familiarity, and health constraints.'],
                    ['Evidence needed', 'Cited interviews, survey results, literature, and FNRI source references.'],
                  ].map(([label, text], index) => (
                    <div key={label} className="surface-panel rounded-[24px] p-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold text-brand-green">0{index + 1}</span>
                        <p className="text-xs font-bold text-brand-text">{label}</p>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-brand-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="principles" className="scroll-mt-28 border-t border-brand-border/70 pt-16 mt-20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400"><Sparkles className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter 03</p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Product principles</h2>
                </div>
              </div>

              <div className="mt-9 grid gap-4 md:grid-cols-3">
                {principles.map((principle, index) => {
                  const Icon = principle.icon;
                  return (
                    <div key={principle.title} className="surface-panel rounded-[26px] p-6">
                      <div className="flex items-center justify-between">
                        <Icon className="h-5 w-5 text-brand-green" />
                        <span className="font-display text-3xl font-black text-brand-text/[0.06]">0{index + 1}</span>
                      </div>
                      <h3 className="mt-8 font-display text-base font-extrabold tracking-tight">{principle.title}</h3>
                      <p className="mt-3 text-xs leading-6 text-brand-muted">{principle.text}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="system-loop" className="scroll-mt-28 border-t border-brand-border/70 pt-16 mt-20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green"><Blocks className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter 04</p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">The connected system loop</h2>
                </div>
              </div>

              <div className="mt-9 overflow-hidden rounded-[30px] border border-white/10 bg-[#07100d] p-6 text-white sm:p-9">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: 'User space', icon: Users, items: ['Health context', 'Weekly plan', 'Daily tracking'] },
                    { label: 'Nutritionist space', icon: ShieldCheck, items: ['Review queue', 'Meal evidence', 'Approval lifecycle'] },
                    { label: 'Admin space', icon: Blocks, items: ['Account oversight', 'RND verification', 'Platform analytics'] },
                  ].map((column) => {
                    const Icon = column.icon;
                    return (
                      <div key={column.label} className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-5">
                        <Icon className="h-5 w-5 text-brand-accent" />
                        <h3 className="mt-5 text-sm font-bold">{column.label}</h3>
                        <div className="mt-4 space-y-2">
                          {column.items.map((item) => (
                            <div key={item} className="flex items-center gap-2 text-[11px] text-white/45">
                              <CheckCircle2 className="h-3.5 w-3.5 text-brand-cyan/70" />{item}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-brand-accent/15 bg-brand-accent/[0.07] p-4 text-center">
                  <CircleDot className="h-4 w-4 text-brand-accent" />
                  <p className="text-[11px] text-white/55">Shared data and visible review states connect every role without making them interchangeable.</p>
                </div>
              </div>
            </section>

            <section id="timeline" className="scroll-mt-28 border-t border-brand-border/70 pt-16 mt-20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><FlaskConical className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-muted">Chapter 05</p>
                  <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Capstone timeline</h2>
                </div>
              </div>

              <div className="mt-10 border-l border-brand-border pl-7">
                {[
                  ['Explore', 'Problem framing, literature review, and participant discovery.', 'Replace with actual term/date'],
                  ['Define', 'Synthesize needs into product requirements and safety boundaries.', 'Replace with actual term/date'],
                  ['Build', 'Design, API development, data modeling, and iterative integration.', 'Replace with actual term/date'],
                  ['Validate', 'Usability work, technical verification, and final capstone evaluation.', 'Replace with actual term/date'],
                ].map(([title, text, date], index) => (
                  <div key={title} className="relative pb-10 last:pb-0">
                    <span className="absolute -left-[34px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-brand-bg bg-brand-green" />
                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                      <div>
                        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-brand-green">Phase 0{index + 1}</p>
                        <h3 className="mt-1 font-display text-lg font-extrabold">{title}</h3>
                      </div>
                      <div className="rounded-2xl border border-brand-border/70 bg-brand-surface/60 p-5">
                        <p className="text-sm leading-6 text-brand-muted">{text}</p>
                        <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted/65">{date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-20 overflow-hidden rounded-[30px] bg-brand-accent p-7 text-[#07100d] sm:p-10">
              <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">Continue exploring</p>
                  <h2 className="mt-3 max-w-xl font-display text-3xl font-black tracking-[-0.04em]">Experience the product these decisions shaped.</h2>
                </div>
                <Link href="/register" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#07100d] px-5 text-sm font-extrabold text-white transition hover:-translate-y-0.5">
                  Start onboarding
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </article>
        </div>
      </main>

      <footer className="border-t border-brand-border/70">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-8 text-xs text-brand-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p className="font-display font-bold text-brand-text">NutriMind project documentation</p>
          <p>Draft placeholders must be replaced with adviser-approved capstone evidence.</p>
        </div>
      </footer>
    </div>
  );
}
