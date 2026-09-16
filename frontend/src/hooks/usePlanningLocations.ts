'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getCanonicalRegionName } from '@/lib/philippine-regions';

export interface PlanningLocationOptions {
  regions: string[];
  provinceHucs: Array<{ name: string; regionName: string }>;
  source?: { label: string; version: string; url: string };
}

export function usePlanningLocations() {
  const [options, setOptions] = useState<PlanningLocationOptions>({ regions: [], provinceHucs: [] });
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get('/user/onboarding/planning-locations')
      .then((response) => {
        if (!response.data?.success) throw new Error('Location list unavailable');
        if (active) setOptions(response.data.data as PlanningLocationOptions);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { options, error };
}

export function validPlanningLocation(options: PlanningLocationOptions, region: string, province: string) {
  const canonical = getCanonicalRegionName(region) || region;
  const matches = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const regionValid = options.regions.some((name) => matches(name, canonical));
  return {
    regionValid,
    provinceValid:
      regionValid &&
      options.provinceHucs.some((item) => matches(item.regionName, canonical) && matches(item.name, province)),
  };
}
