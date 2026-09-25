'use client';

import React, { type ReactNode } from 'react';
import Link from 'next/link';
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
    <main className="relative flex min-h-[100dvh] flex-col justify-center overflow-x-clip bg-brand-bg p-0 text-brand-text transition-colors duration-300 dark:bg-[#07100d] dark:text-white sm:p-4 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden xl:p-6">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute left-[50%] top-12 h-80 w-80 rounded-full bg-brand-green/10 blur-[140px] dark:bg-brand-cyan/10 hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-brand-cyan/10 blur-[140px] dark:bg-brand-accent/10" />

      <div className="mx-auto flex min-h-[100dvh] w-full flex-col justify-between bg-brand-bg/90 transition-colors duration-300 dark:bg-[#07100d] sm:min-h-[calc(100dvh-2rem)] lg:grid lg:h-full lg:min-h-0 lg:max-w-[1500px] lg:grid-cols-[1fr_1fr] lg:overflow-hidden lg:rounded-[36px] lg:border lg:border-brand-border/80 lg:bg-brand-surface/70 lg:shadow-card-lg lg:backdrop-blur-xl dark:lg:border-white/10 dark:lg:bg-[#0a130f]/60 dark:lg:shadow-2xl">
        {/* Left / Hero Section */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-brand-bg/60 px-5 pb-2 pt-6 text-brand-text transition-colors duration-300 dark:bg-[#07100d] dark:text-white sm:px-8 sm:pb-8 sm:pt-8 lg:min-h-0 lg:p-8 xl:p-12 2xl:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-green/15 blur-[90px] dark:bg-brand-cyan/15" />

          {/* Interactive Cyber Grid: enabled on md+ screens, hidden on mobile for a clean uncluttered backdrop */}
          <InteractiveCyberGrid
            cols={8}
            rows={10}
            accentIndices={[30, 50]}
            variant="adaptive"
            withMask={true}
            className="hidden md:block"
          />

          {/* Top Bar: Logo + Theme Toggle */}
          <div className="pointer-events-auto relative z-10 flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2.5 sm:gap-3" aria-label="KAINARA home">
              <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 items-center justify-center transition group-hover:-rotate-3">
                <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                  <KainaraLogo className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-bg dark:border-[#07100d] bg-brand-cyan" />
              </span>
              <span>
                <span className="block font-display text-xs sm:text-sm font-black tracking-[0.18em] text-brand-text dark:text-white">
                  KAINARA
                </span>
                <span className="block font-mono text-[7px] sm:text-[8px] uppercase tracking-[0.2em] text-brand-muted dark:text-white/40">
                  Nutrition intelligence
                </span>
              </span>
            </Link>
            <ThemeToggle size="sm" variant="default" className="rounded-2xl" />
          </div>

          {/* Hero Typography & Pills (pointer-events-none allows grid tiles behind text to hover) */}
          <div className="pointer-events-none relative z-10 mb-2 mt-4 sm:my-6 lg:my-auto lg:max-w-xl lg:py-4 xl:py-6">
            <div className="eyebrow mb-3 hidden items-center gap-2 rounded-full border border-brand-green/25 bg-brand-green/10 px-3 py-1 text-brand-green dark:border-white/10 dark:bg-white/[0.04] dark:text-brand-accent lg:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              Your personal nutrition system
            </div>
            <h1 className="font-display text-[2.35rem] font-black leading-[1.02] tracking-[-0.055em] text-brand-text dark:text-white sm:text-5xl md:text-6xl lg:text-[clamp(3rem,4.7vw,5.5rem)] lg:leading-[0.92]">
              {heroTitle}
            </h1>
            <p className="mt-2.5 sm:mt-3 max-w-lg text-xs sm:text-sm lg:text-base leading-relaxed text-brand-muted dark:text-white/60">
              {heroDescription}
            </p>

            {/* Feature Pills */}
            <div className="pointer-events-auto mt-3 flex flex-wrap gap-2 sm:mt-5 lg:mt-6 lg:grid lg:grid-cols-3 lg:gap-2.5 xl:mt-8">
              {[
                ['Culturally familiar', UtensilsCrossed],
                ['Review-aware', ShieldCheck],
                ['Built for context', CheckCircle2],
              ].map(([label, Icon]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-border/80 bg-brand-surface/80 px-3 py-1 text-[11px] font-medium text-brand-text/85 sm:text-xs lg:rounded-2xl lg:p-3 lg:text-[11px] lg:font-semibold dark:border-white/10 dark:bg-white/[0.05] dark:text-white/80"
                  >
                    <FeatureIcon className="h-3 w-3 text-brand-green dark:text-brand-cyan shrink-0" />
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
        <section className="relative z-20 flex flex-1 flex-col items-center justify-center bg-brand-bg/40 px-4 pb-8 pt-2 transition-colors duration-300 dark:bg-[#07100d] sm:px-8 sm:py-12 lg:min-h-0 lg:bg-transparent lg:px-8 lg:py-5 xl:px-12 xl:py-8">
          <div className={`w-full ${wide ? 'max-w-[540px]' : 'max-w-[460px]'}`}>
            {/* White floating card matching reference design with dark mode glow */}
            <div
              className={`auth-card floating-card-shadow relative rounded-[28px] border border-neutral-200/80 bg-white text-neutral-900 dark:border-white/20 sm:rounded-[32px] ${
                wide ? 'p-5 sm:p-6 lg:p-5 xl:p-6' : 'p-6 sm:p-8 lg:p-6 xl:p-8'
              }`}
            >
              <div className={wide ? 'mb-4' : 'mb-5 sm:mb-6'}>
                <p className="font-mono text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  {eyebrow}
                </p>
                <h2
                  className={`mt-1 font-display font-black tracking-tight text-neutral-900 ${
                    wide ? 'text-xl sm:text-2xl lg:text-[1.7rem]' : 'text-xl sm:text-2xl lg:text-3xl'
                  }`}
                >
                  {title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-neutral-500 leading-relaxed">{description}</p>
              </div>
              {children}
            </div>

            {/* Sub-card Links */}
            {footer && <div className="mt-3 text-center text-xs text-brand-muted dark:text-neutral-400">{footer}</div>}
            <Link
              href="/"
              className="mx-auto mt-2 flex w-fit items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted transition hover:text-brand-text dark:text-neutral-400 dark:hover:text-white"
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
