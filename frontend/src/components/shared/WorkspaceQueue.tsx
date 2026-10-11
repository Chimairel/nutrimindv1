'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Loader2, Search } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

/** Task navigation for split workspaces. Callers retain ordering, eligibility and actions. */
export function QueueHeader({
  title,
  description,
  count,
  search,
  onSearch,
  searchLabel,
}: {
  title: string;
  description: string;
  count: number;
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
}) {
  return (
    <header className="shrink-0 space-y-3 border-b border-brand-border/70 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-brand-text">{title}</h2>
        <span className="font-mono text-xs tabular-nums text-brand-muted" aria-label={`${count} queued items`}>
          {count}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">{description}</p>
      <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-bgAlt/35 px-3 focus-within:ring-2 focus-within:ring-brand-green/40">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-muted" />
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-10 w-full min-w-0 bg-transparent text-xs text-brand-text outline-none placeholder:text-brand-muted"
        />
      </label>
    </header>
  );
}

export function QueueList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="min-h-0 flex-1 divide-y divide-brand-border/60 overflow-y-auto overscroll-contain custom-scrollbar"
    >
      {children}
    </ul>
  );
}

export function QueueRow({
  title,
  selected,
  disabled,
  loading,
  onSelect,
  children,
}: {
  title: string;
  selected: boolean;
  disabled?: boolean;
  loading?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-busy={loading || undefined}
        disabled={disabled}
        onClick={onSelect}
        className={`group flex min-h-11 w-full items-start gap-2 border-l-[3px] py-3 pl-3 pr-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green disabled:cursor-not-allowed ${selected ? 'border-brand-green bg-brand-green/[0.08]' : 'border-transparent enabled:hover:bg-brand-bgAlt/65'}`}
      >
        <div className="min-w-0 flex-1 space-y-1.5 text-xs leading-relaxed">
          <span className="block break-words font-display text-sm font-bold text-brand-text [overflow-wrap:anywhere]">
            {title}
          </span>
          {children}
        </div>
        {loading ? (
          <Loader2 aria-label="Opening review" className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-green" />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-brand-green' : 'text-brand-muted/60'}`}
          />
        )}
      </button>
    </li>
  );
}

export function QueueSkeleton({ count = 5, label = 'Loading review queue items' }: { count?: number; label?: string }) {
  return (
    <div aria-label={label} aria-busy="true" className="divide-y divide-brand-border/60">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 px-3 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function queueLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}
