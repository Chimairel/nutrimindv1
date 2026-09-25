import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { USDA_FDC_SOURCE } from '@/domain/usda-food-composition.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const FILE = path.resolve('prisma/data/usda-fdc-catalogue.json');

interface CatalogueRecord {
  fdcId: number;
  name: string;
  dataType: string;
  dataset: string;
  publishedAt: string;
  sourceUrl: string;
  category: string | null;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiber: number | null;
  sodium: number | null;
  potassium: number | null;
  calcium: number | null;
  iron: number | null;
  vitaminA: number | null;
  vitaminC: number | null;
}

function validate(record: CatalogueRecord): void {
  if (!Number.isSafeInteger(record.fdcId) || record.fdcId <= 0 || !record.name || !record.dataset) {
    throw new Error('Invalid USDA catalogue identity.');
  }
  if (
    ![record.calories, record.proteinG, record.fatG, record.carbsG].every(
      (value) => Number.isFinite(value) && value >= 0
    )
  ) {
    throw new Error(`Missing USDA macro evidence for FDC ${record.fdcId}.`);
  }
  if (Number.isNaN(Date.parse(record.publishedAt)) || !record.sourceUrl.startsWith('https://fdc.nal.usda.gov/')) {
    throw new Error(`Invalid USDA provenance for FDC ${record.fdcId}.`);
  }
}

async function main() {
  const file = JSON.parse(await readFile(FILE, 'utf8')) as { records: CatalogueRecord[] };
  if (!Array.isArray(file.records)) throw new Error('Invalid USDA catalogue.');
  const ids = new Set<number>();
  for (const record of file.records) {
    validate(record);
    if (ids.has(record.fdcId)) throw new Error(`Duplicate FDC ID ${record.fdcId}.`);
    ids.add(record.fdcId);
  }
  const existing = await prisma.foodItem.count({ where: { source: USDA_FDC_SOURCE } });
  console.log(
    JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', catalogueRecords: ids.size, existingUsdaFoods: existing })
  );
  if (!APPLY) return;
  let created = 0;
  for (let offset = 0; offset < file.records.length; offset += 100) {
    const batch = file.records.slice(offset, offset + 100);
    const result = await prisma.foodItem.createMany({
      data: batch.map((record) => ({
        id: `USDA_FDC_${record.fdcId}`,
        name: record.name,
        category: record.category,
        source: USDA_FDC_SOURCE,
        sourceRecordId: String(record.fdcId),
        sourceReferenceUrl: record.sourceUrl,
        sourceDataset: record.dataset,
        sourcePublishedAt: new Date(record.publishedAt),
        calories: record.calories,
        proteinG: record.proteinG,
        fatG: record.fatG,
        carbsG: record.carbsG,
        fiber: record.fiber,
        sodium: record.sodium,
        potassium: record.potassium,
        calcium: record.calcium,
        iron: record.iron,
        vitaminA: record.vitaminA,
        vitaminC: record.vitaminC,
      })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  await prisma.auditEvent.create({
    data: {
      action: 'USDA_FDC_CATALOGUE_IMPORTED',
      entityType: 'FoodItem',
      metadata: { source: USDA_FDC_SOURCE, catalogueRecords: ids.size, created },
    },
  });
  console.log(
    JSON.stringify({ created, totalUsdaFoods: await prisma.foodItem.count({ where: { source: USDA_FDC_SOURCE } }) })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
