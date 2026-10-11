'use client';

import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type Model = Extract<ReturnType<typeof useOutsideMealFormModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'estimates' | 'handleSubmit' | 'props'> };
export default function OutsideMealConfirmationSection({ model }: SectionProps) {
  const { estimates, handleSubmit, props } = model;

  return (
    <>
      <div className="rounded-xl border border-brand-green/20 bg-gradient-to-r from-brand-green/10 via-brand-surface to-brand-accent/5 p-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-brand-text">Need help estimating macros?</p>
            <p className="text-[11px] text-brand-muted leading-tight">
              Grams and notes are optional. AI calculates provisional macros from food names.
              {estimates && (
                <span className="ml-1 text-brand-green font-semibold">
                  ({estimates.remaining}/{estimates.cap} AI estimates left ·{' '}
                  <Link href="/membership" className="underline hover:text-brand-green/80">
                    Plan
                  </Link>
                  )
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={props.isLoading || !props.mealName.trim() || estimates?.remaining === 0}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 rounded-lg border border-brand-green/40 bg-brand-green/15 hover:bg-brand-green/25 px-3 py-1.5 text-xs font-bold text-brand-green transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Get AI estimate
        </button>
      </div>
    </>
  );
}
