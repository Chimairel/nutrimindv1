import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  heroTitle: ReactNode;
  heroDescription: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export default function AuthShell({
  eyebrow,
  title,
  description,
  heroTitle,
  heroDescription,
  children,
  footer,
  wide = false,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-bg p-3 text-brand-text sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute left-[52%] top-16 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px]" />
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1540px] overflow-hidden rounded-[34px] border border-brand-border/70 bg-brand-surface/45 shadow-card-lg backdrop-blur-xl lg:grid-cols-[1.04fr_0.96fr]">
        <section className="futuristic-grid relative hidden overflow-hidden bg-[#07100d] p-10 text-white lg:flex lg:flex-col xl:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-cyan/15 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-brand-accent/10 blur-[90px]" />

          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-3" aria-label="NutriMind home">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d] shadow-neon transition group-hover:-rotate-3">
                <BrainCircuit className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#07100d] bg-brand-cyan" />
              </span>
              <span>
                <span className="block font-display text-sm font-black tracking-[0.17em]">NUTRIMIND</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">Nutrition intelligence</span>
              </span>
            </Link>
            <Link href="/docs" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:border-brand-cyan/30 hover:text-brand-cyan">
              Project docs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="relative z-10 my-auto max-w-2xl py-12">
            <div className="eyebrow inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] text-brand-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Your personal nutrition system
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-[clamp(3.4rem,5.5vw,6.5rem)] font-black leading-[0.88] tracking-[-0.065em]">
              {heroTitle}
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-white/45 xl:text-base xl:leading-8">{heroDescription}</p>

            <div className="mt-9 grid max-w-xl gap-2.5 sm:grid-cols-3">
              {[
                ['Culturally familiar', UtensilsCrossed],
                ['Review-aware', ShieldCheck],
                ['Built for context', CheckCircle2],
              ].map(([label, Icon]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={label as string} className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-3 text-[10px] font-semibold text-white/55">
                    <FeatureIcon className="h-3.5 w-3.5 text-brand-cyan" />
                    {label as string}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-[1fr_auto] gap-3 rounded-[26px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]"><UtensilsCrossed className="h-[18px] w-[18px]" /></span>
              <div>
                <p className="text-xs font-bold text-white/90">Today&apos;s plan is connected</p>
                <p className="mt-1 text-[10px] text-white/35">Meals, macros, review states, and progress</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-brand-accent/15 bg-brand-accent/[0.08] px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent shadow-[0_0_9px_rgba(184,244,95,0.9)]" />
              <span className="font-mono text-[8px] uppercase tracking-wider text-brand-accent">Ready</span>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[470px]'}`}>
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2 font-display text-xs font-black tracking-[0.15em]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent text-[#07100d]"><BrainCircuit className="h-4 w-4" /></span>
                NUTRIMIND
              </Link>
              <Link href="/docs" className="text-xs font-semibold text-brand-muted transition hover:text-brand-green">Docs</Link>
            </div>

            <div className="surface-panel rounded-[30px] p-6 sm:p-8">
              <div className="mb-7">
                <p className="portal-kicker !text-brand-green">{eyebrow}</p>
                <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-brand-text sm:text-4xl">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-brand-muted">{description}</p>
              </div>
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-xs text-brand-muted">{footer}</div>}
            <Link href="/" className="mx-auto mt-5 flex w-fit items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-green">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
