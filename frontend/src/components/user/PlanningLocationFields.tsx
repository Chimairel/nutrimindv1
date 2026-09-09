'use client';

import { useEffect, useMemo, useState } from 'react';
import Input from '@/components/ui/Input';
import type { PlanningGeographyLevel } from '@/types';
import api from '@/lib/axios';

interface PlanningLocationOptions {
  regions: string[];
  provinceHucs: Array<{ name: string; regionName: string }>;
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
}

export default function PlanningLocationFields({
  level,
  regionName,
  provinceHucName,
  onLevelChange,
  onRegionNameChange,
  onProvinceHucNameChange,
  disabled = false,
  idPrefix = 'planning-location',
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

  const handleLevelChange = (nextLevel: PlanningGeographyLevel) => {
    onLevelChange(nextLevel);
    if (nextLevel === 'NATIONAL') {
      onRegionNameChange('');
      onProvinceHucNameChange('');
    } else if (nextLevel === 'REGION') {
      onProvinceHucNameChange('');
    }
  };

  return (
    <fieldset className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/35 p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-brand-muted">
        Meal-planning location
      </legend>
      <p className="mb-4 text-xs leading-relaxed text-brand-muted">
        Used only to prioritize aggregate local food evidence. Do not enter a street address.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={level === 'NATIONAL' ? 'sm:col-span-2' : ''}>
          <label
            htmlFor={`${idPrefix}-level`}
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-muted"
          >
            Evidence area
          </label>
          <select
            id={`${idPrefix}-level`}
            value={level}
            onChange={(event) => handleLevelChange(event.target.value as PlanningGeographyLevel)}
            disabled={disabled}
            className="w-full rounded-xl border border-brand-border bg-brand-bgAlt px-4 py-3 text-sm text-brand-text outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/15 disabled:opacity-60"
          >
            <option value="NATIONAL">Philippines — national</option>
            <option value="REGION">Region</option>
            <option value="PROVINCE_HUC">Province or highly urbanized city</option>
          </select>
        </div>
        {level !== 'NATIONAL' && (
          <Input
            id={`${idPrefix}-region`}
            list={`${idPrefix}-region-options`}
            label="Region"
            value={regionName}
            onChange={(event) => onRegionNameChange(event.target.value)}
            placeholder="e.g. Central Visayas"
            maxLength={120}
            required
            disabled={disabled}
          />
        )}
        {level === 'PROVINCE_HUC' && (
          <Input
            id={`${idPrefix}-province-huc`}
            list={`${idPrefix}-province-huc-options`}
            label="Province / HUC"
            value={provinceHucName}
            onChange={(event) => onProvinceHucNameChange(event.target.value)}
            placeholder="e.g. Cebu City"
            maxLength={160}
            required
            disabled={disabled}
          />
        )}
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
      {level !== 'NATIONAL' && (
        <p className="mt-3 text-[11px] leading-relaxed text-brand-muted">
          If no published evidence matches this area, NutriMind automatically falls back to{' '}
          {level === 'PROVINCE_HUC' ? 'regional and then national data' : 'national data'}.
        </p>
      )}
    </fieldset>
  );
}
