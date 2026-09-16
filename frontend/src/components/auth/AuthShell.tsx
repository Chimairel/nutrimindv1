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
    <main className="relative min-h-[100dvh] bg-brand-bg text-brand-text p-0 lg:p-5 flex flex-col justify-center overflow-x-hidden">
      <div className="pointer-events-none absolute left-[52%] top-16 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px] hidden sm:block" />
      <div className="mx-auto flex min-h-[100dvh] w-full flex-col justify-between overflow-y-auto bg-brand-bg lg:grid lg:min-h-[calc(100vh-1.5rem)] lg:max-w-[1540px] lg:grid-cols-[1.04fr_0.96fr] lg:rounded-[34px] lg:border lg:border-brand-border/70 lg:bg-brand-surface/45 lg:shadow-card-lg lg:backdrop-blur-xl">
        <section className="relative flex flex-col overflow-hidden bg-[#07100d] px-3.5 pt-2.5 pb-4 text-white sm:px-8 sm:pt-6 sm:pb-8 lg:p-10 xl:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-cyan/15 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-brand-accent/10 blur-[90px]" />

          {/* Interactive Cyber Grid with box hover effects */}
          <InteractiveCyberGrid cols={8} rows={10} accentIndices={[30, 50]} variant="dark" withMask={true} />

          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2 sm:gap-3" aria-label="KAINARA home">
              <span className="relative flex h-7 w-7 sm:h-10 sm:w-10 lg:h-11 lg:w-11 items-center justify-center transition group-hover:-rotate-3">
                <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                  <KainaraLogo className="h-7 w-7 sm:h-10 sm:w-10 lg:h-11 lg:w-11" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border-2 border-[#07100d] bg-brand-cyan" />
              </span>
              <span>
                <span className="block font-display text-[11px] sm:text-sm font-black tracking-[0.17em]">KAINARA</span>
                <span className="font-mono text-[7px] sm:text-[8px] uppercase tracking-[0.18em] text-white/35">
                  Nutrition intelligence
                </span>
              </span>
            </Link>
            <ThemeToggle size="sm" variant="hero" />
          </div>

          <div className="pointer-events-none relative z-10 mt-2 sm:mt-4 lg:my-auto lg:max-w-2xl lg:py-12">
            <div className="eyebrow hidden items-center gap-2 border border-white/10 bg-white/[0.04] text-brand-accent lg:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              Your personal nutrition system
            </div>
            <h1 className="font-display text-lg font-black leading-tight tracking-tight sm:text-2xl lg:mt-6 lg:text-[clamp(3.4rem,5.5vw,6.5rem)] lg:leading-[0.88] lg:tracking-[-0.065em]">
              {heroTitle}
            </h1>
            <p className="mt-1 max-w-xl text-[10px] leading-snug text-white/50 line-clamp-2 sm:mt-2 sm:text-xs sm:leading-relaxed lg:mt-7 lg:text-white/45 lg:text-base lg:line-clamp-none xl:leading-8">
              {heroDescription}
            </p>

            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-3 lg:mt-9 lg:grid lg:max-w-xl lg:grid-cols-3 lg:gap-2.5">
              {[
                ['Culturally familiar', UtensilsCrossed],
                ['Review-aware', ShieldCheck],
                ['Built for context', CheckCircle2],
              ].map(([label, Icon]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/70 sm:px-2.5 sm:py-1 sm:text-[10px] lg:rounded-2xl lg:border-white/[0.08] lg:bg-white/[0.035] lg:p-3 lg:text-[10px] lg:font-semibold lg:text-white/55"
                  >
                    <FeatureIcon className="h-2.5 w-2.5 text-brand-cyan shrink-0 sm:h-3 sm:w-3" />
                    <span>{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-2 flex flex-1 flex-col items-center justify-between px-3 pb-3 sm:px-6 sm:pb-5 lg:mt-0 lg:justify-center lg:p-12 xl:p-16">
          <div className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[460px]'}`}>
            <div className="surface-panel !rounded-[20px] p-3 shadow-card-lg sm:!rounded-[28px] sm:p-6 lg:p-8">
              <div className="mb-2 sm:mb-4">
                <p className="portal-kicker !text-brand-green text-[9px] sm:text-[10px]">{eyebrow}</p>
                <h2 className="mt-0.5 font-display text-base font-black tracking-[-0.03em] text-brand-text sm:text-xl lg:text-4xl">
                  {title}
                </h2>
                <p className="mt-0.5 text-[10px] leading-tight text-brand-muted sm:mt-1 sm:text-xs sm:leading-5 lg:text-sm">
                  {description}
                </p>
              </div>
              {children}
            </div>

            {footer && <div className="mt-2 sm:mt-4 text-center text-xs text-brand-muted">{footer}</div>}
            <Link
              href="/"
              className="mx-auto mt-1.5 flex w-fit items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-green sm:mt-3"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
