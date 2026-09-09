'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ImageIcon, RefreshCw, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MealImage from '@/components/user/MealImage';
import type { PublicMealImage } from '@/types';
import { getApiErrorMessage } from '@/lib/api-error';

type MealImageItem = {
  id: string;
  mealName: string;
  mealType: string;
  status: string;
  image: PublicMealImage | null;
  hasImage: boolean;
};

type PageData = {
  items: MealImageItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const initialForm = {
  imageKind: 'EXACT',
  altText: '',
  creator: '',
  sourcePageUrl: '',
  licenseCode: 'OWNED',
  licenseUrl: '',
};

export default function AdminMealImagesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MealImageItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(
    async (page = 1, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await api.get<{ data: PageData }>('/admin/meal-images', {
          params: { page, limit: 18, search: query || undefined },
        });
        setData(response.data.data);
      } catch (error) {
        setNotice({ tone: 'error', text: getApiErrorMessage(error, 'Could not load meal images.') });
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    void load();
  }, [load]);

  function choose(meal: MealImageItem) {
    setSelected(meal);
    setFile(null);
    setForm({ ...initialForm, altText: `Photo of ${meal.mealName}` });
    setNotice(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !file) return setNotice({ tone: 'error', text: 'Choose an image file first.' });
    setSaving(true);
    try {
      const body = new FormData();
      body.append('image', file);
      Object.entries(form).forEach(([key, value]) => value && body.append(key, value));
      await api.post(`/admin/meal-images/${selected.id}`, body);
      setNotice({ tone: 'success', text: `Image assigned to ${selected.mealName}.` });
      setSelected(null);
      await load(data?.pagination.page ?? 1, true);
    } catch (error) {
      setNotice({ tone: 'error', text: getApiErrorMessage(error, 'Could not assign the image.') });
    } finally {
      setSaving(false);
    }
  }

  async function unassign(meal: MealImageItem) {
    if (
      !window.confirm(
        `Remove the image assignment from ${meal.mealName}? The Cloudinary asset will be retained for recovery.`
      )
    )
      return;
    try {
      await api.delete(`/admin/meal-images/${meal.id}`);
      setNotice({ tone: 'success', text: `Image unassigned from ${meal.mealName}.` });
      await load(data?.pagination.page ?? 1, true);
    } catch (error) {
      setNotice({ tone: 'error', text: getApiErrorMessage(error, 'Could not unassign the image.') });
    }
  }

  if (loading && !data) return <PortalLoadingState message="Loading meal image catalogue..." />;

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={ImageIcon}
        eyebrow="Media governance"
        title="Meal image catalogue"
        description="Assign owned, generated, or properly licensed images to verified meals. Missing images use an explicit representative fallback."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load(data?.pagination.page ?? 1)}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
        meta={
          <div className="flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-brand-green">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Admin only · audited</span>
          </div>
        }
      />

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl border p-4 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-500/25 bg-red-500/10 text-status-error-text' : 'border-brand-green/25 bg-brand-green/10 text-brand-green'}`}
        >
          {notice.text}
        </div>
      )}

      <form
        className="flex gap-3 rounded-3xl border border-brand-border/60 bg-brand-surface/70 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input
          aria-label="Search meals"
          placeholder="Search meal names..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" /> Search
        </Button>
      </form>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((meal) => (
          <article
            key={meal.id}
            className="overflow-hidden rounded-[24px] border border-brand-border/70 bg-brand-surface shadow-sm"
          >
            <MealImage
              image={meal.image}
              mealName={meal.mealName}
              mealType={meal.mealType}
              className="h-44 w-full rounded-none"
            />
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green">
                  {meal.mealType} · {meal.status}
                </p>
                <h2 className="mt-1 font-display text-base font-extrabold text-brand-text">{meal.mealName}</h2>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => choose(meal)}>
                  <Upload className="h-4 w-4" /> {meal.hasImage ? 'Replace' : 'Assign'}
                </Button>
                {meal.hasImage && (
                  <Button
                    size="sm"
                    variant="danger"
                    aria-label={`Unassign image from ${meal.mealName}`}
                    onClick={() => void unassign(meal)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={data.pagination.page <= 1}
            onClick={() => void load(data.pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs font-bold text-brand-muted">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={data.pagination.page >= data.pagination.totalPages}
            onClick={() => void load(data.pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {selected && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-form-title"
        >
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-[28px] bg-brand-surface p-6 shadow-2xl"
          >
            <div>
              <h2 id="image-form-title" className="font-display text-xl font-extrabold text-brand-text">
                Assign image to {selected.mealName}
              </h2>
              <p className="mt-1 text-xs text-brand-muted">JPG, PNG, WebP, or AVIF · maximum 5 MB · minimum 320×240</p>
            </div>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-brand-text">
                Image match
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-border bg-brand-surface p-3"
                  value={form.imageKind}
                  onChange={(e) => setForm({ ...form, imageKind: e.target.value })}
                >
                  <option value="EXACT">Exact meal</option>
                  <option value="REPRESENTATIVE">Representative</option>
                </select>
              </label>
              <label className="text-xs font-bold text-brand-text">
                Rights
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-border bg-brand-surface p-3"
                  value={form.licenseCode}
                  onChange={(e) => setForm({ ...form, licenseCode: e.target.value })}
                >
                  <option value="OWNED">Owned by NutriMind</option>
                  <option value="GENERATED">AI generated</option>
                  <option value="CC0">CC0</option>
                  <option value="PUBLIC_DOMAIN">Public domain</option>
                  <option value="CC_BY_4_0">CC BY 4.0</option>
                  <option value="CC_BY_SA_4_0">CC BY-SA 4.0</option>
                </select>
              </label>
            </div>
            <Input
              label="Accessible description"
              required
              value={form.altText}
              onChange={(e) => setForm({ ...form, altText: e.target.value })}
            />
            <Input
              label="Creator / owner"
              placeholder="NutriMind or photographer name"
              value={form.creator}
              onChange={(e) => setForm({ ...form, creator: e.target.value })}
            />
            <Input
              label="Original source page"
              type="url"
              placeholder="https://..."
              value={form.sourcePageUrl}
              onChange={(e) => setForm({ ...form, sourcePageUrl: e.target.value })}
            />
            <Input
              label="License page"
              type="url"
              placeholder="https://..."
              value={form.licenseUrl}
              onChange={(e) => setForm({ ...form, licenseUrl: e.target.value })}
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saving}>
                Upload and assign
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
