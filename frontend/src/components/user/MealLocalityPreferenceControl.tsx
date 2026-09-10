'use client';

import { Check, Globe2, LockKeyhole, Map, MapPin } from 'lucide-react';
import Slider from '@/components/ui/Slider';
import { useId } from 'react';
import { usePlanningLocations, validPlanningLocation } from '@/hooks/usePlanningLocations';
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
  const hintId = useId();
  const { options } = usePlanningLocations();
  const { regionValid, provinceValid } = validPlanningLocation(options, regionName, provinceHucName);
  const max = provinceValid ? 2 : regionValid ? 1 : 0;
  const selectedIndex = Math.min(preferences.indexOf(value), max);
  const selected = preferences[selectedIndex];
  const availableHint = !regionValid
    ? 'Choose a valid Region from the location suggestions above to unlock regional preferences.'
    : !provinceValid
      ? 'Choose a valid Province or HUC in your Region from the suggestions above to unlock local preferences.'
      : 'All locality levels are available.';
  const descriptions = {
    NATIONAL: 'Favor Philippines-wide familiarity. Published consumption evidence is used when available.',
    REGIONAL: `Prioritize food familiar across ${regionName || 'your region'}, then fall back to national evidence.`,
    LOCAL: `Prioritize food familiar in ${provinceHucName || 'your province/HUC'}, then fall back to regional and national evidence.`,
  } satisfies Record<MealLocalityPreference, string>;

  return (
    <fieldset className="rounded-[24px] border border-brand-border/70 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/5 p-5 shadow-sm">
      <legend className="px-2 text-xs font-extrabold uppercase tracking-[0.13em] text-brand-muted">
        Meal locality strength
      </legend>
      <p className="mb-5 text-xs leading-relaxed text-brand-muted">
        Choose how strongly NutriMind should favor familiar meals. Safety, nutrition, and budget rules still come first.
      </p>
      <div className="rounded-[20px] border border-brand-border/80 bg-brand-bgAlt/45 px-4 pb-4 pt-6 shadow-inner sm:px-5">
        <div className="relative px-2">
          <div
            className="pointer-events-none absolute inset-x-2 top-1/2 z-10 flex -translate-y-1/2 justify-between px-[2px]"
            aria-hidden="true"
          >
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full border-2 border-brand-surface ${index <= selectedIndex ? 'bg-brand-accent' : index <= max ? 'bg-brand-muted/50' : 'bg-brand-border'}`}
              />
            ))}
          </div>
          <Slider
            aria-label="Meal locality strength"
            aria-valuetext={labels[selectedIndex]}
            aria-describedby={hintId}
            min={0}
            max={2}
            step={1}
            value={[selectedIndex]}
            disabled={disabled || max === 0}
            onValueChange={([nextIndex]) => {
              onChange(preferences[Math.min(nextIndex, max)]);
            }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {labels.map((label, index) => {
            const Icon = index === 0 ? Globe2 : index === 1 ? Map : MapPin;
            const isAvailable = index <= max;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${index}:${label}`}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                disabled={disabled || !isAvailable}
                onClick={() => onChange(preferences[index])}
                className={`group flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface motion-reduce:transition-none ${
                  isSelected
                    ? 'border-brand-green bg-brand-green text-white shadow-[0_8px_20px_rgba(18,129,100,0.2)] dark:text-brand-black'
                    : isAvailable
                      ? 'border-transparent bg-brand-surface text-brand-text hover:-translate-y-0.5 hover:border-brand-green/35 hover:bg-brand-green/10'
                      : 'cursor-not-allowed border-transparent bg-brand-surface/45 text-brand-muted'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isAvailable ? (
                    isSelected ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    )
                  ) : (
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="line-clamp-2 text-[11px] font-extrabold leading-tight">{label}</span>
                </span>
                <span
                  className={`text-[9px] font-semibold ${isSelected ? 'text-current opacity-80' : 'text-brand-muted/70'}`}
                >
                  {index === 0
                    ? 'National'
                    : index === 1
                      ? isAvailable
                        ? 'Regional'
                        : 'Select region'
                      : isAvailable
                        ? 'Local'
                        : 'Select Province/HUC'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        id={hintId}
        className="mt-4 rounded-2xl border border-brand-border/60 bg-brand-surface/70 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-xs font-bold text-brand-text">Currently favoring: {labels[selectedIndex]}</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">{descriptions[selected]}</p>
        {max < 2 && <p className="mt-2 text-[11px] font-semibold text-brand-green">{availableHint}</p>}
      </div>
    </fieldset>
  );
}
