'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, BrainCircuit, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';

export default function PublicHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border/60 bg-brand-bg/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="group flex items-center gap-3" aria-label="NutriMind home">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d] shadow-neon transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <BrainCircuit className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-brand-bg bg-brand-cyan" />
          </span>
          <span>
            <span className="block font-display text-sm font-black tracking-[0.17em] text-brand-text">NUTRIMIND</span>
            <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-brand-muted sm:block">Nutrition intelligence</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-brand-border/60 bg-brand-surface/55 p-1 backdrop-blur-xl md:flex" aria-label="Public navigation">
          <Link href="/#platform" className="rounded-xl px-4 py-2 text-xs font-semibold text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-text">Platform</Link>
          <Link href="/#process" className="rounded-xl px-4 py-2 text-xs font-semibold text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-text">How it works</Link>
          <Link
            href="/docs"
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${pathname === '/docs' ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'}`}
          >
            Docs
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-border/70 bg-brand-surface/70 text-brand-muted outline-none transition hover:border-brand-green/30 hover:text-brand-green focus:ring-2 focus:ring-brand-green/30"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/login" className="hidden rounded-2xl px-4 py-2.5 text-xs font-bold text-brand-text transition hover:bg-brand-surface/70 sm:block">Log in</Link>
          <Link href="/register" className="flex items-center gap-2 rounded-2xl bg-brand-accent px-4 py-2.5 text-xs font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-0.5 hover:brightness-105">
            Get started
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
