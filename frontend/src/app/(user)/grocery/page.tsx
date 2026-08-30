'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Progress from '@/components/ui/Progress';
import axios from 'axios';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheckBig,
  Download,
  ListFilter,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBasket,
  ShoppingCart,
} from 'lucide-react';


interface GroceryItem {
  id: string;
  ingredientName: string;
  category: string;
  isChecked: boolean;
}

interface GroceryList {
  id: string;
  weekLabel: string;
  generatedAt: string;
  groceryItems: GroceryItem[];
}

type GroceryFilter = 'all' | 'remaining' | 'packed';

const normalizeCategory = (category?: string) => category?.trim() || 'Other';

const getInitialExpandedCategory = (items: GroceryItem[]) => {
  const firstRemaining = items.find((item) => !item.isChecked);
  return normalizeCategory(firstRemaining?.category || items[0]?.category);
};

export default function GroceryListPage() {
  const { user } = useAuth();
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroceryFilter>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetches current user grocery list
  const fetchGroceryList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/grocery/current');
      if (res.data && res.data.success) {
        const nextList = res.data.data as GroceryList;
        setGroceryList(nextList);
        setExpandedCategories(new Set([getInitialExpandedCategory(nextList.groceryItems)]));
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to retrieve grocery list.');
      } else {
        setError('Failed to contact backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroceryList();
    }
  }, [user]);

  // Generates grocery list from active meal plan
  const handleGenerateList = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/grocery/generate');
      if (res.data && res.data.success) {
        const nextList = res.data.data as GroceryList;
        setGroceryList(nextList);
        setExpandedCategories(new Set([getInitialExpandedCategory(nextList.groceryItems)]));
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to generate grocery list from meal plan.');
      } else {
        setError('Failed to reach server to compile ingredients.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggles grocery item checked status
  const handleToggleItem = async (itemId: string) => {
    if (!groceryList) return;

    // Optimistically update frontend UI
    const updatedItems = groceryList.groceryItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, isChecked: !item.isChecked };
      }
      return item;
    });
    setGroceryList({ ...groceryList, groceryItems: updatedItems });

    try {
      await api.patch(`/user/grocery/items/${itemId}/toggle`);
    } catch (err) {
      console.error('[Grocery] Toggle failed, reverting state.', err);
      // Revert frontend UI on error
      fetchGroceryList();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get('/user/grocery/pdf', {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `NutriMind_Grocery_List_${groceryList?.weekLabel || 'Current'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[Grocery] Failed to download PDF:', err);
      alert('Failed to generate PDF. Make sure you have an active grocery list.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const getGroupedItems = () => {
    if (!groceryList) return {};
    const grouped: Record<string, GroceryItem[]> = {};

    groceryList.groceryItems.forEach((item) => {
      const cat = normalizeCategory(item.category);
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });

    return grouped;
  };

  const groupedItems = getGroupedItems();
  const totalItems = groceryList?.groceryItems.length || 0;
  const checkedItems = groceryList?.groceryItems.filter((i) => i.isChecked).length || 0;
  const remainingItems = totalItems - checkedItems;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = Object.entries(groupedItems)
    .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
    .map(([category, items]) => {
      const visibleItems = items
        .filter((item) => {
          const matchesSearch = !normalizedQuery || item.ingredientName.toLowerCase().includes(normalizedQuery);
          const matchesFilter = filter === 'all'
            || (filter === 'remaining' && !item.isChecked)
            || (filter === 'packed' && item.isChecked);
          return matchesSearch && matchesFilter;
        })
        .sort((itemA, itemB) => Number(itemA.isChecked) - Number(itemB.isChecked)
          || itemA.ingredientName.localeCompare(itemB.ingredientName));

      return { category, items, visibleItems };
    })
    .filter(({ visibleItems }) => visibleItems.length > 0);
  const visibleItemCount = visibleGroups.reduce((sum, group) => sum + group.visibleItems.length, 0);
  const allVisibleCategoriesExpanded = visibleGroups.length > 0
    && visibleGroups.every(({ category }) => expandedCategories.has(category));

  const toggleCategory = (category: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleAllVisibleCategories = () => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      visibleGroups.forEach(({ category }) => {
        if (allVisibleCategoriesExpanded) next.delete(category);
        else next.add(category);
      });
      return next;
    });
  };

  return (
    <div className="portal-page max-w-5xl text-brand-text">
      
      {/* HEADER SECTION */}
      <PortalPageHeader
        icon={ShoppingCart}
        eyebrow="Plan companion"
        title="Smart grocery list"
        description="A categorized shopping checklist compiled from your active meal plan."
        className="mb-6"
        actions={groceryList ? <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 text-xs font-semibold py-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerateList}
              disabled={isGenerating}
              className="text-xs font-bold py-2 bg-brand-surface/80 border-brand-border/80 hover:bg-brand-border hover:text-brand-green transition-all flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-compiling...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate List</span>
                </>
              )}
            </Button>
          </div> : undefined}
      />

      {error && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* NO ACTIVE GROCERY LIST */}
      {!groceryList ? (
        <div className="py-12">
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8 text-brand-green" />}
            title="No Active Grocery Checklist"
            description="Generate a categorized shopping checklist compiling the ingredients needed for your personalized 7-day meal plan."
            actionText="Generate Grocery Checklist"
            onAction={handleGenerateList}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5 text-left">
          <section className="overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface shadow-card">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-green/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-green">
                    {groceryList.weekLabel || 'Current week'}
                  </span>
                  <span className="text-[11px] text-brand-muted">
                    {totalItems} ingredients across {Object.keys(groupedItems).length} categories
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl font-black tracking-tight text-brand-text sm:text-3xl">
                      {remainingItems === 0 ? 'Shopping complete' : `${remainingItems} left to pack`}
                    </p>
                    <p className="mt-1 text-xs text-brand-muted">{checkedItems} of {totalItems} items packed</p>
                  </div>
                  <span className="font-display text-3xl font-black text-brand-green sm:text-4xl">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="mt-4 h-2.5 bg-brand-bgAlt" />
              </div>

              <div className="grid grid-cols-3 gap-2 lg:min-w-[310px]">
                {[
                  { label: 'To buy', value: remainingItems, icon: ShoppingBasket },
                  { label: 'Packed', value: checkedItems, icon: PackageCheck },
                  { label: 'Categories', value: Object.keys(groupedItems).length, icon: ListFilter },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div key={metric.label} className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/55 px-3 py-3.5">
                      <MetricIcon className="h-4 w-4 text-brand-green" />
                      <p className="mt-3 font-display text-xl font-black text-brand-text">{metric.value}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-brand-muted">{metric.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search grocery items</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ingredients..."
                  className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 pl-10 pr-4 text-xs font-semibold text-brand-text outline-none transition placeholder:text-brand-muted/70 focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
                />
              </label>

              <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-brand-bgAlt/70 p-1" aria-label="Filter grocery items">
                {([
                  ['all', 'All', totalItems],
                  ['remaining', 'To buy', remainingItems],
                  ['packed', 'Packed', checkedItems],
                ] as const).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-bold transition lg:flex-none ${
                      filter === value
                        ? 'bg-brand-surface text-brand-text shadow-sm'
                        : 'text-brand-muted hover:text-brand-green'
                    }`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] ${filter === value ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-border/50'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleAllVisibleCategories}
                disabled={visibleGroups.length === 0}
                className="h-10 shrink-0 rounded-xl px-3 text-[10px] font-bold text-brand-green outline-none transition hover:bg-brand-green/10 focus-visible:ring-2 focus-visible:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {allVisibleCategoriesExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-brand-muted">
              Showing {visibleItemCount} of {totalItems} ingredients
            </p>
          </section>

          {visibleGroups.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-brand-border bg-brand-surface/45 px-6 text-center">
              <Search className="h-7 w-7 text-brand-muted/60" />
              <p className="mt-3 text-sm font-bold text-brand-text">No ingredients found</p>
              <p className="mt-1 text-xs text-brand-muted">Try another search or choose a different status filter.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="mt-4 rounded-xl bg-brand-green/10 px-4 py-2 text-[11px] font-bold text-brand-green transition hover:bg-brand-green/15"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map(({ category, items, visibleItems }) => {
                const completedCount = items.filter((item) => item.isChecked).length;
                const categoryPercent = Math.round((completedCount / items.length) * 100);
                const isExpanded = expandedCategories.has(category) || Boolean(normalizedQuery);

                return (
                  <section key={category} className="overflow-hidden rounded-[22px] border border-brand-border/70 bg-brand-surface shadow-sm transition hover:border-brand-green/20">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left outline-none transition hover:bg-brand-green/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/30 sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-green/10 text-brand-green">
                        <ShoppingBasket className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate font-display text-sm font-bold text-brand-text">{category}</span>
                          <span className="shrink-0 text-[10px] font-bold text-brand-muted">{completedCount}/{items.length} packed</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-brand-bgAlt">
                          <span className="block h-full rounded-full bg-brand-green transition-all" style={{ width: `${categoryPercent}%` }} />
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-brand-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-brand-border/60 bg-brand-bgAlt/30 p-3 sm:p-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {visibleItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggleItem(item.id)}
                              aria-pressed={item.isChecked}
                              className={`group flex min-h-12 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/30 ${
                                item.isChecked
                                  ? 'border-brand-green/15 bg-brand-green/[0.055] text-brand-muted'
                                  : 'border-brand-border/65 bg-brand-surface text-brand-text hover:-translate-y-px hover:border-brand-green/25 hover:shadow-sm'
                              }`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                                item.isChecked
                                  ? 'border-brand-green bg-brand-green text-white'
                                  : 'border-brand-border bg-brand-bgAlt group-hover:border-brand-green/50'
                              }`}>
                                {item.isChecked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                              </span>
                              <span className={`min-w-0 text-xs font-semibold leading-snug ${item.isChecked ? 'line-through decoration-brand-green/50' : ''}`}>
                                {item.ingredientName}
                              </span>
                              {item.isChecked && <CircleCheckBig className="ml-auto h-3.5 w-3.5 shrink-0 text-brand-green" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
