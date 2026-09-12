'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, ShoppingCart, Sparkles } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { fetchCurrentGrocery, type GroceryPageSnapshot } from '@/features/grocery/current-grocery';

type GroceryPreviewCardProps = {
  ownerId?: string;
  onNavigateToGrocery: () => void;
};

export function GroceryPreviewCard({ ownerId, onNavigateToGrocery }: GroceryPreviewCardProps) {
  const cachedPage = readSessionResource<GroceryPageSnapshot>(ownerId, 'user-grocery-page');
  const [snapshot, setSnapshot] = useState<{ ownerId?: string; data: GroceryPageSnapshot | null }>({
    ownerId,
    data: cachedPage,
  });
  const [isLoading, setIsLoading] = useState(!cachedPage && Boolean(ownerId));
  const [error, setError] = useState(false);
  const current = snapshot.ownerId === ownerId ? snapshot.data : cachedPage;
  const groceryList = current?.groceryList ?? null;
  const pendingMealCount = current?.pendingMealCount ?? 0;

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    setError(false);
    setIsLoading(!readSessionResource(ownerId, 'user-grocery-page'));
    fetchCurrentGrocery()
      .then((data) => {
        if (!active) return;
        setSnapshot({ ownerId, data });
        writeSessionResource(ownerId, 'user-grocery-page', data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerId]);

  const items = groceryList?.groceryItems ?? [];
  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.isChecked).length;
  const remainingItems = items.filter((i) => !i.isChecked);
  const previewItems = (remainingItems.length > 0 ? remainingItems : items).slice(0, 4);

  return (
    <Card className="dashboard-surface relative overflow-hidden p-5 text-left" contentClassName="p-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-brand-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-green/30 bg-brand-green/10 text-brand-green">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-text">Grocery Checklist</h3>
            <p className="text-[10px] text-brand-muted">{groceryList?.weekLabel || 'Current plan ingredients'}</p>
          </div>
        </div>

        {totalCount > 0 && (
          <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-2 py-0.5 text-[9px] font-extrabold text-brand-green">
            {checkedCount}/{totalCount} bought
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        {pendingMealCount > 0 && (
          <p
            role="status"
            className="mb-3 rounded-xl bg-status-pending-bg p-3 text-xs font-semibold text-status-pending-text"
          >
            {pendingMealCount} meal{pendingMealCount === 1 ? '' : 's'} awaiting review. Pending ingredients are
            excluded.
          </p>
        )}
        {error ? (
          <div role="alert" className="py-3 text-xs text-status-error-text">
            Could not confirm the current checklist. Open Grocery to retry before shopping.
            <Button variant="secondary" size="sm" onClick={onNavigateToGrocery} className="mt-3 w-full">
              Open Grocery
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 py-2">
            <div className="h-4 w-3/4 rounded bg-brand-bgAlt animate-pulse motion-reduce:animate-none" />
            <div className="h-4 w-1/2 rounded bg-brand-bgAlt animate-pulse motion-reduce:animate-none" />
          </div>
        ) : totalCount === 0 ? (
          <div className="py-3 text-center">
            <p className="text-xs font-semibold text-brand-muted">No approved ingredients available for this cycle.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToGrocery}
              className="mt-3 w-full text-xs font-bold"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-brand-green" />
              Open Grocery
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-1.5" aria-label="Grocery preview items">
              {previewItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-brand-bgAlt/50 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        item.isChecked
                          ? 'border-brand-green bg-brand-green text-black'
                          : 'border-brand-border bg-brand-surface'
                      }`}
                    >
                      {item.isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`truncate text-[11px] font-semibold ${
                        item.isChecked ? 'line-through text-brand-muted/70' : 'text-brand-text'
                      }`}
                    >
                      {item.ingredientName}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-brand-surface px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-brand-muted border border-brand-border/40">
                    {item.category}
                  </span>
                </li>
              ))}
            </ul>

            {(remainingItems.length > 0 ? remainingItems.length : totalCount) > 4 && (
              <p className="text-center text-[10px] font-medium text-brand-muted">
                +{(remainingItems.length > 0 ? remainingItems.length : totalCount) - 4} more ingredients in checklist
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToGrocery}
              className="mt-2 w-full justify-between text-xs font-bold text-brand-green hover:text-brand-greenHover hover:bg-brand-green/10"
            >
              <span>View full checklist</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
