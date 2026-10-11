'use client';

import { useState } from 'react';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import FoodCatalogue from '@/features/admin-data/FoodCatalogue';
import type { FoodSource } from '@/features/admin-data/types';

export default function ReadOnlyFoodReferences() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<FoodSource>('FNRI');
  return (
    <details className="border-y border-brand-border py-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-display text-base font-semibold text-brand-text">
        Compare food references
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Search FNRI and USDA composition records. A reference can support an estimate; the member’s preparation and
        portion still matter.
      </p>
      {open && (
        <div className="mt-4 space-y-4">
          <WorkspaceTabs
            size="sm"
            tone="accentSoft"
            label="Food reference source"
            value={source}
            onChange={setSource}
            items={[
              { value: 'FNRI', label: 'FNRI' },
              { value: 'USDA_FDC', label: 'USDA' },
            ]}
          />
          <FoodCatalogue key={source} source={source} readOnly />
        </div>
      )}
    </details>
  );
}
