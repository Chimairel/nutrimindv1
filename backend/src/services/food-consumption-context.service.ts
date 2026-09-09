import prisma from '@/lib/prisma';
import {
  resolveFirstAvailableConsumptionScope,
  type ConsumptionScope,
  type PlanningLocation,
} from '@/domain/planning-location.policy';
import { PSGC_PLANNING_GEOGRAPHY, PSGC_PROVINCE_HUCS, PSGC_REGIONS } from '@/data/philippine-planning-geography';

interface ConsumptionContextItem {
  id: string;
  name: string;
  category: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface LocalizedFoodConsumptionContext {
  text: string;
  matchedScope: ConsumptionScope | null;
  items: ConsumptionContextItem[];
  releaseLabel: string | null;
}

export interface PlanningLocationOptions {
  regions: string[];
  provinceHucs: Array<{ name: string; regionName: string }>;
  source: {
    label: string;
    version: string;
    url: string;
  };
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-PH');
}

export async function getActivePlanningLocationOptions(): Promise<PlanningLocationOptions> {
  const rows = await prisma.foodConsumptionStat.findMany({
    where: {
      release: {
        status: 'ACTIVE',
        source: { isEnabled: true, domain: 'FOOD_CONSUMPTION' },
      },
      geographyLevel: { in: ['REGION', 'PROVINCE_HUC'] },
      mappingStatus: { in: ['EXACT', 'MANUAL'] },
      regionName: { not: null },
    },
    select: { regionName: true, provinceHucName: true },
    distinct: ['regionName', 'provinceHucName'],
    orderBy: [{ regionName: 'asc' }, { provinceHucName: 'asc' }],
  });
  const activeRegions = rows.map((row) => row.regionName).filter((name): name is string => Boolean(name));
  const activeProvinceHucs = rows
    .filter(
      (row): row is { regionName: string; provinceHucName: string } =>
        Boolean(row.regionName) && Boolean(row.provinceHucName)
    )
    .map((row) => ({ name: row.provinceHucName, regionName: row.regionName }));
  const regionsByKey = new Map<string, string>(PSGC_REGIONS.map((name) => [normalizedKey(name), name]));
  activeRegions.forEach((name) => regionsByKey.set(normalizedKey(name), name));
  const provinceHucsByKey = new Map<string, { name: string; regionName: string }>(
    PSGC_PROVINCE_HUCS.map((option) => [`${normalizedKey(option.regionName)}:${normalizedKey(option.name)}`, option])
  );
  activeProvinceHucs.forEach((option) =>
    provinceHucsByKey.set(`${normalizedKey(option.regionName)}:${normalizedKey(option.name)}`, option)
  );
  return {
    regions: [...regionsByKey.values()],
    provinceHucs: [...provinceHucsByKey.values()],
    source: {
      label: PSGC_PLANNING_GEOGRAPHY.sourceLabel,
      version: PSGC_PLANNING_GEOGRAPHY.sourceVersion,
      url: PSGC_PLANNING_GEOGRAPHY.sourceUrl,
    },
  };
}

/**
 * Builds a compact, provenance-backed popularity hint for meal generation.
 * Only active aggregate releases and explicit FNRI mappings are eligible.
 * The hint never overrides calorie, dietary, allergy, or clinical constraints.
 */
export async function getLocalizedFoodConsumptionContext(
  location?: PlanningLocation | null,
  limit = 40
): Promise<LocalizedFoodConsumptionContext> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));

  const resolved = await resolveFirstAvailableConsumptionScope(location, (scope) =>
    prisma.foodConsumptionStat.findMany({
      where: {
        release: {
          status: 'ACTIVE',
          source: { isEnabled: true, domain: 'FOOD_CONSUMPTION' },
        },
        geographyLevel: scope.level,
        ...(scope.regionName ? { regionName: { equals: scope.regionName, mode: 'insensitive' as const } } : {}),
        ...(scope.provinceHucName
          ? { provinceHucName: { equals: scope.provinceHucName, mode: 'insensitive' as const } }
          : {}),
        foodItemId: { not: null },
        mappingStatus: { in: ['EXACT', 'MANUAL'] },
      },
      take: boundedLimit,
      orderBy: [{ rank: 'asc' }, { percentConsuming: 'desc' }, { meanIntakeG: 'desc' }],
      select: {
        rank: true,
        percentConsuming: true,
        meanIntakeG: true,
        populationGroup: true,
        foodItem: {
          select: {
            id: true,
            name: true,
            category: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
          },
        },
        release: { select: { versionLabel: true, source: { select: { code: true } } } },
      },
    })
  );

  if (!resolved.scope) return { text: '', matchedScope: null, items: [], releaseLabel: null };

  const scope = resolved.scope;
  const rows = resolved.rows;

  const seen = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const id = row.foodItem?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const items = uniqueRows.map((row) => row.foodItem!);
  const text = uniqueRows
    .map((row) => {
      const measures = [
        row.rank ? `rank ${row.rank}` : null,
        row.percentConsuming !== null ? `${row.percentConsuming}% consuming` : null,
        row.meanIntakeG !== null ? `${row.meanIntakeG} g/day mean` : null,
      ].filter(Boolean);
      return `- [FNRI_ID=${row.foodItem!.id}] ${row.foodItem!.name} (${row.populationGroup}; ${measures.join(', ') || 'reported'}; scope ${scope.label}; ${row.release.source.code} ${row.release.versionLabel})`;
    })
    .join('\n');

  const firstRelease = uniqueRows[0]?.release;
  return {
    text,
    matchedScope: scope,
    items,
    releaseLabel: firstRelease ? `${firstRelease.source.code} ${firstRelease.versionLabel}` : null,
  };
}

/** Backward-compatible national helper for non-localized callers. */
export async function getActiveFoodConsumptionContext(limit = 40): Promise<string> {
  return (await getLocalizedFoodConsumptionContext({ planningGeographyLevel: 'NATIONAL' }, limit)).text;
}
