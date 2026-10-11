'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import { Search, Tags } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import CompositionEditor from './CompositionEditor';
import Input from '@/components/ui/Input';
import type { ApiEnvelope, FoodItem, FoodPage, FoodSource } from './types';
import { getApiError } from './types';

interface FoodCatalogueProps {
  source: FoodSource;
  readOnly?: boolean;
  onChanged?: (message: string) => Promise<void>;
  onError?: (message: string) => void;
}

export default function FoodCatalogue({ source, readOnly = false, onChanged, onError }: FoodCatalogueProps) {
  const ownerId = useAuth().user?.userId;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ search: '', page: 1 });
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [compositionFood, setCompositionFood] = useState<string | null>(null);
  const label = source === 'FNRI' ? 'FNRI' : 'USDA';
  const query = useSessionQuery<FoodPage>({
    ownerId,
    resource: JSON.stringify([readOnly ? 'rnd-food-catalogue' : 'admin-food-catalogue', source, filter]),
    fetcher: async () => {
      const response = await api.get<ApiEnvelope<FoodPage>>(
        readOnly ? '/nutritionist/food-catalogue' : '/admin/data/foods',
        {
          params: { source, page: filter.page, limit: 12, search: filter.search || undefined },
        }
      );
      return response.data.data;
    },
    errorMessage: `Could not load the ${label} catalogue.`,
  });
  const result = query.data;
  const loading = query.isLoading;

  async function findFoods(event?: FormEvent, page = 1) {
    event?.preventDefault();
    const next = { search: event ? search.trim() : filter.search, page };
    if (next.search === filter.search && next.page === filter.page) await query.refetch();
    else setFilter(next);
  }

  async function addAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !selected) return;
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    try {
      await api.post('/admin/data/food-aliases', { foodItemId: selected.id, alias: form.get('alias') });
      formElement.reset();
      setSelected(null);
      await query.refetch();
      await onChanged?.('Verified alias saved. New imports and food lookup can use it.');
    } catch (error) {
      onError?.(getApiError(error, 'Could not save the alias.'));
    }
  }

  return (
    <section>
      {!readOnly && compositionFood && (
        <CompositionEditor
          key={compositionFood}
          foodId={compositionFood}
          onClose={() => setCompositionFood(null)}
          onChanged={async () => {
            await query.refetch();
            await onChanged?.('Composition correction published; affected meals require review.');
          }}
        />
      )}
      <CatalogueFrame
        readOnly={readOnly}
        header={
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brand-green" />
            <div>
              <h2 className="font-display text-lg font-black">
                {label} {readOnly ? 'food references' : 'catalogue and aliases'}
              </h2>
              <p className="text-xs text-brand-muted">
                {readOnly
                  ? 'Values per 100 g. Match the cooked or raw food and its portion; unrecorded values remain unknown.'
                  : source === 'USDA_FDC'
                    ? 'Imported FoodData Central snapshot. Nutrient values are read-only; admins may add audited aliases.'
                    : 'Philippine food-composition records. Admins may review composition and add audited aliases.'}
              </p>
            </div>
          </div>
        }
      >
        <form className="flex gap-2" onSubmit={findFoods}>
          <Input
            label={`Search ${label} catalogue`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search canonical names or aliases"
          />
          <Button type="submit" variant="secondary" isLoading={loading}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
        <p aria-live="polite" className="mt-3 font-mono text-[10px] uppercase tracking-wider text-brand-muted">
          {loading ? 'Loading records…' : result ? `${result.total.toLocaleString()} matching records` : ''}
        </p>
        {query.error && (
          <p role="alert" className="mt-3 text-sm text-status-error-text">
            {query.error}
          </p>
        )}
        {result && (
          <div className="mt-4">
            <WorkspaceTable
              label={label + ' food catalogue'}
              rows={result.foods}
              rowKey={(food) => food.id}
              emptyMessage={'No ' + label + ' records match this search.'}
              columns={[
                {
                  key: 'food',
                  header: 'Food',
                  headerClassName: 'min-w-[180px]',
                  cell: (food: FoodItem) => <p className="font-bold">{food.name}</p>,
                },
                {
                  key: 'source',
                  header: 'Source',
                  headerClassName: 'min-w-[160px]',
                  cell: (food: FoodItem) => (
                    <>
                      <p>
                        {food.source === 'USDA_FDC' ? 'USDA FoodData Central' : food.source}
                        {food.sourceRecordId ? ' · ID ' + food.sourceRecordId : ''}
                        {food.sourceDataset ? ' · ' + food.sourceDataset : ''}
                      </p>
                      {food.sourceReferenceUrl && (
                        <a
                          href={food.sourceReferenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center text-brand-green hover:underline"
                        >
                          View source record
                        </a>
                      )}
                    </>
                  ),
                },
                {
                  key: 'nutrition',
                  header: 'Nutrition / 100 g',
                  headerClassName: 'min-w-[170px]',
                  cell: (food: FoodItem) => (
                    <span className="text-brand-muted">
                      {food.calories} kcal · P {food.proteinG} g · C {food.carbsG} g · F {food.fatG} g
                    </span>
                  ),
                },
                {
                  key: 'aliases',
                  header: 'Aliases',
                  headerClassName: 'min-w-[160px]',
                  cell: (food: FoodItem) => (
                    <div className="flex flex-wrap gap-1.5">
                      {food.aliases.map((alias) => (
                        <span
                          key={alias.id}
                          title={
                            alias.verifiedByAdmin
                              ? 'Verified by ' + alias.verifiedByAdmin.name
                              : alias.verifiedAt
                                ? 'Curated food alias'
                                : 'Legacy alias'
                          }
                          className={
                            'rounded-full border px-2.5 py-1 text-[10px] ' +
                            (alias.verifiedAt
                              ? 'border-brand-green/25 bg-brand-green/10 text-brand-green'
                              : 'border-brand-border text-brand-muted')
                          }
                        >
                          {alias.alias}
                          {alias.verifiedAt ? ' ✓' : ''}
                        </span>
                      ))}
                      {!food.aliases.length && <span className="text-brand-muted">No aliases</span>}
                    </div>
                  ),
                },
                {
                  key: 'nutrients',
                  header: 'Additional nutrients / 100 g',
                  headerClassName: 'min-w-[190px]',
                  cell: (food: FoodItem) => (
                    <dl className="space-y-1 text-xs text-brand-muted">
                      {(
                        [
                          ['Sodium', food.sodium, 'mg'],
                          ['Sugar', food.sugar, 'g'],
                          ['Fiber', food.fiber, 'g'],
                          ['Potassium', food.potassium, 'mg'],
                          ['Phosphorus', food.phosphorus, 'mg'],
                          ['Saturated fat', food.saturatedFat, 'g'],
                        ] as const
                      ).map(([label, value, unit]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <dt>{label}</dt>
                          <dd className="tabular-nums text-brand-text">
                            {value == null ? 'Not recorded' : `${value} ${unit}`}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  headerClassName: 'min-w-[150px]',
                  cell: (food: FoodItem) => (
                    <div className="flex flex-wrap gap-2">
                      {food.source !== 'USDA_FDC' && (
                        <Button size="sm" variant="ghost" onClick={() => setCompositionFood(food.id)}>
                          Composition
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setSelected(food)}>
                        Add alias
                      </Button>
                    </div>
                  ),
                },
              ].filter((column) => (readOnly ? column.key !== 'actions' : column.key !== 'nutrients'))}
            />
          </div>
        )}
        {result && result.totalPages > 1 && (
          <nav aria-label="Food catalogue pages" className="mt-5 flex items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || result.page <= 1}
              onClick={() => void findFoods(undefined, result.page - 1)}
            >
              Previous
            </Button>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Page {result.page} of {result.totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || result.page >= result.totalPages}
              onClick={() => void findFoods(undefined, result.page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
        {!readOnly && selected && (
          <form
            role="region"
            aria-labelledby="verified-alias-heading"
            onSubmit={addAlias}
            className="mt-5 rounded-[24px] border border-brand-green/20 bg-brand-green/5 p-5"
          >
            <p id="verified-alias-heading" className="font-bold text-brand-text">
              Add a verified alias for {selected.name}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Aliases affect food matching, so collisions with another composition record are rejected and every change
              is audited.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                name="alias"
                label="Verified alias"
                placeholder="Example: boiled egg"
                minLength={2}
                required
                autoFocus
              />
              <Button type="submit">Verify alias</Button>
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CatalogueFrame>
    </section>
  );
}

function CatalogueFrame({ readOnly, header, children }: { readOnly: boolean; header: ReactNode; children: ReactNode }) {
  return readOnly ? (
    <div className="space-y-4">
      {header}
      {children}
    </div>
  ) : (
    <Card header={header}>{children}</Card>
  );
}
