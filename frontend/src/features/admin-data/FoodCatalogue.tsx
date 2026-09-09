'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Search, Tags } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { ApiEnvelope, FoodItem, FoodPage } from './types';
import { getApiError } from './types';

interface FoodCatalogueProps {
  initialFoods: FoodPage;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

export default function FoodCatalogue({ initialFoods, onChanged, onError }: FoodCatalogueProps) {
  const [result, setResult] = useState(initialFoods);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setResult(initialFoods), [initialFoods]);

  async function findFoods(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    try {
      const response = await api.get<ApiEnvelope<FoodPage>>('/admin/data/foods', {
        params: { page: 1, limit: 25, search: search || undefined },
      });
      setResult(response.data.data);
    } catch (error) {
      onError(getApiError(error, 'Could not search the FNRI catalogue.'));
    } finally {
      setLoading(false);
    }
  }

  async function addAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/admin/data/food-aliases', { foodItemId: selected.id, alias: form.get('alias') });
      event.currentTarget.reset();
      setSelected(null);
      await findFoods();
      await onChanged('Verified alias saved. New imports and food lookup can use it.');
    } catch (error) {
      onError(getApiError(error, 'Could not save the alias.'));
    }
  }

  return (
    <section>
      <Card
        header={
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brand-green" />
            <div>
              <h2 className="font-display text-lg font-black">FNRI catalogue and aliases</h2>
              <p className="text-xs text-brand-muted">
                The 1,542 nutrient records remain canonical; admins may add audited search and import labels.
              </p>
            </div>
          </div>
        }
      >
        <form className="flex gap-2" onSubmit={findFoods}>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search canonical names or aliases"
          />
          <Button type="submit" variant="secondary" isLoading={loading}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-brand-muted">
          {result.total.toLocaleString()} matching records
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {result.foods.map((food) => (
            <div key={food.id} className="rounded-[22px] border border-brand-border/55 bg-brand-bgAlt/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-text">{food.name}</p>
                  <p className="mt-1 text-[11px] text-brand-muted">
                    {food.energyKcal} kcal · P {food.proteinG} g · C {food.carbsG} g · F {food.fatG} g per 100 g
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(food)}>
                  Add alias
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {food.aliases.map((alias) => (
                  <span
                    key={alias.id}
                    title={alias.verifiedByAdmin ? `Verified by ${alias.verifiedByAdmin.name}` : 'Legacy alias'}
                    className={`rounded-full border px-2.5 py-1 text-[10px] ${alias.verifiedAt ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : 'border-brand-border text-brand-muted'}`}
                  >
                    {alias.alias}
                    {alias.verifiedAt ? ' ✓' : ''}
                  </span>
                ))}
                {food.aliases.length === 0 && <span className="text-[11px] text-brand-muted">No aliases</span>}
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <form onSubmit={addAlias} className="mt-5 rounded-[24px] border border-brand-green/20 bg-brand-green/5 p-5">
            <p className="font-bold text-brand-text">Add a verified alias for {selected.name}</p>
            <p className="mt-1 text-xs text-brand-muted">
              Aliases affect food matching, so collisions with another FNRI record are rejected and every change is
              audited.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input name="alias" placeholder="Example: boiled egg" minLength={2} required autoFocus />
              <Button type="submit">Verify alias</Button>
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
