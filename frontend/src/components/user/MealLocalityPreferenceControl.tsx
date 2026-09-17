'use client';

import React, { useId, useMemo } from 'react';
import { Globe2, LockKeyhole, Map, MapPin } from 'lucide-react';
import { usePlanningLocations, validPlanningLocation } from '@/hooks/usePlanningLocations';
import type { MealLocalityPreference } from '@/types';
import { AdaptiveSlider, AnimatedText } from '@/components/watermelon/adaptive-slider';
import PhilippineDynamicMap from './PhilippineDynamicMap';
import { formatRegionDisplay } from '@/lib/philippine-regions';

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

  const cleanRegion = regionName.trim();
  const cleanProvince = provinceHucName.trim();

  // If locations reference list is still loading, assume present values are valid to prevent layout jump
  const isLocationsLoading = options.regions.length === 0;
  const effectiveRegionValid = isLocationsLoading ? Boolean(cleanRegion) : regionValid;
  const effectiveProvinceValid = isLocationsLoading ? Boolean(cleanProvince && cleanRegion) : provinceValid;

  // 3 stops:
  // 1: National
  // 2: Regional
  // 3: Local (Province/HUC)
  const maxStop = effectiveProvinceValid ? 3 : effectiveRegionValid ? 2 : 1;

  const savedStops: Record<MealLocalityPreference, number> = {
    NATIONAL: 1,
    NATIONAL_REGIONAL: 2,
    REGIONAL: 2,
    REGIONAL_LOCAL: 3,
    LOCAL: 3,
  };
  const resolvedStop = Math.min(savedStops[value] ?? 1, maxStop);

  // Define the 3 stops
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
        preference: 'REGIONAL' as MealLocalityPreference,
        buttonName: cleanRegion || 'Region',
        badge: 'Regional',
        title: cleanRegion ? formatRegionDisplay(cleanRegion) : 'Region',
        subtitle: cleanRegion ? `${formatRegionDisplay(cleanRegion)} focus` : 'Region-wide focus',
        ariaText: cleanRegion ? formatRegionDisplay(cleanRegion) : 'Region',
        description: cleanRegion
          ? `Prioritize food familiar across ${formatRegionDisplay(cleanRegion)}, then fall back to national evidence.`
          : 'Prioritize food familiar across your region, then fall back to national evidence.',
        isAvailable: effectiveRegionValid,
        Icon: Map,
      },
      {
        stop: 3,
        preference: 'LOCAL' as MealLocalityPreference,
        buttonName: cleanProvince || 'Province/HUC',
        badge: 'Local',
        title: cleanProvince || 'Province/HUC',
        subtitle: cleanProvince ? `${cleanProvince} focus` : 'Province/HUC focus',
        ariaText: cleanProvince || 'Province/HUC',
        description: cleanProvince
          ? `Prioritize food familiar in ${cleanProvince}, then fall back to regional and national evidence.`
          : 'Prioritize food familiar in your province/HUC, then fall back to regional and national evidence.',
        isAvailable: effectiveProvinceValid,
        Icon: MapPin,
      },
    ];
  }, [cleanRegion, cleanProvince, effectiveRegionValid, effectiveProvinceValid]);

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
        Choose how strongly KAINARA should favor familiar meals. Safety, nutrition, and budget rules still come first.
      </p>

      {/* Embedded Dynamic Interactive Philippine Map */}
      <div className="mb-5">
        <PhilippineDynamicMap
          preference={currentStopData.preference}
          regionName={cleanRegion}
          provinceHucName={cleanProvince}
        />
      </div>

      <div className="rounded-[20px] border border-brand-border/80 bg-brand-bgAlt/45 p-4 shadow-inner sm:p-5">
        {/* Top Active Stop Indicator */}
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-brand-green">
              Stop {resolvedStop} of 3
            </span>
            <span className="text-[11px] font-bold text-brand-muted">{currentStopData.badge}</span>
          </div>
          <div className="overflow-hidden">
            <AnimatedText value={currentStopData.title} className="text-xs font-black text-brand-text sm:text-sm" />
          </div>
        </div>

        {/* 3-Stop Adaptive Slider */}
        <div className="relative mb-4">
          <AdaptiveSlider
            value={resolvedStop}
            min={1}
            max={3}
            step={1}
            maxAllowed={maxStop}
            disabled={disabled || maxStop === 1}
            onChange={handleStopChange}
            aria-label="Meal locality strength"
            aria-valuetext={currentStopData.buttonName}
            aria-describedby={hintId}
          />
        </div>

        {/* 3 Stop Selection Labels (Clean, Unboxed) */}
        <div className="flex items-center justify-between gap-1 pt-1 sm:gap-2">
          {stops.map((stopItem) => {
            const isSelected = stopItem.stop === resolvedStop;
            const isUnlocked = stopItem.isAvailable;
            const Icon = stopItem.Icon;

            return (
              <button
                key={stopItem.stop}
                type="button"
                aria-label={stopItem.buttonName}
                aria-pressed={isSelected}
                disabled={disabled || !isUnlocked}
                onClick={() => handleStopChange(stopItem.stop)}
                className={`group flex flex-1 items-center gap-2 rounded-xl py-2 px-2.5 transition-all text-left outline-none ${
                  isSelected
                    ? 'bg-brand-green/10 text-brand-green dark:bg-brand-accent/15 dark:text-brand-accent'
                    : isUnlocked
                      ? 'text-brand-muted hover:text-brand-text hover:bg-brand-surface/70 cursor-pointer'
                      : 'text-brand-muted/40 cursor-not-allowed opacity-50'
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono font-black transition-all ${
                    isSelected
                      ? 'bg-brand-green text-white dark:bg-brand-accent dark:text-black shadow-sm'
                      : isUnlocked
                        ? 'bg-brand-bgAlt border border-brand-border/80 text-brand-muted group-hover:border-brand-green/40'
                        : 'bg-brand-bgAlt/50 text-brand-muted/40'
                  }`}
                >
                  {isUnlocked ? stopItem.stop : <LockKeyhole className="h-3 w-3" />}
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="text-xs font-extrabold leading-tight truncate">{stopItem.badge}</span>
                  </div>
                  <span className="text-[10px] leading-tight text-brand-muted truncate">
                    {isUnlocked
                      ? stopItem.stop === 1
                        ? 'Nationwide'
                        : stopItem.stop === 2
                          ? cleanRegion
                            ? formatRegionDisplay(cleanRegion)
                            : 'Region'
                          : cleanProvince || 'Local'
                      : stopItem.stop === 2
                        ? 'Select Region'
                        : 'Select Province'}
                  </span>
                </div>
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
            Stop {resolvedStop} of 3
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">{currentStopData.description}</p>
        {maxStop < 3 && <p className="mt-2 text-[11px] font-semibold text-brand-green">{availableHint}</p>}
      </div>
    </fieldset>
  );
}
