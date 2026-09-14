'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';
import KainaraLogo from '@/components/shared/KainaraLogo';
import InteractiveCyberGrid from '@/components/ui/InteractiveCyberGrid';

export interface SystemErrorPanelProps {
  code?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
  showThemeToggle?: boolean;
  className?: string;
}

export function SystemErrorPanel({
  code = '404',
  title = 'This destination isn’t accessible.',
  description = 'The resource you attempted to open may have been moved, archived, or temporarily disconnected from the network.',
  buttonLabel = 'Return to Dashboard',
  buttonHref = '/dashboard',
  showThemeToggle = true,
  className = '',
}: SystemErrorPanelProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <main
      className={`relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-brand-bg text-brand-text transition-colors duration-300 dark:bg-[#07100d] dark:text-white ${className}`}
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-brand-green/10 blur-[140px] dark:bg-[#b8f45f]/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-cyan/10 blur-[140px] dark:bg-[#61e6ff]/10" />

      {/* Full-screen Interactive Cyber Grid with box hover effects */}
      <InteractiveCyberGrid cols={14} rows={8} accentIndices={[32, 65, 66]} variant="adaptive" withMask={true} />

      {/* Top Header */}
      <header className="pointer-events-none relative z-20 flex w-full items-center justify-between p-6 sm:px-10 lg:px-16">
        <Link href="/" className="group pointer-events-auto flex items-center gap-3" aria-label="KAINARA home">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d] shadow-neon transition group-hover:-rotate-3">
            <KainaraLogo className="h-5 w-5" variant="solid" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-[#07100d] bg-brand-cyan" />
          </span>
          <span>
            <span className="block font-display text-sm font-black tracking-[0.17em]">KAINARA</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-brand-muted dark:text-white/40">
              Nutrition intelligence
            </span>
          </span>
        </Link>

        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            href="/docs"
            className="hidden items-center gap-1.5 rounded-xl border border-brand-border/70 bg-brand-surface/70 px-3.5 py-2 text-xs font-semibold text-brand-muted backdrop-blur transition hover:text-brand-green dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white sm:inline-flex"
          >
            Project docs
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {showThemeToggle && (
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border/80 bg-brand-surface/80 text-brand-muted shadow-sm backdrop-blur transition hover:border-brand-green/40 hover:bg-brand-green/10 hover:text-brand-green dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Hero Center Content */}
      <div className="pointer-events-none relative z-10 my-auto w-full max-w-7xl mx-auto px-6 py-8 sm:px-12 lg:px-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left Column: Error Info & Actions */}
          <div className="pointer-events-none order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-start">
            <div className="eyebrow inline-flex items-center gap-2 rounded-full border border-brand-green/25 bg-brand-green/10 px-3.5 py-1.5 text-brand-green dark:border-brand-accent/30 dark:bg-brand-accent/10 dark:text-brand-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(40,167,69,0.6)] dark:bg-brand-accent dark:shadow-[0_0_8px_rgba(184,244,95,0.8)]" />
              <span>Error {code} &bull; Page not found</span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-[-0.04em] text-brand-text dark:text-white sm:text-5xl lg:text-[4.25rem]">
              {title}
            </h1>

            <p className="mt-5 max-w-lg font-sans text-base leading-relaxed text-brand-muted dark:text-white/65 sm:text-lg">
              {description}
            </p>

            <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start">
              <Link
                href={buttonHref}
                className="group inline-flex items-center gap-2.5 rounded-2xl border border-brand-accent/70 bg-brand-accent px-6 py-3.5 text-sm font-extrabold text-[#07100d] shadow-neon transition-all duration-200 hover:scale-[1.02] hover:bg-brand-accent/90 hover:shadow-[0_0_36px_rgba(184,244,95,0.4)] active:scale-[0.98]"
              >
                <span>{buttonLabel}</span>
                <span className="flex items-center justify-center transition-transform duration-200 group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </span>
              </Link>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-brand-border/80 bg-brand-surface/70 px-5 py-3.5 text-sm font-bold text-brand-text backdrop-blur transition hover:border-brand-green/40 hover:bg-brand-green/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80 dark:hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Giant 404 */}
          <div className="pointer-events-none order-1 flex items-center justify-center lg:order-2 lg:justify-end">
            <span className="select-none font-sans text-[9rem] font-light leading-none tracking-tighter text-slate-900/[0.12] transition-colors duration-200 dark:text-white/70 sm:text-[12rem] md:text-[15rem] lg:text-[18rem]">
              {code}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status Footer */}
      <footer className="pointer-events-none relative z-20 flex w-full items-center justify-between p-6 sm:px-10 lg:px-16 text-xs text-brand-muted dark:text-white/40">
        <span className="font-mono text-[10px] uppercase tracking-wider">KAINARA &bull; Nutrition Intelligence</span>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider">System Operational</span>
        </div>
      </footer>
    </main>
  );
}

export default SystemErrorPanel;
