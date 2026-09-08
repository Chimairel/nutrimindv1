import assert from 'node:assert/strict';
import prisma from '@/lib/prisma';
import { AdminDataService } from '@/services/admin-data.service';
import { getActiveFoodConsumptionContext } from '@/services/food-consumption-context.service';

function assertDisposableTarget() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55463' || url.pathname !== '/nutrimind_admin_data') {
    throw new Error('Acceptance is locked to the task-owned loopback database on port 55463.');
  }
}

async function main() {
  assertDisposableTarget();
  const admin = await prisma.user.create({
    data: {
      name: 'Reference Data Acceptance Admin',
      email: 'reference-data-acceptance@nutrimind.invalid',
      passwordHash: 'not-a-real-password-hash',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  const [rice, egg] = await Promise.all([
    prisma.foodItem.create({
      data: { name: 'Rice, well-milled, boiled', calories: 129, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 },
    }),
    prisma.foodItem.create({
      data: { name: 'Chicken egg, boiled', calories: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6 },
    }),
  ]);
  const source = await AdminDataService.createSource(admin.id, {
    code: 'acceptance_enns',
    name: 'Acceptance aggregate consumption source',
    agencyName: 'DOST-FNRI acceptance fixture',
    domain: 'FOOD_CONSUMPTION',
    homepageUrl: 'https://example.invalid/fnri',
    termsUrl: 'https://example.invalid/terms',
    attributionText: 'Synthetic acceptance data; not an official statistic.',
    updateCadence: 'Fixture only',
  });

  const createRelease = (versionLabel: string) =>
    AdminDataService.createRelease(admin.id, {
      sourceId: source.id,
      versionLabel,
      surveyYear: 2023,
      sourceUrl: `https://example.invalid/${versionLabel}`,
      retrievedAt: new Date().toISOString(),
      notes: 'Synthetic local acceptance release',
    });

  const first = await createRelease('acceptance-v1');
  const firstImport = await AdminDataService.importConsumptionCsv(
    admin.id,
    first.id,
    [
      'population_group,geography_level,food_name,region_code,region_name,province_huc_code,province_huc_name,place_type,rank,percent_consuming,mean_intake_g,sample_size',
      'Adults 19-59,NATIONAL,"Rice, well-milled, boiled",,,,,,1,96.6,254,30000',
      'Adults 19-59,REGION,Unknown local dish,07,Central Visayas,,,URBAN,2,12.5,48,1000',
    ].join('\n')
  );
  assert.deepEqual(
    { rows: firstImport.rowCount, exact: firstImport.exact, unmapped: firstImport.unmapped },
    { rows: 2, exact: 1, unmapped: 1 }
  );
  await AdminDataService.stageRelease(admin.id, first.id);
  await AdminDataService.activateRelease(admin.id, first.id, 'PUBLISH');
  assert.match(await getActiveFoodConsumptionContext(), /Rice, well-milled, boiled/);

  const activeRow = await prisma.foodConsumptionStat.findFirstOrThrow({
    where: { releaseId: first.id, foodItemId: rice.id },
  });
  await assert.rejects(
    prisma.foodConsumptionStat.update({ where: { id: activeRow.id }, data: { meanIntakeG: 999 } }),
    /immutable after staging/
  );

  await AdminDataService.createVerifiedAlias(admin.id, { foodItemId: egg.id, alias: 'hard-boiled egg' });
  const alias = await prisma.foodAlias.findUniqueOrThrow({ where: { normalizedAlias: 'hard boiled egg' } });
  assert.equal(alias.foodItemId, egg.id);
  assert.ok(alias.verifiedAt);

  const second = await createRelease('acceptance-v2');
  await AdminDataService.importConsumptionCsv(
    admin.id,
    second.id,
    [
      'population_group,geography_level,food_name,region_code,region_name,province_huc_code,province_huc_name,place_type,rank,percent_consuming,mean_intake_g,sample_size',
      'Adults 19-59,NATIONAL,hard-boiled egg,,,,,,1,50,40,5000',
    ].join('\n')
  );
  await AdminDataService.stageRelease(admin.id, second.id);
  await AdminDataService.activateRelease(admin.id, second.id, 'PUBLISH');
  assert.equal((await prisma.referenceDataRelease.findUniqueOrThrow({ where: { id: first.id } })).status, 'RETIRED');
  await AdminDataService.activateRelease(admin.id, first.id, 'ROLLBACK');

  const [activeReleases, activations, audits] = await Promise.all([
    prisma.referenceDataRelease.count({ where: { sourceId: source.id, status: 'ACTIVE' } }),
    prisma.referenceDataReleaseActivation.count(),
    prisma.auditEvent.count({ where: { actorUserId: admin.id } }),
  ]);
  assert.equal(activeReleases, 1);
  assert.equal(activations, 3);
  assert.ok(audits >= 10);
  console.log(
    JSON.stringify({
      outcome: 'PASS',
      releases: 2,
      activations,
      audits,
      immutableActiveRows: true,
      activeContext: true,
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
