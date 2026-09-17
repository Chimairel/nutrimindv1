'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getCanonicalRegionName } from '@/lib/philippine-regions';

export interface PlanningLocationOptions {
  regions: string[];
  provinceHucs: Array<{ name: string; regionName: string }>;
  source?: { label: string; version: string; url: string };
}

let cachedPlanningLocations: PlanningLocationOptions | null = null;
let planningLocationsPromise: Promise<PlanningLocationOptions> | null = null;

export function usePlanningLocations() {
  const [options, setOptions] = useState<PlanningLocationOptions>(
    cachedPlanningLocations || { regions: [], provinceHucs: [] }
  );
  const [isLoading, setIsLoading] = useState<boolean>(!cachedPlanningLocations);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cachedPlanningLocations) {
      setOptions(cachedPlanningLocations);
      setIsLoading(false);
      return;
    }

    if (!planningLocationsPromise) {
      planningLocationsPromise = api
        .get('/user/onboarding/planning-locations')
        .then((response) => {
          if (!response.data?.success) throw new Error('Location list unavailable');
          cachedPlanningLocations = response.data.data as PlanningLocationOptions;
          return cachedPlanningLocations;
        })
        .catch((err) => {
          planningLocationsPromise = null;
          throw err;
        });
    }

    let active = true;
    planningLocationsPromise
      .then((data) => {
        if (active) {
          setOptions(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { options, isLoading, error };
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
