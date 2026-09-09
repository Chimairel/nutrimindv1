'use client';

import type { MealLocalityPreference } from '@/types';

interface MealLocalityPreferenceControlProps {
  value: MealLocalityPreference;
  regionName: string;
  provinceHucName: string;
  onChange: (value: MealLocalityPreference) => void;
  disabled?: boolean;
}

const preferences: MealLocalityPreference[] = ['NATIONAL', 'REGIONAL', 'LOCAL'];

export default function MealLocalityPreferenceControl({
  value,
  regionName,
  provinceHucName,
  onChange,
  disabled = false,
}: MealLocalityPreferenceControlProps) {
  const labels = ['Philippines', regionName.trim() || 'Region', provinceHucName.trim() || 'Province/HUC'];
  const max = provinceHucName.trim() ? 2 : regionName.trim() ? 1 : 0;
  const selectedIndex = Math.min(preferences.indexOf(value), max);
  const selected = preferences[selectedIndex];
  const descriptions = {
    NATIONAL: 'Broad Filipino meal variety from national consumption evidence.',
    REGIONAL: `Prioritize food familiar across ${regionName || 'your region'}, then fall back to national evidence.`,
    LOCAL: `Prioritize food familiar in ${provinceHucName || 'your province/HUC'}, then fall back to regional and national evidence.`,
  } satisfies Record<MealLocalityPreference, string>;

  return (
    <fieldset className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/35 p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-brand-muted">
        Meal locality strength
      </legend>
      <p className="mb-4 text-xs leading-relaxed text-brand-muted">
        Choose how strongly NutriMind should favor familiar meals. Safety, nutrition, and budget rules still come first.
      </p>
      <div className="rounded-2xl border border-brand-border bg-brand-surface px-4 py-4 shadow-sm">
        <input
          aria-label="Meal locality strength"
          aria-valuetext={labels[selectedIndex]}
          type="range"
          min={0}
          max={2}
          step={1}
          value={selectedIndex}
          disabled={disabled || max === 0}
          onChange={(event) => onChange(preferences[Math.min(Number(event.target.value), max)])}
          className="h-2 w-full cursor-pointer accent-brand-green disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
          {labels.map((label, index) => (
            <button
              key={`${index}:${label}`}
              type="button"
              disabled={disabled || index > max}
              onClick={() => onChange(preferences[index])}
              className={`rounded-lg px-1 py-1.5 transition ${index === selectedIndex ? 'bg-brand-green text-white' : 'text-brand-muted hover:bg-brand-border/30 disabled:opacity-40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-brand-text" aria-live="polite">
        {descriptions[selected]}
      </p>
    </fieldset>
  );
}
