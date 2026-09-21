import prisma from '@/lib/prisma';
import {
  resolveConsumptionScopeGroups,
  interleaveScopeRows,
  type ConsumptionScope,
  type PlanningLocation,
} from '@/domain/planning-location.policy';
import { PSGC_PLANNING_GEOGRAPHY, PSGC_PROVINCE_HUCS, PSGC_REGIONS } from '@/data/philippine-planning-geography';
import {
  calculateFoodGroupFamiliarityScore,
  type EnnsFoodGroupCode,
} from '@/domain/enns-food-group.policy';

interface ConsumptionContextItem {
  id: string;
  name: string;
  category: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface LocalizedFoodGroupSignal {
  code: EnnsFoodGroupCode;
  name: string;
  score: number;
  rank: number | null;
  percentConsuming: number | null;
  meanIntakeG: number | null;
  relativeToNational: number | null;
  scopeLabels: string[];
}

export interface LocalizedFoodConsumptionContext {
  text: string;
  matchedScope: ConsumptionScope | null;
  items: ConsumptionContextItem[];
  foodGroups: LocalizedFoodGroupSignal[];
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
      OR: [
        { mappingStatus: { in: ['EXACT', 'MANUAL'] } },
        { foodGroupCode: { not: null } },
      ],
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
 * Only active aggregate releases are eligible. Exact-food hints require an
 * explicit FNRI mapping; ENNS group hints require a recognized group code.
 * The hint never overrides calorie, dietary, allergy, or clinical constraints.
 */
export async function getLocalizedFoodConsumptionContext(
  location?: PlanningLocation | null,
  limit = 40
): Promise<LocalizedFoodConsumptionContext> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));

  const groups = await resolveConsumptionScopeGroups(location, (scope) =>
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
        OR: [
          { foodItemId: { not: null }, mappingStatus: { in: ['EXACT', 'MANUAL'] } },
          { foodGroupCode: { not: null } },
        ],
      },
      take: boundedLimit,
      orderBy: [{ rank: 'asc' }, { percentConsuming: 'desc' }, { meanIntakeG: 'desc' }],
      select: {
        rank: true,
        percentConsuming: true,
        meanIntakeG: true,
        foodGroupCode: true,
        foodNameRaw: true,
        relativeToNational: true,
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

  if (!groups.length) return { text: '', matchedScope: null, items: [], foodGroups: [], releaseLabel: null };

  const scope = { ...groups[0].scope, label: groups.map((group) => group.scope.label).join(' + ') };
  const rows = interleaveScopeRows(groups);

  const seen = new Set<string>();
  const uniqueRows = rows
    .filter(({ row }) => {
      const id = row.foodItem?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, boundedLimit);
  const items = uniqueRows.map(({ row }) => row.foodItem!);
  const exactFoodText = uniqueRows
    .map(({ row, scope: rowScope }) => {
      const measures = [
        row.rank ? `rank ${row.rank}` : null,
        row.percentConsuming !== null ? `${row.percentConsuming}% consuming` : null,
        row.meanIntakeG !== null ? `${row.meanIntakeG} g/day mean` : null,
      ].filter(Boolean);
      return `- [FNRI_ID=${row.foodItem!.id}] ${row.foodItem!.name} (${row.populationGroup}; ${measures.join(', ') || 'reported'}; scope ${rowScope.label}; ${row.release.source.code} ${row.release.versionLabel})`;
    })
    .join('\n');

  const groupSignals = new Map<
    string,
    {
      code: EnnsFoodGroupCode;
      name: string;
      scores: number[];
      ranks: number[];
      percents: number[];
      means: number[];
      relatives: number[];
      scopeLabels: Set<string>;
    }
  >();
  for (const { row, scope: rowScope } of rows) {
    if (!row.foodGroupCode) continue;
    const existing = groupSignals.get(row.foodGroupCode) ?? {
      code: row.foodGroupCode as EnnsFoodGroupCode,
      name: row.foodNameRaw,
      scores: [],
      ranks: [],
      percents: [],
      means: [],
      relatives: [],
      scopeLabels: new Set<string>(),
    };
    existing.scores.push(calculateFoodGroupFamiliarityScore(row));
    if (row.rank !== null) existing.ranks.push(row.rank);
    if (row.percentConsuming !== null) existing.percents.push(row.percentConsuming);
    if (row.meanIntakeG !== null) existing.means.push(row.meanIntakeG);
    if (row.relativeToNational !== null) existing.relatives.push(row.relativeToNational);
    existing.scopeLabels.add(rowScope.label);
    groupSignals.set(row.foodGroupCode, existing);
  }
  const average = (values: number[]): number | null =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const foodGroups = [...groupSignals.values()]
    .map<LocalizedFoodGroupSignal>((signal) => ({
      code: signal.code,
      name: signal.name,
      score: average(signal.scores) ?? 0,
      rank: signal.ranks.length ? Math.round(average(signal.ranks)!) : null,
      percentConsuming: average(signal.percents),
      meanIntakeG: average(signal.means),
      relativeToNational: average(signal.relatives),
      scopeLabels: [...signal.scopeLabels],
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  const groupText = foodGroups
    .map((group) => {
      const measures = [
        group.rank ? `rank ${group.rank}` : null,
        group.percentConsuming !== null ? `${group.percentConsuming.toFixed(1)}% consuming` : null,
        group.meanIntakeG !== null ? `${group.meanIntakeG.toFixed(1)} g/day mean` : null,
        group.relativeToNational !== null ? `${group.relativeToNational.toFixed(2)}x national mean` : null,
      ].filter(Boolean);
      return `- [ENNS_GROUP=${group.code}] ${group.name} (${measures.join(', ')}; scope ${group.scopeLabels.join(' + ')})`;
    })
    .join('\n');
  const text = [groupText, exactFoodText].filter(Boolean).join('\n');

  const releases = [
    ...new Set(rows.map(({ row }) => `${row.release.source.code} ${row.release.versionLabel}`)),
  ];
  return {
    text,
    matchedScope: scope,
    items,
    foodGroups,
    releaseLabel: releases.length ? releases.join(' + ') : null,
  };
}

/** Backward-compatible national helper for non-localized callers. */
export async function getActiveFoodConsumptionContext(limit = 40): Promise<string> {
  return (await getLocalizedFoodConsumptionContext({ planningGeographyLevel: 'NATIONAL' }, limit)).text;
}
