'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import MealImage from '@/components/user/MealImage';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';

type Props =
  | { meal: PendingMealPreview; pending: true; onOpen?: never; onStatusToggle?: never }
  | {
      meal: MealPlan;
      pending?: false;
      onOpen: () => void;
      onStatusToggle?: (id: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
    };

export function DashboardMealRow(props: Props) {
  const { meal } = props;
  const [saving, setSaving] = useState(false);
  const completed = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'DONE');
  const skipped = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'SKIPPED');
  const content = (
    <>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
        <MealImage
          mealName={meal.mealName}
          mealType={meal.mealType}
          ingredients={meal.ingredients}
          image={props.pending ? undefined : props.meal.image}
          variant="thumbnail"
        />
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold capitalize text-brand-green">{meal.mealType.toLowerCase()}</span>
        <span className="mt-1 block font-display text-sm font-semibold leading-relaxed text-brand-text sm:text-base">
          {meal.mealName}
        </span>
        <span className="mt-1 block text-xs text-brand-muted">
          {Math.round(meal.calories)} kcal · {Math.round(meal.proteinG)}g protein
        </span>
        {props.pending && (
          <span className="mt-1 block text-xs text-status-pending-text">Pending review · View preview</span>
        )}
      </span>
    </>
  );
  if (props.pending)
    return (
      <details className="dashboard-meal group p-4">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl [&::-webkit-details-marker]:hidden">
          {content}
          <ChevronDown className="h-4 w-4 shrink-0 text-brand-muted group-open:rotate-180" />
        </summary>
        <div className="mt-3 rounded-xl bg-brand-bgAlt p-4 text-sm leading-relaxed text-brand-muted">
          <p className="font-semibold text-status-pending-text">Pending nutritionist review</p>
          {meal.description && <p className="mt-2">{meal.description}</p>}
          <p className="mt-2">
            <strong className="text-brand-text">Ingredients: </strong>
            {meal.ingredients?.map((item) => item.ingredientName).join(', ') || 'Ingredient preview unavailable.'}
          </p>
        </div>
      </details>
    );
  return (
    <article className="dashboard-meal p-4">
      <button
        type="button"
        onClick={props.onOpen}
        aria-label={`Open ${meal.mealName} details`}
        className="flex w-full items-center gap-3 rounded-xl text-left"
      >
        {content}
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-[92px]">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${props.meal.status === 'APPROVED' ? 'bg-brand-greenLight text-brand-green' : 'bg-status-pending-bg text-status-pending-text'}`}
        >
          {completed
            ? 'Eaten'
            : skipped
              ? 'Skipped'
              : props.meal.status === 'APPROVED'
                ? 'Approved'
                : 'Awaiting review'}
        </span>
        {props.onStatusToggle && props.meal.status === 'APPROVED' && (
          <button
            type="button"
            disabled={saving}
            aria-label={`Mark ${meal.mealName} as ${completed ? 'not eaten' : 'eaten'}`}
            onClick={async () => {
              setSaving(true);
              try {
                await props.onStatusToggle?.(props.meal.id, completed ? 'PENDING' : 'DONE');
              } finally {
                setSaving(false);
              }
            }}
            className="dashboard-action inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? 'Saving…' : completed ? 'Undo eaten' : 'Mark as eaten'}
          </button>
        )}
      </div>
    </article>
  );
}
