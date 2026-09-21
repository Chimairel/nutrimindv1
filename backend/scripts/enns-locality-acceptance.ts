import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '@/lib/prisma';
import { getLocalizedFoodConsumptionContext } from '@/services/food-consumption-context.service';
import { rankMealsByLocalizedFoodEvidence } from '@/domain/planning-location.policy';

async function main() {
  const release = await prisma.referenceDataRelease.findFirstOrThrow({
    where: { source: { code: 'FNRI_ENNS_IFCS' }, status: 'ACTIVE' },
    include: { source: true },
  });
  const aggregateCount = await prisma.foodConsumptionStat.count({ where: { releaseId: release.id } });
  assert.equal(aggregateCount, 2_620);
  assert.equal(
    await prisma.foodConsumptionStat.count({ where: { releaseId: release.id, foodGroupCode: { not: null } } }),
    2_620
  );
  assert.equal(
    await prisma.foodConsumptionStat.count({ where: { releaseId: release.id, foodItemId: { not: null } } }),
    0
  );

  const context = await getLocalizedFoodConsumptionContext(
    {
      planningGeographyLevel: 'PROVINCE_HUC',
      planningRegionName: 'SOCCSKSARGEN',
      planningProvinceHucName: 'General Santos',
      mealLocalityPreference: 'LOCAL',
    },
    40
  );
  assert.equal(context.matchedScope?.provinceHucName, 'General Santos');
  assert.match(context.releaseLabel ?? '', /FNRI_ENNS_IFCS/);
  const fish = context.foodGroups.find((group) => group.code === 'FISH_PRODUCTS');
  const meat = context.foodGroups.find((group) => group.code === 'MEAT_PRODUCTS');
  assert.ok(fish && meat);
  assert.ok((fish.relativeToNational ?? 0) > 1.2);

  const scores = new Map(context.foodGroups.map((group) => [group.code, group.score] as const));
  const ranked = rankMealsByLocalizedFoodEvidence(
    [
      { id: 'beef-meal', ingredients: [{ ingredientName: 'Beef strips' }] },
      { id: 'fish-meal', ingredients: [{ ingredientName: 'Fresh tuna' }] },
    ],
    new Set(),
    scores
  );
  assert.equal(ranked[0].id, 'fish-meal');

  console.log(
    JSON.stringify(
      {
        pass: true,
        release: release.versionLabel,
        aggregateRows: aggregateCount,
        respondentRowsPersisted: 0,
        matchedScope: context.matchedScope.label,
        generalSantosFishRelativeToNational: fish.relativeToNational,
        fishRankedAheadOfBeef: true,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
