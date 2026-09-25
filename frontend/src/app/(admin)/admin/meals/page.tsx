'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenText, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
type OptionalNutrient = 'sodiumMg' | 'sugarG' | 'fiberG' | 'potassiumMg' | 'phosphorusMg' | 'saturatedFatG';
type Ingredient = { foodItemId: string; name: string; gramsPerServing: number };
type MealForm = {
  mealName: string;
  mealType: MealType;
  summary: string;
  instructions: string;
  nutritionBasis: string;
  nutritionServingDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;
  sugarG: number | null;
  fiberG: number | null;
  potassiumMg: number | null;
  phosphorusMg: number | null;
  saturatedFatG: number | null;
  ingredients: Ingredient[];
};
type Draft = MealForm & {
  id: string;
  safetyEvidenceStatus: 'INCOMPLETE' | 'COMPLETE' | 'STALE';
  safetyEvidenceRevision: number;
  status: string;
  reviewedBy: string | null;
  canEdit: boolean;
};
type FoodOption = { id: string; name: string; category: string | null };

const nutrientInputs: Array<{ key: OptionalNutrient; label: string; unit: string }> = [
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
  { key: 'sugarG', label: 'Sugar', unit: 'g' },
  { key: 'fiberG', label: 'Fiber', unit: 'g' },
  { key: 'potassiumMg', label: 'Potassium', unit: 'mg' },
  { key: 'phosphorusMg', label: 'Phosphorus', unit: 'mg' },
  { key: 'saturatedFatG', label: 'Saturated fat', unit: 'g' },
];

function blankForm(): MealForm {
  return {
    mealName: '', mealType: 'BREAKFAST', summary: '', instructions: '', nutritionBasis: '', nutritionServingDescription: '',
    calories: 0, proteinG: 0, carbsG: 0, fatG: 0,
    sodiumMg: null, sugarG: null, fiberG: null, potassiumMg: null, phosphorusMg: null, saturatedFatG: null,
    ingredients: [{ foodItemId: '', name: '', gramsPerServing: 0 }],
  };
}

const inputClass = 'min-h-11 w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-green';

function FnriIngredientRow({ ingredient, index, onChange, onRemove }: {
  ingredient: Ingredient;
  index: number;
  onChange: (next: Ingredient) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState(ingredient.name);
  const [options, setOptions] = useState<FoodOption[]>([]);
  useEffect(() => { setSearch(ingredient.name); }, [ingredient.foodItemId, ingredient.name]);
  useEffect(() => {
    if (ingredient.foodItemId || search.trim().length < 2) { setOptions([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void api.get('/admin/meals/foods', { params: { search: search.trim() } })
        .then((response) => { if (active) setOptions(response.data.data ?? []); })
        .catch(() => { if (active) setOptions([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, ingredient.foodItemId]);

  return (
    <div className="grid gap-2 rounded-xl border border-brand-border/70 bg-brand-bgAlt/25 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
      <div className="relative">
        <label htmlFor={`ingredient-${index}`} className="mb-1 block text-xs font-bold text-brand-muted">FNRI ingredient {index + 1}</label>
        <input
          id={`ingredient-${index}`}
          className={inputClass}
          value={search}
          autoComplete="off"
          placeholder="Search and select an FNRI food"
          onChange={(event) => { setSearch(event.target.value); onChange({ ...ingredient, foodItemId: '', name: event.target.value }); }}
        />
        {options.length > 0 && (
          <div role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-brand-border bg-brand-surface p-1 shadow-xl">
            {options.map((food) => (
              <button key={food.id} type="button" role="option" aria-selected={false}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-text hover:bg-brand-green/10"
                onClick={() => { onChange({ ...ingredient, foodItemId: food.id, name: food.name }); setSearch(food.name); setOptions([]); }}>
                {food.name}{food.category ? <span className="ml-2 text-xs text-brand-muted">{food.category}</span> : null}
              </button>
            ))}
          </div>
        )}
        {ingredient.foodItemId && <p className="mt-1 text-xs text-brand-green">FNRI record selected</p>}
      </div>
      <div>
        <label htmlFor={`grams-${index}`} className="mb-1 block text-xs font-bold text-brand-muted">Grams / serving</label>
        <input id={`grams-${index}`} type="number" min="0.01" max="5000" step="0.01" className={inputClass}
          value={ingredient.gramsPerServing || ''}
          onChange={(event) => onChange({ ...ingredient, gramsPerServing: Number(event.target.value) })} />
      </div>
      <button type="button" className="self-end rounded-xl border border-brand-border p-3 text-brand-muted hover:text-status-error-text"
        onClick={onRemove} aria-label={`Remove ingredient ${index + 1}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminMealsPage() {
  const [form, setForm] = useState<MealForm>(blankForm);
  const [editing, setEditing] = useState<{ id: string; revision: number } | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/admin/meals', { params: { page } });
      setDrafts(response.data.data.items ?? []);
      setTotal(response.data.data.total ?? 0);
    } catch (error) {
      setNotice({ kind: 'error', text: getApiErrorMessage(error, 'Could not load admin meal drafts.') });
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { void load(); }, [load]);

  function updateIngredient(index: number, next: Ingredient) {
    setForm((current) => ({ ...current, ingredients: current.ingredients.map((item, row) => row === index ? next : item) }));
  }
  function reset() { setForm(blankForm()); setEditing(null); }
  function edit(draft: Draft) {
    setForm({
      mealName: draft.mealName, mealType: draft.mealType, summary: draft.summary,
      instructions: draft.instructions, nutritionBasis: draft.nutritionBasis ?? '', nutritionServingDescription: draft.nutritionServingDescription ?? '',
      calories: draft.calories, proteinG: draft.proteinG, carbsG: draft.carbsG, fatG: draft.fatG,
      sodiumMg: draft.sodiumMg, sugarG: draft.sugarG, fiberG: draft.fiberG,
      potassiumMg: draft.potassiumMg, phosphorusMg: draft.phosphorusMg, saturatedFatG: draft.saturatedFatG,
      ingredients: draft.ingredients,
    });
    setEditing({ id: draft.id, revision: draft.safetyEvidenceRevision });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (form.ingredients.some((ingredient) => !ingredient.foodItemId || !(ingredient.gramsPerServing > 0))) {
      setNotice({ kind: 'error', text: 'Select an FNRI record and enter grams per serving for every ingredient.' });
      return;
    }
    setSaving(true);
    try {
      const { ingredients, ...details } = form;
      const body = { ...details, ingredients: ingredients.map(({ foodItemId, gramsPerServing }) => ({ foodItemId, gramsPerServing })) };
      if (editing) await api.patch(`/admin/meals/${editing.id}`, { ...body, expectedRevision: editing.revision });
      else await api.post('/admin/meals', body);
      setNotice({ kind: 'success', text: editing ? 'Draft updated. Nutritionist certification is still required.' : 'Meal draft created. It is awaiting independent nutritionist evidence review.' });
      reset();
      if (page === 1) await load();
      else setPage(1);
    } catch (error) {
      setNotice({ kind: 'error', text: getApiErrorMessage(error, 'Could not save the meal draft.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-page mx-auto max-w-6xl space-y-6 pb-20">
      <PortalPageHeader icon={BookOpenText} eyebrow="Content & evidence" title="Author meal drafts"
        description="Add complete recipes to expand the candidate library. Admin-entered nutrition is unreviewed; only an RND can certify reusable safety evidence." />
      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'}
        className={`rounded-xl border p-4 text-sm ${notice.kind === 'error' ? 'border-status-error-text/40 text-status-error-text' : 'border-brand-green/40 text-brand-green'}`}>
        {notice.text}
      </div>}

      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-display text-xl font-black text-brand-text">{editing ? 'Edit unreviewed draft' : 'New meal recipe'}</h2>
              <p className="mt-1 text-xs text-brand-muted">All amounts and nutrient values are per one serving.</p></div>
            <span className="rounded-full border border-status-warning-text/30 px-3 py-1 text-xs font-bold text-status-warning-text">Uncertified draft</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="text-xs font-bold text-brand-muted">Meal name
              <input required minLength={3} maxLength={240} className={`${inputClass} mt-1`} value={form.mealName}
                onChange={(event) => setForm({ ...form, mealName: event.target.value })} /></label>
            <label className="text-xs font-bold text-brand-muted">Meal type
              <select className={`${inputClass} mt-1`} value={form.mealType}
                onChange={(event) => setForm({ ...form, mealType: event.target.value as MealType })}>
                <option value="BREAKFAST">Breakfast</option><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option>
              </select></label>
          </div>
          <label className="block text-xs font-bold text-brand-muted">Short description
            <textarea required minLength={10} maxLength={1500} rows={2} className={`${inputClass} mt-1`} value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
          <label className="block text-xs font-bold text-brand-muted">Preparation and cooking instructions
            <textarea required minLength={20} maxLength={6000} rows={5} className={`${inputClass} mt-1`} value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
          <label className="block max-w-md text-xs font-bold text-brand-muted">Serving description
            <input required maxLength={180} placeholder="e.g. 1 bowl, about 350 g" className={`${inputClass} mt-1`}
              value={form.nutritionServingDescription}
              onChange={(event) => setForm({ ...form, nutritionServingDescription: event.target.value })} /></label>
          <label className="block text-xs font-bold text-brand-muted">Nutrition calculation or source notes (for RND review)
            <textarea required minLength={10} maxLength={1200} rows={2} className={`${inputClass} mt-1`}
              placeholder="e.g. FNRI values summed from per-serving raw ingredient weights; estimate oil retained after cooking"
              value={form.nutritionBasis}
              onChange={(event) => setForm({ ...form, nutritionBasis: event.target.value })} /></label>
        </Card>

        <Card className="space-y-4 p-5">
          <div><h2 className="font-display text-lg font-black text-brand-text">Nutrition per serving</h2>
            <p className="mt-1 text-xs text-brand-muted">Enter measured or calculated values only. Leave an extended nutrient blank when unknown; unknown does not mean zero.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([['calories', 'Calories', 'kcal'], ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g']] as const).map(([key, label, unit]) => (
              <label key={key} className="text-xs font-bold text-brand-muted">{label} ({unit})
                <input required type="number" min={key === 'calories' ? 1 : 0} max={key === 'calories' ? 3000 : 500} step="0.01"
                  className={`${inputClass} mt-1`} value={form[key] || ''}
                  onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nutrientInputs.map(({ key, label, unit }) => (
              <label key={key} className="text-xs font-bold text-brand-muted">{label} ({unit}) · if known
                <input type="number" min="0" step="0.01" className={`${inputClass} mt-1`} value={form[key] ?? ''}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div><h2 className="font-display text-lg font-black text-brand-text">Ingredients</h2>
            <p className="mt-1 text-xs text-brand-muted">Select exact FNRI foods. Use grams of each ingredient in one serving; preparation details belong in the instructions.</p></div>
          {form.ingredients.map((ingredient, index) => (
            <FnriIngredientRow key={index} index={index} ingredient={ingredient}
              onChange={(next) => updateIngredient(index, next)}
              onRemove={() => setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, row) => row !== index) }))} />
          ))}
          <Button type="button" variant="secondary" disabled={form.ingredients.length >= 40}
            onClick={() => setForm((current) => ({ ...current, ingredients: [...current.ingredients, { foodItemId: '', name: '', gramsPerServing: 0 }] }))}>
            <Plus className="h-4 w-4" /> Add ingredient
          </Button>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save draft changes' : 'Create unreviewed meal draft'}</Button>
          {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel editing</Button>}
          <p className="text-xs text-brand-muted">Safety declarations and condition clearances are reserved for RND review.</p>
        </div>
      </form>

      <section className="space-y-3" aria-labelledby="admin-meal-drafts-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="admin-meal-drafts-heading" className="font-display text-xl font-black text-brand-text">Admin-authored meals</h2>
            <p className="text-xs text-brand-muted">{total} submissions · newest first</p></div>
          <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
        {loading ? <p className="text-sm text-brand-muted">Loading meal drafts…</p> : drafts.length === 0 ? (
          <Card className="p-6 text-sm text-brand-muted">No admin-authored meals yet.</Card>
        ) : drafts.map((draft) => (
          <Card key={draft.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div><p className="font-bold text-brand-text">{draft.mealName}</p>
              <p className="mt-1 text-xs text-brand-muted">{draft.mealType.toLowerCase()} · {draft.calories} kcal · {draft.ingredients.length} FNRI ingredients · revision {draft.safetyEvidenceRevision}</p>
              <p className={`mt-1 text-xs font-semibold ${draft.safetyEvidenceStatus === 'COMPLETE' ? 'text-brand-green' : 'text-status-warning-text'}`}>
                {draft.safetyEvidenceStatus === 'COMPLETE' ? `Evidence certified${draft.reviewedBy ? ` by ${draft.reviewedBy}` : ''}` : 'Awaiting RND evidence review'}
              </p></div>
            <div className="flex flex-wrap gap-2">
              {draft.canEdit && <Button size="sm" variant="secondary" onClick={() => edit(draft)}>Edit draft</Button>}
              <Link href="/admin/images" className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-3 py-2 text-xs font-bold text-brand-text hover:border-brand-green">
                <BookOpenText className="h-4 w-4" /> Add photo
              </Link>
            </div>
          </Card>
        ))}
        <div className="flex items-center justify-end gap-3 text-xs text-brand-muted">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
          <Button size="sm" variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      </section>
      <div className="flex items-center gap-2 rounded-xl border border-brand-green/25 bg-brand-green/5 p-4 text-xs text-brand-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-green" /> Admin authorship never certifies safety. Nutritionists review drafts in their Meal library under “Admin drafts awaiting evidence review.”
      </div>
    </div>
  );
}
