'use client';

import { useState, type FormEvent } from 'react';
import { FilePlus2, Landmark } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { ApiEnvelope, DataRelease, DataSource, ReferenceDataDomain } from './types';
import { fieldClassName, getApiError } from './types';

interface DataFormsProps {
  sources: DataSource[];
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

const domains: ReferenceDataDomain[] = [
  'FOOD_CONSUMPTION',
  'FOOD_COMPOSITION',
  'INGREDIENT_PRICE',
  'MEAL_CATALOGUE',
  'MEAL_MEDIA',
];

export default function DataForms({ sources, onChanged, onError }: DataFormsProps) {
  const [busy, setBusy] = useState<'source' | 'release' | null>(null);
  const [domain, setDomain] = useState<ReferenceDataDomain>('FOOD_CONSUMPTION');

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('source');
    try {
      await api.post<ApiEnvelope<DataSource>>('/admin/data/sources', {
        code: form.get('code'),
        name: form.get('name'),
        agencyName: form.get('agencyName'),
        domain,
        homepageUrl: form.get('homepageUrl'),
        termsUrl: form.get('termsUrl') || undefined,
        attributionText: form.get('attributionText'),
        updateCadence: form.get('updateCadence') || undefined,
      });
      event.currentTarget.reset();
      setDomain('FOOD_CONSUMPTION');
      await onChanged('Reference source created.');
    } catch (error) {
      onError(getApiError(error, 'Could not create the source.'));
    } finally {
      setBusy(null);
    }
  }

  async function createRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const surveyYear = String(form.get('surveyYear') || '').trim();
    setBusy('release');
    try {
      await api.post<ApiEnvelope<DataRelease>>('/admin/data/releases', {
        sourceId: form.get('sourceId'),
        versionLabel: form.get('versionLabel'),
        surveyYear: surveyYear ? Number(surveyYear) : undefined,
        sourceUrl: form.get('sourceUrl'),
        sourcePublishedAt: form.get('sourcePublishedAt')
          ? new Date(String(form.get('sourcePublishedAt'))).toISOString()
          : undefined,
        retrievedAt: new Date(String(form.get('retrievedAt'))).toISOString(),
        notes: form.get('notes') || undefined,
      });
      event.currentTarget.reset();
      await onChanged('Draft release created.');
    } catch (error) {
      onError(getApiError(error, 'Could not create the release.'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleSource(source: DataSource) {
    setBusy('source');
    try {
      await api.patch(`/admin/data/sources/${source.id}`, { isEnabled: !source.isEnabled });
      await onChanged(`${source.code} ${source.isEnabled ? 'disabled' : 'enabled'}.`);
    } catch (error) {
      onError(getApiError(error, 'Could not update the source.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Card
        header={
          <div className="flex items-center gap-3">
            <Landmark className="h-5 w-5 text-brand-green" />
            <div>
              <h2 className="font-display text-lg font-black">Register a source</h2>
              <p className="text-xs text-brand-muted">Record ownership, terms, attribution, and update cadence.</p>
            </div>
          </div>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={createSource}>
          <Input name="code" label="Source code" placeholder="DOST_FNRI_ENNS" required />
          <Input name="agencyName" label="Agency" placeholder="DOST-FNRI" required />
          <Input
            name="name"
            label="Source name"
            placeholder="Enhanced National Nutrition Survey"
            required
            className="sm:col-span-2"
          />
          <label className="flex flex-col gap-2 text-xs font-bold text-brand-text/90">
            Domain
            <select
              className={fieldClassName}
              value={domain}
              onChange={(event) => setDomain(event.target.value as ReferenceDataDomain)}
            >
              {domains.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <Input name="updateCadence" label="Expected cadence" placeholder="Every 3–5 years" />
          <Input
            name="homepageUrl"
            type="url"
            label="Official homepage"
            placeholder="https://www.fnri.dost.gov.ph/"
            required
          />
          <Input name="termsUrl" type="url" label="Terms or access agreement" placeholder="https://..." />
          <Input
            name="attributionText"
            label="Required attribution"
            placeholder="Source: DOST-FNRI"
            required
            className="sm:col-span-2"
          />
          <Button type="submit" isLoading={busy === 'source'} className="sm:col-span-2">
            Create source
          </Button>
        </form>
        {sources.length > 0 && (
          <div className="mt-6 border-t border-brand-border/50 pt-5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-brand-muted">
              Registered sources
            </p>
            <div className="mt-3 space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex flex-col gap-3 rounded-2xl border border-brand-border/50 bg-brand-bgAlt/40 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-text">
                      {source.code} · {source.name}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-brand-muted">
                      {source.agencyName} · {source.domain.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <a
                    href={source.homepageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-brand-green hover:underline"
                  >
                    Official source
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === 'source'}
                    onClick={() => void toggleSource(source)}
                  >
                    {source.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        header={
          <div className="flex items-center gap-3">
            <FilePlus2 className="h-5 w-5 text-brand-green" />
            <div>
              <h2 className="font-display text-lg font-black">Create a release</h2>
              <p className="text-xs text-brand-muted">Every import is versioned before any data becomes active.</p>
            </div>
          </div>
        }
      >
        {sources.length === 0 ? (
          <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            Create a source before adding a release.
          </p>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={createRelease}>
            <label className="flex flex-col gap-2 text-xs font-bold text-brand-text/90 sm:col-span-2">
              Source
              <select name="sourceId" className={fieldClassName} required>
                <option value="">Select a source</option>
                {sources
                  .filter((source) => source.isEnabled)
                  .map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} · {source.name}
                    </option>
                  ))}
              </select>
            </label>
            <Input name="versionLabel" label="Version label" placeholder="2023 national estimates" required />
            <Input name="surveyYear" type="number" min="1970" max="2100" label="Survey year" placeholder="2023" />
            <Input
              name="sourceUrl"
              type="url"
              label="Official file or publication URL"
              placeholder="https://..."
              required
              className="sm:col-span-2"
            />
            <Input name="sourcePublishedAt" type="datetime-local" label="Published at (optional)" />
            <Input name="retrievedAt" type="datetime-local" label="Retrieved at" required />
            <Input
              name="notes"
              label="Release notes"
              placeholder="Aggregate table exported from official report"
              className="sm:col-span-2"
            />
            <Button type="submit" isLoading={busy === 'release'} className="sm:col-span-2">
              Create draft
            </Button>
          </form>
        )}
      </Card>
    </section>
  );
}
