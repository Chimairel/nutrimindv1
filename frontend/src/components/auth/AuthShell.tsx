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
    <main className="relative min-h-[100dvh] bg-[#07100d] text-white p-0 sm:p-4 lg:p-6 flex flex-col justify-center overflow-x-hidden">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute left-[50%] top-12 h-80 w-80 rounded-full bg-brand-cyan/10 blur-[120px] hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-brand-accent/10 blur-[120px]" />

      <div className="mx-auto flex min-h-[100dvh] w-full flex-col justify-between overflow-y-auto bg-[#07100d] lg:grid lg:min-h-[calc(100vh-2rem)] lg:max-w-[1500px] lg:grid-cols-[1fr_1fr] lg:rounded-[36px] lg:border lg:border-white/10 lg:bg-[#0a130f]/60 lg:shadow-2xl lg:backdrop-blur-xl">
        {/* Left / Hero Section */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#07100d] px-5 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-8 lg:p-12 xl:p-16 text-white">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-cyan/15 blur-[90px]" />

          {/* Interactive Cyber Grid with box hover effects */}
          <InteractiveCyberGrid cols={8} rows={10} accentIndices={[30, 50]} variant="dark" withMask={true} />

          {/* Top Bar: Logo + Theme Toggle */}
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2.5 sm:gap-3" aria-label="KAINARA home">
              <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 items-center justify-center transition group-hover:-rotate-3">
                <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                  <KainaraLogo className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07100d] bg-brand-cyan" />
              </span>
              <span>
                <span className="block font-display text-xs sm:text-sm font-black tracking-[0.18em] text-white">
                  KAINARA
                </span>
                <span className="block font-mono text-[7px] sm:text-[8px] uppercase tracking-[0.2em] text-white/40">
                  Nutrition intelligence
                </span>
              </span>
            </Link>
            <ThemeToggle size="sm" variant="hero" />
          </div>

          {/* Hero Typography & Pills */}
          <div className="relative z-10 my-4 sm:my-6 lg:my-auto lg:max-w-xl lg:py-8">
            <div className="eyebrow mb-3 hidden items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-1 text-brand-accent lg:inline-flex rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              Your personal nutrition system
            </div>
            <h1 className="font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl md:text-4xl lg:text-[clamp(3rem,4.5vw,5.5rem)] lg:leading-[0.9] lg:tracking-[-0.06em] text-white">
              {heroTitle}
            </h1>
            <p className="mt-2 sm:mt-3 max-w-lg text-xs sm:text-sm lg:text-base leading-relaxed text-white/55">
              {heroDescription}
            </p>

            {/* Feature Pills */}
            <div className="mt-4 sm:mt-5 flex flex-wrap gap-2 lg:mt-8 lg:grid lg:grid-cols-3 lg:gap-2.5">
              {[
                ['Culturally familiar', UtensilsCrossed],
                ['Review-aware', ShieldCheck],
                ['Built for context', CheckCircle2],
              ].map(([label, Icon]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/80 sm:text-xs lg:rounded-2xl lg:border-white/[0.08] lg:bg-white/[0.035] lg:p-3 lg:text-[11px] lg:font-semibold lg:text-white/60"
                  >
                    <FeatureIcon className="h-3 w-3 text-brand-cyan shrink-0" />
                    <span>{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spacer on desktop */}
          <div className="hidden lg:block" />
        </section>

        {/* Right / Form Card Section */}
        <section className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-12 lg:p-12 xl:p-16 bg-[#07100d] lg:bg-transparent">
          <div className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[460px]'}`}>
            {/* White floating card matching reference design */}
            <div className="auth-card relative rounded-[28px] sm:rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl border border-white/20 text-neutral-900">
              <div className="mb-5 sm:mb-6">
                <p className="font-mono text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  {eyebrow}
                </p>
                <h2 className="mt-1 font-display text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-neutral-900">
                  {title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                  {description}
                </p>
              </div>
              {children}
            </div>

            {/* Sub-card Links */}
            {footer && <div className="mt-5 text-center text-xs text-neutral-400">{footer}</div>}
            <Link
              href="/"
              className="mx-auto mt-3 flex w-fit items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400 transition hover:text-white"
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
