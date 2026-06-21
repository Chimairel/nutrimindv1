'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/context/ThemeContext';
import Avatar from '@/components/ui/Avatar';
import NotificationDropdown from '@/components/shared/NotificationDropdown';
import { Brain } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-brand-border bg-brand-bg/80 px-6 backdrop-blur-md">
      {/* Brand header for mobile layouts (since Sidebar hides) */}
      <div className="flex items-center gap-2 md:hidden">
        <Brain className="w-5 h-5 text-brand-green" />
        <span className="font-extrabold text-sm tracking-wider text-brand-green font-display">NUTRIMIND</span>
      </div>

      
      {/* Active profile logs on desktop views */}
      <div className="hidden md:block text-xs font-semibold text-brand-muted tracking-wide">
        Welcome back, <span className="text-brand-text">{user.name}</span>
      </div>

      {/* Interactive Toolbar */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-brand-bgAlt/50 text-brand-text hover:text-brand-green hover:border-brand-green/30 hover:scale-105 active:scale-95 transition-all duration-200 outline-none cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
        </button>

        <NotificationDropdown />

        {/* Divider */}
        <div className="h-6 w-px bg-brand-border" />

        {/* User Profile Identifier wrapper */}
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" src={user.image} fallbackText={user.name} />
          <span className="hidden sm:inline text-xs font-bold text-brand-text truncate max-w-[120px]">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
