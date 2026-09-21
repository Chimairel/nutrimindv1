import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ConsumptionGeographyLevel,
  ConsumptionMappingStatus,
  Prisma,
  ReferenceDataActivationAction,
  ReferenceDataDomain,
  ReferenceDataReleaseStatus,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseCsv } from '@/domain/psa-openstat-price-ingestion';
import { ENNS_FOOD_GROUPS } from '@/domain/enns-food-group.policy';

const APPLY = process.argv.includes('--apply');
const SOURCE_CODE = 'FNRI_ENNS_IFCS';
const VERSION_LABEL = '2018-2019-2021_FOOD_GROUP_LOCALITY_V1';
const AGGREGATE_FILE = path.resolve(
  process.cwd(),
  'data/enns/2018-2019-2021-dietary-individual/derived/enns-food-group-locality-v1.csv'
);

function required(row: Record<string, string>, key: string): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Aggregate row is missing ${key}.`);
  return value;
}

function optional(row: Record<string, string>, key: string): string | null {
  return row[key]?.trim() || null;
}

function numeric(row: Record<string, string>, key: string): number {
  const value = Number(required(row, key));
  if (!Number.isFinite(value)) throw new Error(`Aggregate row has invalid ${key}.`);
  return value;
}

function parseAggregate(content: string): Prisma.FoodConsumptionStatCreateManyInput[] {
  const rows = parseCsv(content);
  const header = rows[0];
  if (!header?.length) throw new Error('Aggregate CSV is empty.');
  const objects = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
  const knownGroups = new Set<string>(ENNS_FOOD_GROUPS.map(({ code }) => code));
  const seen = new Set<string>();
  const parsed = objects.map((row) => {
    const sourceRowKey = required(row, 'source_row_key');
    if (seen.has(sourceRowKey)) throw new Error(`Duplicate aggregate key ${sourceRowKey}.`);
    seen.add(sourceRowKey);
    const geographyLevel = required(row, 'geography_level') as ConsumptionGeographyLevel;
    if (!Object.values(ConsumptionGeographyLevel).includes(geographyLevel)) {
      throw new Error(`Unsupported geography level ${geographyLevel}.`);
    }
    const foodGroupCode = required(row, 'food_group_code');
    if (!knownGroups.has(foodGroupCode)) throw new Error(`Unknown ENNS food group ${foodGroupCode}.`);
    const percentConsuming = numeric(row, 'percent_consuming');
    const meanIntakeG = numeric(row, 'mean_intake_g');
    const relativeToNational = numeric(row, 'relative_to_national');
    if (percentConsuming < 0 || percentConsuming > 100 || meanIntakeG < 0 || relativeToNational <= 0) {
      throw new Error(`Aggregate ${sourceRowKey} contains an out-of-range estimate.`);
    }
    return {
      releaseId: '',
      sourceRowKey,
      populationGroup: required(row, 'population_group'),
      geographyLevel,
      regionCode: null,
      regionName: optional(row, 'region_name'),
      provinceHucCode: optional(row, 'province_huc_code'),
      provinceHucName: optional(row, 'province_huc_name'),
      placeType: optional(row, 'place_type'),
      foodNameRaw: required(row, 'food_name'),
      foodGroupCode,
      sourceVariable: required(row, 'source_variable'),
      foodItemId: null,
      mappingStatus: ConsumptionMappingStatus.UNMAPPED,
      rank: Math.trunc(numeric(row, 'rank')),
      percentConsuming,
      meanIntakeG,
      sampleSize: Math.trunc(numeric(row, 'sample_size')),
      weightedPopulation: numeric(row, 'weighted_population'),
      relativeToNational,
      surveyYears: required(row, 'survey_years'),
    };
  });
  const scopeCount = new Set(parsed.map((row) => `${row.geographyLevel}:${row.regionName ?? ''}:${row.provinceHucName ?? ''}`)).size;
  if (parsed.length !== 2_620 || scopeCount !== 131) {
    throw new Error(`Expected 2,620 rows across 131 scopes; found ${parsed.length} rows across ${scopeCount} scopes.`);
  }
  return parsed;
}

async function main() {
  if (!fs.existsSync(AGGREGATE_FILE)) throw new Error('Run enns:derive-locality before importing the release.');
  const content = fs.readFileSync(AGGREGATE_FILE, 'utf8');
  const contentSha256 = createHash('sha256').update(content).digest('hex');
  const rows = parseAggregate(content);
  const summary = {
    apply: APPLY,
    sourceCode: SOURCE_CODE,
    versionLabel: VERSION_LABEL,
    contentSha256,
    rows: rows.length,
    nationalRows: rows.filter((row) => row.geographyLevel === 'NATIONAL').length,
    regionalRows: rows.filter((row) => row.geographyLevel === 'REGION').length,
    provinceHucRows: rows.filter((row) => row.geographyLevel === 'PROVINCE_HUC').length,
  };
  if (!APPLY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('An administrator account is required to publish reference data.');
  const source = await prisma.referenceDataSource.upsert({
    where: { code: SOURCE_CODE },
    create: {
      code: SOURCE_CODE,
      name: 'Expanded National Nutrition Survey — Individual Food Consumption',
      agencyName: 'DOST-FNRI',
      domain: ReferenceDataDomain.FOOD_CONSUMPTION,
      homepageUrl: 'https://enutrition.fnri.dost.gov.ph/puf-preview.php?xx=2018748',
      termsUrl: 'https://enutrition.fnri.dost.gov.ph/puf.php?year=2018',
      attributionText: '2018, 2019, and 2021 ENNS Individual Food Consumption Survey, DOST-FNRI',
      updateCadence: 'Per official ENNS public-use release',
    },
    update: { isEnabled: true },
  });
  const existing = await prisma.referenceDataRelease.findUnique({
    where: { sourceId_versionLabel: { sourceId: source.id, versionLabel: VERSION_LABEL } },
  });
  if (existing?.status === ReferenceDataReleaseStatus.ACTIVE) {
    if (existing.contentSha256 !== contentSha256) {
      throw new Error('The active release has the same version label but a different fingerprint. Create a new version.');
    }
    console.log(JSON.stringify({ ...summary, releaseId: existing.id, noOp: true }, null, 2));
    return;
  }
  if (existing?.status === ReferenceDataReleaseStatus.RETIRED) {
    throw new Error('A retired release is immutable. Create a new version or use the governed rollback flow.');
  }

  const previousActive = await prisma.referenceDataRelease.findFirst({
    where: { sourceId: source.id, status: ReferenceDataReleaseStatus.ACTIVE },
    orderBy: { activatedAt: 'desc' },
  });
  const release = await prisma.$transaction(
    async (tx) => {
      const current = existing
        ? await tx.referenceDataRelease.update({
            where: { id: existing.id },
            data: {
              sourceUrl: 'https://enutrition.fnri.dost.gov.ph/puf-preview.php?xx=2018748',
              retrievedAt: new Date('2026-09-21T00:00:00.000Z'),
              contentSha256,
              notes: 'Weighted food-group aggregates derived locally; respondent records are excluded from the database.',
              status: ReferenceDataReleaseStatus.DRAFT,
            },
          })
        : await tx.referenceDataRelease.create({
            data: {
              sourceId: source.id,
              versionLabel: VERSION_LABEL,
              sourceUrl: 'https://enutrition.fnri.dost.gov.ph/puf-preview.php?xx=2018748',
              retrievedAt: new Date('2026-09-21T00:00:00.000Z'),
              contentSha256,
              notes: 'Weighted food-group aggregates derived locally; respondent records are excluded from the database.',
              createdByAdminId: admin.id,
            },
          });
      await tx.foodConsumptionStat.deleteMany({ where: { releaseId: current.id } });
      await tx.foodConsumptionStat.createMany({ data: rows.map((row) => ({ ...row, releaseId: current.id })) });
      if (previousActive && previousActive.id !== current.id) {
        await tx.referenceDataRelease.update({
          where: { id: previousActive.id },
          data: { status: ReferenceDataReleaseStatus.RETIRED, retiredAt: new Date() },
        });
      }
      const active = await tx.referenceDataRelease.update({
        where: { id: current.id },
        data: {
          status: ReferenceDataReleaseStatus.ACTIVE,
          activatedByAdminId: admin.id,
          activatedAt: new Date(),
          retiredAt: null,
        },
      });
      await tx.referenceDataReleaseActivation.create({
        data: {
          releaseId: active.id,
          replacedReleaseId: previousActive?.id === active.id ? null : previousActive?.id,
          actorAdminId: admin.id,
          action: ReferenceDataActivationAction.PUBLISH,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: admin.id,
          action: 'FNRI_ENNS_LOCALITY_RELEASE_PUBLISHED',
          entityType: 'ReferenceDataRelease',
          entityId: active.id,
          metadata: { contentSha256, aggregateRows: rows.length, respondentRowsPersisted: 0 },
        },
      });
      return active;
    },
    { maxWait: 20_000, timeout: 120_000 }
  );

  console.log(JSON.stringify({ ...summary, releaseId: release.id, noOp: false }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
