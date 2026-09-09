import prisma from '@/lib/prisma';

/**
 * Builds a compact, provenance-backed popularity hint for meal generation.
 * Only active aggregate releases and explicit FNRI mappings are eligible.
 * The hint never overrides calorie, dietary, allergy, or clinical constraints.
 */
export async function getActiveFoodConsumptionContext(limit = 40): Promise<string> {
  const rows = await prisma.foodConsumptionStat.findMany({
    where: {
      release: {
        status: 'ACTIVE',
        source: { isEnabled: true, domain: 'FOOD_CONSUMPTION' },
      },
      geographyLevel: 'NATIONAL',
      foodItemId: { not: null },
      mappingStatus: { in: ['EXACT', 'MANUAL'] },
    },
    take: Math.max(1, Math.min(limit, 100)),
    orderBy: [{ rank: 'asc' }, { percentConsuming: 'desc' }, { meanIntakeG: 'desc' }],
    select: {
      rank: true,
      percentConsuming: true,
      meanIntakeG: true,
      populationGroup: true,
      foodItem: { select: { name: true } },
      release: { select: { versionLabel: true, source: { select: { code: true } } } },
    },
  });

  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const name = row.foodItem?.name;
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((row) => {
      const measures = [
        row.rank ? `rank ${row.rank}` : null,
        row.percentConsuming !== null ? `${row.percentConsuming}% consuming` : null,
        row.meanIntakeG !== null ? `${row.meanIntakeG} g/day mean` : null,
      ].filter(Boolean);
      return `- ${row.foodItem!.name} (${row.populationGroup}; ${measures.join(', ') || 'reported'}; ${row.release.source.code} ${row.release.versionLabel})`;
    })
    .join('\n');
}
