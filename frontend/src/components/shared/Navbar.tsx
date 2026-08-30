'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/context/ThemeContext';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  return (
    <header className="relative z-30 flex h-[72px] w-full shrink-0 items-center justify-end border-b border-brand-border/50 bg-brand-surface/40 px-3 backdrop-blur-xl md:px-5">
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-brand-border/70 bg-brand-surface/75 text-brand-muted shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green/40"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <NotificationDropdown />
      </div>
    </header>
  );
};

export default Navbar;
