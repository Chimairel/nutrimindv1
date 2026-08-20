'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrainCircuit, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/context/ThemeContext';
import Avatar from '@/components/ui/Avatar';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

const getPageTitle = (pathname: string) => {
  const routes: Array<[string, string]> = [
    ['/nutritionist/reviews', 'Clinical review queue'],
    ['/nutritionist/patients', 'Patient directory'],
    ['/nutritionist/approved', 'Approved plans'],
    ['/nutritionist/library', 'Meal intelligence library'],
    ['/nutritionist/profile', 'Professional profile'],
    ['/admin/overview', 'System overview'],
    ['/admin/users', 'User management'],
    ['/admin/nutritionists', 'Nutritionist verification'],
    ['/admin/analytics', 'Platform analytics'],
    ['/dashboard', 'Today overview'],
    ['/meals', 'Weekly meal plan'],
    ['/grocery', 'Smart grocery list'],
    ['/progress', 'Health progress'],
    ['/profile', 'Your profile'],
  ];

  return routes.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1] || 'NutriMind workspace';
};

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const firstName = user.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <header className="relative z-30 flex h-[72px] w-full shrink-0 items-center justify-between px-3 md:px-5">
      <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="NutriMind home">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent text-[#07100d] shadow-neon">
          <BrainCircuit className="h-[18px] w-[18px]" />
        </span>
        <span className="font-display text-sm font-extrabold tracking-[0.13em] text-brand-text">NUTRIMIND</span>
      </Link>

      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-brand-accent to-brand-cyan" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold tracking-tight text-brand-text">{getPageTitle(pathname)}</p>
          <p className="mt-0.5 truncate text-[11px] text-brand-muted">Good to see you, {firstName}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="mr-1 hidden items-center gap-2 rounded-full border border-brand-border/70 bg-brand-surface/60 px-3 py-1.5 backdrop-blur-md lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan shadow-[0_0_10px_rgba(34,211,238,0.75)]" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-muted">System online</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-border/70 bg-brand-surface/70 text-brand-muted shadow-sm outline-none backdrop-blur-md transition hover:-translate-y-0.5 hover:border-brand-green/30 hover:text-brand-green focus:ring-2 focus:ring-brand-green/30"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <NotificationDropdown />

        <div className="mx-1 hidden h-7 w-px bg-brand-border/70 sm:block" />

        <div className="flex items-center gap-2.5 rounded-2xl border border-transparent p-1 sm:pr-2">
          <Avatar size="sm" src={user.image} fallbackText={user.name} className="h-9 w-9 rounded-xl" />
          <div className="hidden max-w-[140px] sm:block">
            <p className="truncate text-xs font-bold text-brand-text">{user.name}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-brand-muted">{user.role.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
