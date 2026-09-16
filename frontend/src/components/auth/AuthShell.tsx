import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import KainaraLogo from '@/components/shared/KainaraLogo';
import InteractiveCyberGrid from '@/components/ui/InteractiveCyberGrid';
import ThemeToggle from '@/components/ui/ThemeToggle';

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
    <main className="relative min-h-screen bg-brand-bg text-brand-text p-0 lg:p-5">
      <div className="pointer-events-none absolute left-[52%] top-16 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px]" />
      <div className="mx-auto flex min-h-screen flex-col overflow-hidden bg-brand-bg lg:grid lg:min-h-[calc(100vh-1.5rem)] lg:max-w-[1540px] lg:grid-cols-[1.04fr_0.96fr] lg:rounded-[34px] lg:border lg:border-brand-border/70 lg:bg-brand-surface/45 lg:shadow-card-lg lg:backdrop-blur-xl">
        <section className="relative flex flex-col overflow-hidden bg-[#07100d] px-5 pt-8 pb-14 text-white sm:px-8 sm:pt-10 sm:pb-16 lg:p-10 xl:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-cyan/15 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-brand-accent/10 blur-[90px]" />

          {/* Interactive Cyber Grid with box hover effects */}
          <InteractiveCyberGrid cols={8} rows={10} accentIndices={[30, 50]} variant="dark" withMask={true} />

          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-3" aria-label="KAINARA home">
              <span className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center transition group-hover:-rotate-3">
                <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                  <KainaraLogo className="h-10 w-10 sm:h-11 sm:w-11" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07100d] bg-brand-cyan" />
              </span>
              <span>
                <span className="block font-display text-xs sm:text-sm font-black tracking-[0.17em]">KAINARA</span>
                <span className="font-mono text-[7px] sm:text-[8px] uppercase tracking-[0.18em] text-white/35">
                  Nutrition intelligence
                </span>
              </span>
            </Link>
            <ThemeToggle size="md" variant="hero" />
          </div>

          <div className="pointer-events-none relative z-10 mt-6 sm:mt-8 lg:my-auto lg:max-w-2xl lg:py-12">
            <div className="eyebrow hidden items-center gap-2 border border-white/10 bg-white/[0.04] text-brand-accent lg:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              Your personal nutrition system
            </div>
            <h1 className="font-display text-3xl font-black leading-[0.95] tracking-tight sm:text-4xl lg:mt-6 lg:text-[clamp(3.4rem,5.5vw,6.5rem)] lg:leading-[0.88] lg:tracking-[-0.065em]">
              {heroTitle}
            </h1>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/50 sm:mt-4 sm:text-sm sm:leading-6 lg:mt-7 lg:text-white/45 xl:text-base xl:leading-8">
              {heroDescription}
            </p>

            <div className="mt-5 flex flex-wrap gap-2 lg:mt-9 lg:grid lg:max-w-xl lg:grid-cols-3 lg:gap-2.5">
              {[
                ['Culturally familiar', UtensilsCrossed],
                ['Review-aware', ShieldCheck],
                ['Built for context', CheckCircle2],
              ].map(([label, Icon]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div
                    key={label as string}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 lg:rounded-2xl lg:border-white/[0.08] lg:bg-white/[0.035] lg:p-3 lg:text-[10px] lg:font-semibold lg:text-white/55"
                  >
                    <FeatureIcon className="h-3.5 w-3.5 text-brand-cyan shrink-0" />
                    <span>{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-6 flex flex-1 items-center justify-center px-3.5 pb-10 sm:-mt-8 sm:px-8 sm:pb-12 lg:mt-0 lg:p-12 xl:p-16">
          <div className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[470px]'}`}>
            <div className="surface-panel !rounded-[28px] p-5 shadow-card-lg sm:p-8">
              <div className="mb-5">
                <p className="portal-kicker !text-brand-green">{eyebrow}</p>
                <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-brand-text sm:text-4xl">
                  {title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-brand-muted sm:text-sm sm:leading-6">{description}</p>
              </div>
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-xs text-brand-muted">{footer}</div>}
            <Link
              href="/"
              className="mx-auto mt-4 flex w-fit items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-green sm:mt-5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
