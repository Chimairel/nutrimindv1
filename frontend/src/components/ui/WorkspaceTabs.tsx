'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export default function WorkspaceTabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className = '',
  tone = 'accent',
  size = 'md',
  animateIndicator = true,
  stackOnMobile = false,
}: {
  value: T;
  onChange?: (value: T) => void;
  items: ReadonlyArray<{
    value: T;
    label: ReactNode;
    href?: string;
    icon?: ReactNode;
    count?: ReactNode;
    countLabel?: string;
  }>;
  label: string;
  className?: string;
  tone?: 'accent' | 'accentSoft';
  size?: 'sm' | 'md';
  animateIndicator?: boolean;
  stackOnMobile?: boolean;
}) {
  const activeIndex = items.findIndex((item) => item.value === value);
  const activeFill = tone === 'accentSoft' ? 'bg-brand-accentSoft' : 'bg-brand-accent';
  return (
    <nav
      aria-label={label}
      className={`relative flex w-full gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-sm ${stackOnMobile ? 'flex-col sm:flex-row' : ''} ${className}`}
    >
      {activeIndex >= 0 && (
        // Keep the highlight in this rail's coordinates. Shared layout projection can
        // animate page scrolling or content resizing as if the selected tab moved.
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-1.5 ${stackOnMobile ? 'hidden sm:block' : ''}`}
        >
          <div
            aria-hidden="true"
            data-workspace-tab-indicator
            className={`absolute inset-y-0 ${animateIndicator ? 'transition-[left] duration-200 ease-out motion-reduce:transition-none' : ''} ${size === 'sm' ? 'rounded-xl' : 'rounded-2xl'} shadow-sm ${activeFill}`}
            style={{
              // gap-1 is 0.25rem; equal flex items share the remaining rail width.
              width: `calc((100% - ${(items.length - 1) * 0.25}rem) / ${items.length})`,
              left: `calc(${(activeIndex * 100) / items.length}% + ${(activeIndex * 0.25) / items.length}rem)`,
            }}
          />
        </div>
      )}
      {items.map((item) => {
        const active = value === item.value;
        const mobileFill = active && stackOnMobile ? `${activeFill} sm:bg-transparent sm:dark:bg-transparent` : '';
        const classes = `group relative flex min-w-0 flex-1 items-center justify-center gap-2 font-display font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green ${size === 'sm' ? 'min-h-9 rounded-xl px-2.5 text-[11px] sm:text-xs' : 'min-h-12 rounded-2xl px-3 text-xs sm:text-sm'} ${active ? 'text-[#07100d]' : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'} ${mobileFill}`;
        const content = (
          <>
            <span className="relative z-10 flex items-center justify-center gap-2">
              {item.icon}
              {item.label}
              {item.count != null && (
                <span
                  aria-label={item.countLabel}
                  className="rounded-full bg-brand-bgAlt/25 px-1.5 py-0.5 font-mono text-[9px]"
                >
                  {item.count}
                </span>
              )}
            </span>
          </>
        );
        return item.href ? (
          <Link key={item.value} href={item.href} aria-current={active ? 'page' : undefined} className={classes}>
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange?.(item.value)}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
