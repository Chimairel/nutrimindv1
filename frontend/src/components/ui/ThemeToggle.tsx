'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`
        inline-flex items-center justify-center rounded-xl border transition-all duration-200 outline-none
        shadow-sm backdrop-blur-md
        border-brand-border/80 bg-brand-surface/80 text-brand-text hover:border-brand-green/40 hover:bg-brand-bgAlt/80
        dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.1]
        focus-visible:ring-2 focus-visible:ring-brand-green/50 dark:focus-visible:ring-brand-accent/50
        ${sizeClasses[size]}
        ${className}
      `}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className={`${iconSizes[size]} text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45`} />
      ) : (
        <Moon className={`${iconSizes[size]} text-brand-text transition-transform duration-300 rotate-0 hover:-rotate-12`} />
      )}
    </button>
  );
};

export default ThemeToggle;
