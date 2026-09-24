import React from 'react';
import { COOKED_RICE_PORTIONS_GRAMS, type RiceReference } from '@/lib/rice-accompaniment';

export default function RiceAccompanimentSelect({
  id,
  grams,
  onChange,
  rice,
  extra = false,
}: {
  id: string;
  grams: number;
  onChange: (grams: number) => void;
  rice: RiceReference;
  extra?: boolean;
}) {
  return (
    <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-3 text-xs">
      <label htmlFor={id} className="font-bold text-brand-text">
        {extra ? 'Extra cooked rice beyond the recipe' : 'Cooked rice with this dish'}
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COOKED_RICE_PORTIONS_GRAMS.map((portion) => (
          <button
            key={portion}
            type="button"
            onClick={() => onChange(portion)}
            className={`rounded-lg border px-2 py-1 ${grams === portion ? 'border-brand-green text-brand-green' : 'border-brand-border text-brand-muted'}`}
          >
            {portion === 0 ? 'None' : `${portion} g`}
          </button>
        ))}
      </div>
      <input
        id={id}
        type="number"
        min={0}
        max={600}
        step={1}
        value={grams}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= 0 && value <= 600) onChange(value);
        }}
        className="mt-2 h-10 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-xs font-semibold text-brand-text"
      />
      <p className="mt-1.5 text-[10px] leading-relaxed text-brand-muted">
        {extra
          ? 'Only enter rice you add beyond the published recipe serving. The amount already in the recipe can vary.'
          : 'Enter the cooked amount you actually eat. Rice is separate from this recipe serving.'}{' '}
        Calculated from FNRI {rice.fnriCode}.
      </p>
    </div>
  );
}
