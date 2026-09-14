'use client';

import React, { useId, useMemo } from 'react';
import { Check, Compass, Globe2, LockKeyhole, Map, MapPin, Sparkles } from 'lucide-react';
import { usePlanningLocations, validPlanningLocation } from '@/hooks/usePlanningLocations';
import type { MealLocalityPreference } from '@/types';
import { AdaptiveSlider, AnimatedText } from '@/components/watermelon/adaptive-slider';

interface MealLocalityPreferenceControlProps {
  value: MealLocalityPreference;
  regionName: string;
  provinceHucName: string;
  onChange: (value: MealLocalityPreference) => void;
  disabled?: boolean;
}

export default function MealLocalityPreferenceControl({
  value,
  regionName,
  provinceHucName,
  onChange,
  disabled = false,
}: MealLocalityPreferenceControlProps) {
  const hintId = useId();
  const { options } = usePlanningLocations();
  const { regionValid, provinceValid } = validPlanningLocation(options, regionName, provinceHucName);

  // 5 stops:
  // 1: National
  // 2: National & Regional blend
  // 3: Regional
  // 4: Regional & Local blend
  // 5: Province/HUC
  const maxStop = provinceValid ? 5 : regionValid ? 3 : 1;

  const savedStops: Record<MealLocalityPreference, number> = {
    NATIONAL: 1,
    NATIONAL_REGIONAL: 2,
    REGIONAL: 3,
    REGIONAL_LOCAL: 4,
    LOCAL: 5,
  };
  const resolvedStop = Math.min(savedStops[value], maxStop);

  const cleanRegion = regionName.trim();
  const cleanProvince = provinceHucName.trim();

  // Define the 5 stops
  const stops = useMemo(() => {
    return [
      {
        stop: 1,
        preference: 'NATIONAL' as MealLocalityPreference,
        buttonName: 'Philippines',
        badge: 'National',
        title: 'Philippines',
        subtitle: 'Nationwide familiarity',
        ariaText: 'Philippines',
        description: 'Favor Philippines-wide familiarity. Published consumption evidence is used when available.',
        isAvailable: true,
        Icon: Globe2,
      },
      {
        stop: 2,
        preference: 'NATIONAL_REGIONAL' as MealLocalityPreference,
        buttonName: 'National-Regional blend',
        badge: 'National+',
        title: cleanRegion ? `Philippines & ${cleanRegion}` : 'National & Regional blend',
        subtitle: cleanRegion ? `National with ${cleanRegion} lean` : 'Balanced National & Regional',
        ariaText: cleanRegion ? `Philippines with ${cleanRegion} lean` : 'National and Regional blend',
        description: cleanRegion
          ? `Anchor in nationwide Filipino staples while gently incorporating regional favorites from ${cleanRegion}.`
          : 'Balance nationwide favorites with regional specialties.',
        isAvailable: regionValid,
        Icon: Compass,
      },
      {
        stop: 3,
        preference: 'REGIONAL' as MealLocalityPreference,
        buttonName: cleanRegion || 'Region',
        badge: 'Regional',
        title: cleanRegion || 'Region',
        subtitle: cleanRegion ? `${cleanRegion} focus` : 'Region-wide focus',
        ariaText: cleanRegion || 'Region',
        description: cleanRegion
          ? `Prioritize food familiar across ${cleanRegion}, then fall back to national evidence.`
          : 'Prioritize food familiar across your region, then fall back to national evidence.',
        isAvailable: regionValid,
        Icon: Map,
      },
      {
        stop: 4,
        preference: 'REGIONAL_LOCAL' as MealLocalityPreference,
        buttonName: 'Regional-Local blend',
        badge: 'Local+',
        title: cleanProvince && cleanRegion ? `${cleanRegion} & ${cleanProvince}` : 'Regional & Local blend',
        subtitle: cleanProvince
          ? `${cleanRegion || 'Regional'} with ${cleanProvince} favorites`
          : 'Regional & Local blend',
        ariaText: cleanProvince
          ? `${cleanRegion || 'Regional'} with ${cleanProvince} favorites`
          : 'Regional and Local blend',
        description: cleanProvince
          ? `Blend broader regional dishes with distinctive local favorites from ${cleanProvince}.`
          : 'Blend regional dishes with distinctive province/city favorites.',
        isAvailable: provinceValid,
        Icon: Sparkles,
      },
      {
        stop: 5,
        preference: 'LOCAL' as MealLocalityPreference,
        buttonName: cleanProvince || 'Province/HUC',
        badge: 'Local',
        title: cleanProvince || 'Province/HUC',
        subtitle: cleanProvince ? `${cleanProvince} focus` : 'Province/HUC focus',
        ariaText: cleanProvince || 'Province/HUC',
        description: cleanProvince
          ? `Prioritize food familiar in ${cleanProvince}, then fall back to regional and national evidence.`
          : 'Prioritize food familiar in your province/HUC, then fall back to regional and national evidence.',
        isAvailable: provinceValid,
        Icon: MapPin,
      },
    ];
  }, [cleanRegion, cleanProvince, regionValid, provinceValid]);

  const currentStopData = stops[resolvedStop - 1];

  const handleStopChange = (nextStop: number) => {
    const clamped = Math.min(Math.max(nextStop, 1), maxStop);
    const stopData = stops[clamped - 1];
    onChange(stopData.preference);
  };

  const availableHint = !regionValid
    ? 'Choose a valid Region from the location suggestions above to unlock regional preferences.'
    : !provinceValid
      ? 'Choose a valid Province or HUC in your Region from the suggestions above to unlock local preferences.'
      : 'All locality levels are available.';

  return (
    <fieldset className="rounded-[24px] border border-brand-border/70 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/5 p-5 shadow-sm text-left">
      <legend className="px-2 text-xs font-extrabold uppercase tracking-[0.13em] text-brand-muted">
        Meal locality strength
      </legend>
      <p className="mb-5 text-xs leading-relaxed text-brand-muted">
        Choose how strongly NutriMind should favor familiar meals. Safety, nutrition, and budget rules still come first.
      </p>

      <div className="rounded-[20px] border border-brand-border/80 bg-brand-bgAlt/45 p-4 shadow-inner sm:p-6">
        {/* Top Active Stop Indicator */}
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-brand-green">
              Stop {resolvedStop} of 5
            </span>
            <span className="text-[11px] font-bold text-brand-muted">{currentStopData.badge}</span>
          </div>
          <div className="overflow-hidden">
            <AnimatedText value={currentStopData.title} className="text-xs font-black text-brand-text sm:text-sm" />
          </div>
        </div>

        {/* Watermelon UI Adaptive Slider */}
        <div className="relative mb-6">
          <AdaptiveSlider
            value={resolvedStop}
            min={1}
            max={5}
            step={1}
            maxAllowed={maxStop}
            disabled={disabled || maxStop === 1}
            onChange={handleStopChange}
            aria-label="Meal locality strength"
            aria-valuetext={currentStopData.ariaText}
            aria-describedby={hintId}
          />
        </div>

        {/* 5 Stop Selection Buttons */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {stops.map((stopItem) => {
            const isSelected = stopItem.stop === resolvedStop;
            const isUnlocked = stopItem.isAvailable;
            const Icon = stopItem.Icon;
            const isLabeledStop = stopItem.stop === 1 || stopItem.stop === 3 || stopItem.stop === 5;

            return (
              <button
                key={stopItem.stop}
                type="button"
                aria-label={stopItem.buttonName}
                aria-pressed={isSelected}
                disabled={disabled || !isUnlocked}
                onClick={() => handleStopChange(stopItem.stop)}
                className={`group flex min-h-[76px] flex-col items-center justify-between rounded-2xl border p-2 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface motion-reduce:transition-none ${
                  isSelected
                    ? 'border-brand-green bg-brand-green text-white shadow-[0_6px_18px_rgba(18,129,100,0.25)] dark:text-brand-black'
                    : isUnlocked
                      ? 'border-brand-border/60 bg-brand-surface text-brand-text hover:-translate-y-0.5 hover:border-brand-green/35 hover:bg-brand-green/10'
                      : 'cursor-not-allowed border-transparent bg-brand-surface/40 text-brand-muted/60 opacity-60'
                }`}
              >
                {/* Top Icon & Lock */}
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[9px] font-black opacity-75">{stopItem.stop}</span>
                  {isLabeledStop ? (
                    isUnlocked ? (
                      isSelected ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3 w-3 text-brand-green" aria-hidden="true" />
                      )
                    ) : (
                      <LockKeyhole className="h-3 w-3 text-brand-muted/70" aria-hidden="true" />
                    )
                  ) : isSelected ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : !isUnlocked ? (
                    <LockKeyhole className="h-3 w-3 text-brand-muted/70" aria-hidden="true" />
                  ) : (
                    <span className="h-3 w-3" />
                  )}
                </div>

                {isLabeledStop ? (
                  <>
                    {/* Badge / Stop Type */}
                    <span className="line-clamp-1 text-[10px] font-extrabold leading-tight">{stopItem.badge}</span>

                    {/* Subtitle / Location Target */}
                    <span
                      className={`line-clamp-1 text-[8px] font-semibold ${
                        isSelected ? 'text-current opacity-85' : 'text-brand-muted'
                      }`}
                    >
                      {isUnlocked
                        ? stopItem.stop === 1
                          ? 'National'
                          : stopItem.stop === 3
                            ? cleanRegion || 'Region'
                            : cleanProvince || 'Local'
                        : stopItem.stop <= 3
                          ? 'Select region'
                          : 'Select Province'}
                    </span>
                  </>
                ) : (
                  <>
                    {/* Unlabeled Stop (2 & 4) - Centered Icon Body */}
                    <div className="flex flex-1 items-center justify-center my-auto">
                      <Icon
                        className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                          isSelected
                            ? 'text-current'
                            : isUnlocked
                              ? 'text-brand-green opacity-90'
                              : 'text-brand-muted/70'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="h-1" />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Explanation Box */}
      <div
        id={hintId}
        className="mt-4 rounded-2xl border border-brand-border/60 bg-brand-surface/70 px-4 py-3"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-brand-text">Currently favoring: {currentStopData.title}</p>
          <span className="rounded-md border border-brand-border bg-brand-bgAlt px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-green">
            Stop {resolvedStop} of 5
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">{currentStopData.description}</p>
        {maxStop < 5 && <p className="mt-2 text-[11px] font-semibold text-brand-green">{availableHint}</p>}
      </div>
    </fieldset>
  );
}
