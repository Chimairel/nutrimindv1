import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { LibraryMeal } from './useNutritionistLibrary';

type FoodResult = {
  id: string;
  name: string;
  source: string;
  sourceRecordId: string | null;
  sourceReferenceUrl: string | null;
};
type Row = {
  id: string;
  label: string;
  foodItemId: string;
  foodName: string;
  source: string;
  recordId: string;
  referenceUrl: string;
  grams: string;
};

export function PrepareLibraryNutritionEvidence({
  meal,
  close,
  refresh,
}: {
  meal: LibraryMeal;
  close: () => void;
  refresh: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (meal.ingredients ?? []).map((item) => ({
      id: item.id,
      label: item.ingredientName,
      foodItemId:
        item.foodItem?.source === 'FNRI' || item.foodItem?.source === 'USDA_FDC' ? (item.foodItemId ?? '') : '',
      foodName: item.foodItem?.name ?? '',
      source: item.foodItem?.source ?? '',
      recordId: item.foodItem?.sourceRecordId ?? '',
      referenceUrl: item.foodItem?.sourceReferenceUrl ?? '',
      grams: item.unit === 'g' && item.quantity ? String(item.quantity) : '',
    }))
  );
  const [portionBasis, setPortionBasis] = useState('');
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'FNRI' | 'USDA_FDC'>('FNRI');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRow || term.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get('/nutritionist/library/composition-foods', {
          params: { search: term.trim(), source: sourceFilter },
        });
        if (!cancelled) setResults(response.data?.data ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeRow, term, sourceFilter]);

  const complete =
    rows.length > 0 && rows.every((row) => row.foodItemId && Number(row.grams) > 0 && Number(row.grams) <= 5000);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete || portionBasis.trim().length < 20) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/nutritionist/library/${meal.id}/nutrition-evidence/prepare`, {
        expectedRevision: meal.safetyEvidenceRevision,
        portionBasis: portionBasis.trim(),
        ingredients: rows.map((row) => ({
          id: row.id,
          foodItemId: row.foodItemId,
          gramsPerServing: Number(row.grams),
        })),
      });
      await refresh();
      close();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not prepare the recipe. Check the records and amounts.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={close} title="Prepare recipe nutrition" size="lg">
      <form onSubmit={submit} className="space-y-4 text-sm text-brand-text">
        <p className="text-xs leading-relaxed text-brand-muted">
          For one serving of {meal.mealName}, choose the specific edible food for each ingredient and record its edible
          grams. Cups, pieces, and “to taste” amounts need a measured or documented gram estimate. The server will
          calculate the recipe nutrition from those records.
        </p>
        {error && (
          <p role="alert" className="rounded-lg border border-red-800 p-3 text-xs text-red-300">
            {error}
          </p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-brand-border p-3 space-y-2">
            <p className="font-semibold">{row.label}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                className="rounded-lg border border-brand-border px-3 py-2 text-left text-xs hover:border-brand-green"
                onClick={() => {
                  setActiveRow(row.id);
                  setTerm(row.label);
                  setSourceFilter(row.source === 'USDA_FDC' ? 'USDA_FDC' : 'FNRI');
                }}
              >
                {row.foodItemId
                  ? `${row.foodName} · ${row.source}${row.recordId ? ` · ${row.recordId}` : ''}`
                  : 'Choose FNRI or USDA food record'}
              </button>
              <label className="flex items-center gap-2 text-xs">
                Edible g per serving
                <input
                  aria-label={`${row.label} edible grams per serving`}
                  type="number"
                  min="0.01"
                  max="5000"
                  step="any"
                  value={row.grams}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) => (item.id === row.id ? { ...item, grams: event.target.value } : item))
                    )
                  }
                  className="w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-2 text-brand-text"
                />
              </label>
            </div>
            {activeRow === row.id && (
              <div className="space-y-2 rounded-lg border border-brand-border bg-brand-bg p-2">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className={sourceFilter === 'FNRI' ? 'text-brand-green underline' : 'text-brand-muted'}
                    onClick={() => setSourceFilter('FNRI')}
                  >
                    FNRI
                  </button>
                  <button
                    type="button"
                    className={sourceFilter === 'USDA_FDC' ? 'text-brand-green underline' : 'text-brand-muted'}
                    onClick={() => setSourceFilter('USDA_FDC')}
                  >
                    USDA fallback
                  </button>
                </div>
                <input
                  autoFocus
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  aria-label={`Search food record for ${row.label}`}
                  placeholder="Search exact food or preparation"
                  className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => {
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  foodItemId: food.id,
                                  foodName: food.name,
                                  source: food.source,
                                  recordId: food.sourceRecordId ?? '',
                                  referenceUrl: food.sourceReferenceUrl ?? '',
                                }
                              : item
                          )
                        );
                        setActiveRow(null);
                      }}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-brand-surface"
                    >
                      <span className="font-semibold">{food.name}</span> ·{' '}
                      {food.source === 'FNRI' ? 'FNRI' : 'USDA FoodData Central'}
                      {food.sourceRecordId ? ` · ${food.sourceRecordId}` : ''}
                    </button>
                  ))}
                  {!results.length && term.length >= 2 && (
                    <p className="px-2 py-1 text-xs text-brand-muted">
                      No matching record shown. Try a more specific name.
                    </p>
                  )}
                </div>
              </div>
            )}
            {row.referenceUrl && (
              <a
                href={row.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-green underline"
              >
                Inspect source record ↗
              </a>
            )}
          </div>
        ))}
        <label className="block space-y-1 text-xs font-semibold">
          Serving and measurement basis
          <textarea
            required
            minLength={20}
            maxLength={1000}
            value={portionBasis}
            onChange={(event) => setPortionBasis(event.target.value)}
            placeholder="Describe how one serving and the edible gram amounts were established, including oil retained and any ‘to taste’ amounts."
            className="w-full min-h-24 rounded-lg border border-brand-border bg-brand-surface p-3 text-brand-text"
          />
        </label>
        <p className="text-xs text-brand-muted">
          USDA records are fallback composition evidence. The nutritionist must explicitly accept any USDA use at
          sign-off. This step does not certify clinical suitability.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !complete || portionBasis.trim().length < 20}>
            {loading ? 'Calculating...' : 'Calculate and save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
