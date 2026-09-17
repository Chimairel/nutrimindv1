'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import Input from '@/components/ui/Input';
import type { PlanningGeographyLevel } from '@/types';
import { usePlanningLocations, validPlanningLocation } from '@/hooks/usePlanningLocations';
import { formatRegionDisplay, searchMatchesRegion, getCanonicalRegionName } from '@/lib/philippine-regions';
import { ChevronDown, Check } from 'lucide-react';

interface PlanningLocationFieldsProps {
  level: PlanningGeographyLevel;
  regionName: string;
  provinceHucName: string;
  onLevelChange: (level: PlanningGeographyLevel) => void;
  onRegionNameChange: (value: string) => void;
  onProvinceHucNameChange: (value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  required?: boolean;
}

export default function PlanningLocationFields({
  regionName,
  provinceHucName,
  onLevelChange,
  onRegionNameChange,
  onProvinceHucNameChange,
  disabled = false,
  idPrefix = 'planning-location',
  required = false,
}: PlanningLocationFieldsProps) {
  const { options, error } = usePlanningLocations();
  const canonicalRegion = getCanonicalRegionName(regionName) || regionName;
  const { regionValid } = validPlanningLocation(options, canonicalRegion, provinceHucName);

  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [isProvinceOpen, setIsProvinceOpen] = useState(false);

  const regionContainerRef = useRef<HTMLDivElement>(null);
  const provinceContainerRef = useRef<HTMLDivElement>(null);

  const provinceHucOptions = useMemo(
    () =>
      options.provinceHucs.filter(
        (option) => !canonicalRegion.trim() || option.regionName.toLowerCase() === canonicalRegion.trim().toLowerCase()
      ),
    [options.provinceHucs, canonicalRegion]
  );

  const filteredRegions = useMemo(() => {
    if (!regionName.trim()) return options.regions;
    return options.regions.filter((r) => searchMatchesRegion(regionName, r));
  }, [options.regions, regionName]);

  const filteredProvinces = useMemo(() => {
    if (!provinceHucName.trim()) return provinceHucOptions;
    return provinceHucOptions.filter((p) => p.name.toLowerCase().includes(provinceHucName.trim().toLowerCase()));
  }, [provinceHucOptions, provinceHucName]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (regionContainerRef.current && !regionContainerRef.current.contains(e.target as Node)) {
        setIsRegionOpen(false);
      }
      if (provinceContainerRef.current && !provinceContainerRef.current.contains(e.target as Node)) {
        setIsProvinceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleRegionChange = (value: string) => {
    onRegionNameChange(value);
    const canonical = getCanonicalRegionName(value) || value;
    const currentProvinceStillMatches = options.provinceHucs.some(
      (option) =>
        option.name.toLowerCase() === provinceHucName.trim().toLowerCase() &&
        option.regionName.toLowerCase() === canonical.trim().toLowerCase()
    );
    if (provinceHucName && !currentProvinceStillMatches) onProvinceHucNameChange('');
    onLevelChange(value.trim() ? 'REGION' : 'NATIONAL');
  };

  const handleProvinceHucChange = (value: string) => {
    onProvinceHucNameChange(value);
    onLevelChange(value.trim() && regionName.trim() ? 'PROVINCE_HUC' : regionName.trim() ? 'REGION' : 'NATIONAL');
  };

  const selectRegion = (value: string) => {
    handleRegionChange(formatRegionDisplay(value));
    setIsRegionOpen(false);
  };

  const isRegionPresent = Boolean(regionName.trim());
  const isRegionEffective = options.regions.length > 0 ? regionValid : isRegionPresent;

  const selectProvince = (value: string) => {
    handleProvinceHucChange(value);
    setIsProvinceOpen(false);
  };

  return (
    <fieldset className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/35 p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-brand-muted">
        Meal-planning location
      </legend>
      <p className="mb-4 text-xs leading-relaxed text-brand-muted">
        Start typing to search. KAINARA stores only your Region and Province/HUC—never a street address.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Region Combobox */}
        <div ref={regionContainerRef} className="relative flex flex-col">
          <Input
            id={`${idPrefix}-region`}
            label="Region"
            role="combobox"
            aria-expanded={isRegionOpen}
            aria-autocomplete="list"
            value={isRegionOpen ? regionName : formatRegionDisplay(regionName)}
            onFocus={() => setIsRegionOpen(true)}
            onChange={(event) => {
              handleRegionChange(event.target.value);
              setIsRegionOpen(true);
            }}
            placeholder="Start typing, e.g. Central Visayas"
            maxLength={120}
            required={required}
            disabled={disabled}
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle region choices"
            onClick={() => !disabled && setIsRegionOpen((prev) => !prev)}
            className="absolute right-3 top-[38px] text-brand-muted hover:text-brand-text transition-colors p-1"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isRegionOpen ? 'rotate-180 text-brand-green dark:text-brand-accent' : ''
              }`}
            />
          </button>

          {isRegionOpen && filteredRegions.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-brand-border/80 bg-brand-surface p-1 shadow-card backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100 dark:border-white/10 dark:bg-[#121e18] dark:shadow-[0_12px_32px_rgba(0,0,0,0.75)] scrollbar-thin">
              <ul role="listbox" className="space-y-0.5">
                {filteredRegions.map((region) => {
                  const isSelected = region.toLowerCase() === canonicalRegion.toLowerCase();
                  return (
                    <li
                      key={region}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectRegion(region)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors select-none ${
                        isSelected
                          ? 'bg-brand-green/15 text-brand-green dark:bg-brand-accent/20 dark:text-brand-accent font-bold'
                          : 'text-brand-text/90 hover:bg-brand-bgAlt/80 dark:text-white/80 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="truncate">{formatRegionDisplay(region)}</span>
                      {isSelected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-brand-green dark:text-brand-accent"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Province / HUC Combobox */}
        <div ref={provinceContainerRef} className="relative flex flex-col">
          <Input
            id={`${idPrefix}-province-huc`}
            label="Province / highly urbanized city"
            role="combobox"
            aria-expanded={isProvinceOpen}
            aria-autocomplete="list"
            value={provinceHucName}
            onFocus={() => isRegionEffective && setIsProvinceOpen(true)}
            onChange={(event) => {
              handleProvinceHucChange(event.target.value);
              if (isRegionEffective) setIsProvinceOpen(true);
            }}
            placeholder={isRegionPresent ? 'Start typing, e.g. Cebu' : 'Choose a region first'}
            maxLength={160}
            required={required}
            disabled={disabled || !isRegionEffective}
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle province choices"
            disabled={disabled || !isRegionEffective}
            onClick={() => !disabled && isRegionEffective && setIsProvinceOpen((prev) => !prev)}
            className="absolute right-3 top-[38px] text-brand-muted hover:text-brand-text transition-colors p-1 disabled:opacity-40"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isProvinceOpen ? 'rotate-180 text-brand-green dark:text-brand-accent' : ''
              }`}
            />
          </button>

          {isProvinceOpen && regionValid && filteredProvinces.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-brand-border/80 bg-brand-surface p-1 shadow-card backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100 dark:border-white/10 dark:bg-[#121e18] dark:shadow-[0_12px_32px_rgba(0,0,0,0.75)] scrollbar-thin">
              <ul role="listbox" className="space-y-0.5">
                {filteredProvinces.map((option) => {
                  const isSelected = option.name.toLowerCase() === provinceHucName.trim().toLowerCase();
                  return (
                    <li
                      key={`${option.regionName}:${option.name}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectProvince(option.name)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors select-none ${
                        isSelected
                          ? 'bg-brand-green/15 text-brand-green dark:bg-brand-accent/20 dark:text-brand-accent font-bold'
                          : 'text-brand-text/90 hover:bg-brand-bgAlt/80 dark:text-white/80 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="truncate">{option.name}</span>
                      {isSelected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-brand-green dark:text-brand-accent"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p role="status" className="mt-3 text-xs text-status-error-text">
          Location suggestions are unavailable. Reload this page to retry; regional and local preferences remain locked
          until the location is validated.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-brand-muted">
        Suggestions use the PSA PSGC {options.source?.version || 'reference list'}. Your separate meal-locality setting
        decides whether recommendations use Philippines, regional, or local familiarity evidence.
      </p>
    </fieldset>
  );
}
