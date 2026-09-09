'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSearch, History, Upload, Undo2 } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { ApiEnvelope, ConsumptionPage, ConsumptionStat, DataRelease, FoodItem, FoodPage } from './types';
import { fieldClassName, getApiError } from './types';

interface ReleaseOperationsProps {
  releases: DataRelease[];
  csvTemplate: string;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

const statusTone: Record<DataRelease['status'], string> = {
  DRAFT: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  STAGED: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ACTIVE: 'border-brand-green/25 bg-brand-green/10 text-brand-green',
  RETIRED: 'border-brand-border bg-brand-bgAlt text-brand-muted',
};

function downloadTemplate(csvTemplate: string) {
  const url = URL.createObjectURL(new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nutrimind-consumption-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function ReleaseCard({
  release,
  busy,
  onAction,
  onInspect,
}: {
  release: DataRelease;
  busy: string | null;
  onAction: (release: DataRelease, action: 'stage' | 'publish' | 'rollback') => Promise<void>;
  onInspect: (release: DataRelease) => void;
}) {
  const mappingEntries = ['EXACT', 'MANUAL', 'REVIEW_REQUIRED', 'UNMAPPED'] as const;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-muted">{release.source.code}</p>
          <h3 className="mt-1 font-display text-lg font-black text-brand-text">{release.versionLabel}</h3>
          <p className="mt-1 text-xs text-brand-muted">
            {release.surveyYear || 'No survey year'} · retrieved {new Date(release.retrievedAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold ${statusTone[release.status]}`}>
          {release.status}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mappingEntries.map((status) => (
          <div key={status} className="rounded-2xl border border-brand-border/50 bg-brand-bgAlt/45 p-3">
            <p className="text-lg font-black text-brand-text">{release.mappings[status] || 0}</p>
            <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-wide text-brand-muted">
              {status.replace('_', ' ')}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {release.source.domain === 'FOOD_CONSUMPTION' && (
          <Button size="sm" variant="secondary" onClick={() => onInspect(release)}>
            <FileSearch className="h-4 w-4" /> Inspect rows
          </Button>
        )}
        {release.status === 'DRAFT' && (
          <Button size="sm" onClick={() => void onAction(release, 'stage')} isLoading={busy === `${release.id}:stage`}>
            Stage release
          </Button>
        )}
        {release.status === 'STAGED' && (
          <Button
            size="sm"
            variant="accent"
            onClick={() => void onAction(release, 'publish')}
            isLoading={busy === `${release.id}:publish`}
          >
            <CheckCircle2 className="h-4 w-4" /> Publish
          </Button>
        )}
        {release.status === 'RETIRED' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void onAction(release, 'rollback')}
            isLoading={busy === `${release.id}:rollback`}
          >
            <Undo2 className="h-4 w-4" /> Restore
          </Button>
        )}
      </div>
      {release.contentSha256 && (
        <p className="mt-4 truncate font-mono text-[9px] text-brand-muted">SHA-256 {release.contentSha256}</p>
      )}
    </Card>
  );
}

export default function ReleaseOperations({ releases, csvTemplate, onChanged, onError }: ReleaseOperationsProps) {
  const draftConsumptionReleases = useMemo(
    () => releases.filter((release) => release.status === 'DRAFT' && release.source.domain === 'FOOD_CONSUMPTION'),
    [releases]
  );
  const [releaseId, setReleaseId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inspected, setInspected] = useState<DataRelease | null>(null);

  useEffect(() => {
    if (!releaseId && draftConsumptionReleases[0]) setReleaseId(draftConsumptionReleases[0].id);
  }, [draftConsumptionReleases, releaseId]);

  async function importCsv() {
    if (!releaseId || !csvFile) return onError('Choose a draft release and a CSV file first.');
    setBusy('import');
    try {
      const csvText = await csvFile.text();
      const response = await api.post<
        ApiEnvelope<{ rowCount: number; exact: number; reviewRequired: number; unmapped: number }>
      >(`/admin/data/releases/${releaseId}/consumption-import`, { csvText });
      const result = response.data.data;
      setCsvFile(null);
      await onChanged(
        `Imported ${result.rowCount} rows: ${result.exact} exact, ${result.reviewRequired} need review, ${result.unmapped} unmapped.`
      );
    } catch (error) {
      onError(getApiError(error, 'Could not import the CSV file.'));
    } finally {
      setBusy(null);
    }
  }

  async function runAction(release: DataRelease, action: 'stage' | 'publish' | 'rollback') {
    if (
      action === 'publish' &&
      !window.confirm(`Publish ${release.versionLabel}? It will replace the active release for ${release.source.code}.`)
    )
      return;
    if (
      action === 'rollback' &&
      !window.confirm(`Restore ${release.versionLabel}? The current active release will be retired.`)
    )
      return;
    setBusy(`${release.id}:${action}`);
    try {
      await api.post(`/admin/data/releases/${release.id}/${action}`);
      await onChanged(
        action === 'stage'
          ? 'Release staged for publication.'
          : action === 'publish'
            ? 'Release published.'
            : 'Previous release restored.'
      );
    } catch (error) {
      onError(getApiError(error, `Could not ${action} the release.`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5">
      <Card
        header={
          <div>
            <h2 className="font-display text-lg font-black">Aggregate consumption import</h2>
            <p className="text-xs text-brand-muted">
              Upload aggregate tables only. Never upload respondent-level survey records.
            </p>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label className="flex flex-col gap-2 text-xs font-bold text-brand-text/90">
            Draft release
            <select className={fieldClassName} value={releaseId} onChange={(event) => setReleaseId(event.target.value)}>
              <option value="">Select a draft</option>
              {draftConsumptionReleases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.source.code} · {release.versionLabel}
                </option>
              ))}
            </select>
          </label>
          <Input
            type="file"
            accept=".csv,text/csv"
            label="Aggregate CSV"
            onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
          />
          <Button variant="secondary" onClick={() => downloadTemplate(csvTemplate)}>
            <Download className="h-4 w-4" /> Template
          </Button>
          <Button onClick={() => void importCsv()} isLoading={busy === 'import'}>
            <Upload className="h-4 w-4" /> Import
          </Button>
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-center gap-3">
          <History className="h-5 w-5 text-brand-green" />
          <p className="portal-section-label">Release history</p>
        </div>
        {releases.length === 0 ? (
          <Card className="p-6 text-sm text-brand-muted">No versioned releases yet.</Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {releases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                busy={busy}
                onAction={runAction}
                onInspect={setInspected}
              />
            ))}
          </div>
        )}
      </div>

      {inspected && (
        <ConsumptionMappingPanel
          key={`${inspected.id}:${inspected._count.consumptionStats}`}
          release={inspected}
          onClose={() => setInspected(null)}
          onChanged={async (message) => {
            await onChanged(message);
            setInspected((current) => (current ? { ...current } : current));
          }}
          onError={onError}
        />
      )}
    </section>
  );
}

function ConsumptionMappingPanel({
  release,
  onClose,
  onChanged,
  onError,
}: {
  release: DataRelease;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState<ConsumptionStat[]>([]);
  const [rowSearch, setRowSearch] = useState('');
  const [target, setTarget] = useState<ConsumptionStat | null>(null);
  const [foodSearch, setFoodSearch] = useState('');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRows(search = rowSearch) {
    setLoading(true);
    try {
      const response = await api.get<ApiEnvelope<ConsumptionPage>>(`/admin/data/releases/${release.id}/stats`, {
        params: { page: 1, limit: 100, search: search || undefined },
      });
      setRows(response.data.data.rows);
    } catch (error) {
      onError(getApiError(error, 'Could not load the imported rows.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function findFoods() {
    try {
      const response = await api.get<ApiEnvelope<FoodPage>>('/admin/data/foods', {
        params: { page: 1, limit: 20, search: foodSearch },
      });
      setFoods(response.data.data.foods);
    } catch (error) {
      onError(getApiError(error, 'Could not search the FNRI catalogue.'));
    }
  }

  async function setMapping(food: FoodItem) {
    if (!target) return;
    try {
      await api.patch(`/admin/data/consumption-stats/${target.id}/mapping`, { foodItemId: food.id });
      setTarget(null);
      setFoods([]);
      setFoodSearch('');
      await loadRows();
      await onChanged(`Mapped “${target.foodNameRaw}” to “${food.name}”.`);
    } catch (error) {
      onError(getApiError(error, 'Could not save the mapping.'));
    }
  }

  return (
    <Card
      header={
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-black">{release.versionLabel} rows</h2>
            <p className="text-xs text-brand-muted">
              Exact matches are automatic. Ambiguous and unmapped labels remain visible for deliberate review.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void loadRows();
        }}
      >
        <Input
          value={rowSearch}
          onChange={(event) => setRowSearch(event.target.value)}
          placeholder="Search food or geography"
        />
        <Button type="submit" variant="secondary" isLoading={loading}>
          Search
        </Button>
      </form>
      <div className="mt-5 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-2xl border border-brand-border/55 bg-brand-bgAlt/40 p-4 lg:flex-row lg:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brand-text">{row.foodNameRaw}</p>
              <p className="mt-1 text-xs text-brand-muted">
                {row.populationGroup} · {row.geographyLevel}
                {row.regionName ? ` · ${row.regionName}` : ''}
                {row.provinceHucName ? ` · ${row.provinceHucName}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-brand-muted">
                {row.foodItem ? `FNRI: ${row.foodItem.name}` : 'No FNRI mapping'} · {row.percentConsuming ?? '—'}%
                consuming · {row.meanIntakeG ?? '—'} g/day
              </p>
            </div>
            <span className="font-mono text-[9px] font-bold text-brand-green">{row.mappingStatus}</span>
            {release.status === 'DRAFT' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setTarget(row);
                  setFoodSearch(row.foodNameRaw);
                  setFoods([]);
                }}
              >
                Map
              </Button>
            )}
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-brand-muted">No rows match this filter.</p>
        )}
      </div>
      {target && (
        <div className="mt-5 rounded-[24px] border border-brand-green/20 bg-brand-green/5 p-5">
          <p className="font-bold text-brand-text">Map “{target.foodNameRaw}” to an FNRI record</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void findFoods();
            }}
          >
            <Input
              value={foodSearch}
              onChange={(event) => setFoodSearch(event.target.value)}
              placeholder="Search FNRI foods"
            />
            <Button type="submit">Find</Button>
          </form>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {foods.map((food) => (
              <button
                key={food.id}
                type="button"
                onClick={() => void setMapping(food)}
                className="rounded-2xl border border-brand-border/60 bg-brand-surface p-3 text-left text-sm font-semibold text-brand-text transition hover:border-brand-green/50"
              >
                {food.name}
                <span className="mt-1 block text-[11px] font-normal text-brand-muted">
                  {food.energyKcal} kcal · P {food.proteinG} g · C {food.carbsG} g · F {food.fatG} g
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
