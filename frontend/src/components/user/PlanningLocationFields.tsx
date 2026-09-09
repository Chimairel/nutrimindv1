'use client';

import { useEffect, useMemo, useState } from 'react';
import Input from '@/components/ui/Input';
import type { PlanningGeographyLevel } from '@/types';
import api from '@/lib/axios';

interface PlanningLocationOptions {
  regions: string[];
  provinceHucs: Array<{ name: string; regionName: string }>;
  source?: { label: string; version: string; url: string };
}

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
  const [options, setOptions] = useState<PlanningLocationOptions>({ regions: [], provinceHucs: [] });

  useEffect(() => {
    let active = true;
    api
      .get('/user/onboarding/planning-locations')
      .then((response) => {
        if (active && response.data?.success) setOptions(response.data.data as PlanningLocationOptions);
      })
      .catch(() => {
        // Published locality evidence is optional. Free text still falls back safely to national evidence.
      });
    return () => {
      active = false;
    };
  }, []);

  const provinceHucOptions = useMemo(
    () =>
      options.provinceHucs.filter(
        (option) => !regionName.trim() || option.regionName.toLowerCase() === regionName.trim().toLowerCase()
      ),
    [options.provinceHucs, regionName]
  );

  const handleRegionChange = (value: string) => {
    onRegionNameChange(value);
    const currentProvinceStillMatches = options.provinceHucs.some(
      (option) =>
        option.name.toLowerCase() === provinceHucName.trim().toLowerCase() &&
        option.regionName.toLowerCase() === value.trim().toLowerCase()
    );
    if (provinceHucName && !currentProvinceStillMatches) onProvinceHucNameChange('');
    onLevelChange(value.trim() ? 'REGION' : 'NATIONAL');
  };

  const handleProvinceHucChange = (value: string) => {
    onProvinceHucNameChange(value);
    onLevelChange(value.trim() && regionName.trim() ? 'PROVINCE_HUC' : regionName.trim() ? 'REGION' : 'NATIONAL');
  };

  return (
    <fieldset className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/35 p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-brand-muted">
        Meal-planning location
      </legend>
      <p className="mb-4 text-xs leading-relaxed text-brand-muted">
        Start typing to search. NutriMind stores only your Region and Province/HUC—never a street address.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`${idPrefix}-region`}
          list={`${idPrefix}-region-options`}
          label="Region"
          value={regionName}
          onChange={(event) => handleRegionChange(event.target.value)}
          placeholder="Start typing, e.g. Central Visayas"
          maxLength={120}
          required={required}
          disabled={disabled}
        />
        <Input
          id={`${idPrefix}-province-huc`}
          list={`${idPrefix}-province-huc-options`}
          label="Province / highly urbanized city"
          value={provinceHucName}
          onChange={(event) => handleProvinceHucChange(event.target.value)}
          placeholder={regionName ? 'Start typing, e.g. Cebu' : 'Choose a region first'}
          maxLength={160}
          required={required}
          disabled={disabled || !regionName.trim()}
        />
      </div>
      <datalist id={`${idPrefix}-region-options`}>
        {options.regions.map((region) => (
          <option key={region} value={region} />
        ))}
      </datalist>
      <datalist id={`${idPrefix}-province-huc-options`}>
        {provinceHucOptions.map((option) => (
          <option key={`${option.regionName}:${option.name}`} value={option.name} />
        ))}
      </datalist>
      <p className="mt-3 text-[11px] leading-relaxed text-brand-muted">
        Suggestions use the PSA PSGC {options.source?.version || 'reference list'}. Your separate meal-locality setting
        decides whether recommendations use Philippines, regional, or local familiarity evidence.
      </p>
    </fieldset>
  );
}
