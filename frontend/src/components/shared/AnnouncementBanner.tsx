'use client';

import React from 'react';
import Link from 'next/link';

export interface AnnouncementBannerAction {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export interface AnnouncementBannerProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  badge?: React.ReactNode;
  action?: AnnouncementBannerAction;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  variant?: 'clinical' | 'warning' | 'info';
}

const variantStyles: Record<'clinical' | 'warning' | 'info', string> = {
  clinical: 'bg-[#8c3b00] text-white',
  warning: 'bg-[#8c3b00] text-white',
  info: 'bg-brand-surface/90 text-brand-text border border-brand-border',
};

export default function AnnouncementBanner({
  title,
  message,
  badge,
  action,
  children,
  className = '',
  ariaLabel = 'Important announcement',
  variant = 'clinical',
}: AnnouncementBannerProps) {
  const bgAndText = variantStyles[variant] || variantStyles.clinical;

  return (
    <aside
      aria-label={ariaLabel}
      className={`w-full rounded-2xl ${bgAndText} px-4 py-2.5 text-center text-xs font-medium shadow-sm sm:text-sm flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      {title && <span className="font-bold">{title}</span>}
      {badge}
      {message && <span className="text-white/90">{message}</span>}
      {children}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className={`inline-flex items-center justify-center rounded-xl bg-white px-3 py-1 text-xs font-bold text-[#8c3b00] shadow-sm hover:bg-white/90 transition-all shrink-0 ml-1 ${action.className || ''}`}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={`inline-flex items-center justify-center rounded-xl bg-white px-3 py-1 text-xs font-bold text-[#8c3b00] shadow-sm hover:bg-white/90 transition-all shrink-0 ml-1 ${action.className || ''}`}
          >
            {action.label}
          </button>
        )
      )}
    </aside>
  );
}
