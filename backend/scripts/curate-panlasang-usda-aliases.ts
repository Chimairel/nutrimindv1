import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeFoodName } from '../src/domain/fnri-match.policy';
import { USDA_FDC_SOURCE } from '../src/domain/usda-food-composition.policy';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const CURATED_ALIASES = [
  { alias: 'garlic powder', sourceRecordId: '171325', expectedName: 'Spices, garlic powder' },
  { alias: 'ground white pepper', sourceRecordId: '170933', expectedName: 'Spices, pepper, white' },
  { alias: 'salt', sourceRecordId: '173468', expectedName: 'Salt, table' },
] as const;

async function main() {
  const [foods, aliases] = await Promise.all([
    prisma.foodItem.findMany({
      where: { source: USDA_FDC_SOURCE, sourceRecordId: { in: CURATED_ALIASES.map((entry) => entry.sourceRecordId) } },
      select: { id: true, name: true, sourceRecordId: true },
    }),
    prisma.foodAlias.findMany({
      select: { id: true, alias: true, normalizedAlias: true, foodItemId: true, verifiedAt: true },
    }),
  ]);
  const byRecord = new Map(foods.map((food) => [food.sourceRecordId, food]));
  const changes = CURATED_ALIASES.map((entry) => {
    const food = byRecord.get(entry.sourceRecordId);
    if (!food || food.name !== entry.expectedName) throw new Error(`USDA catalogue mismatch for ${entry.alias}`);
    const normalizedAlias = normalizeFoodName(entry.alias);
    const collisions = aliases.filter(
      (alias) => alias.normalizedAlias === normalizedAlias || normalizeFoodName(alias.alias) === normalizedAlias
    );
    if (collisions.length > 1 || (collisions[0]?.verifiedAt && collisions[0].foodItemId !== food.id)) {
      throw new Error(`Conflicting alias requires administrator review: ${entry.alias}`);
    }
    return {
      alias: entry.alias,
      normalizedAlias,
      foodItemId: food.id,
      sourceRecordId: entry.sourceRecordId,
      existingId: collisions[0]?.id ?? null,
      previousFoodItemId: collisions[0]?.foodItemId ?? null,
      status: collisions[0]?.verifiedAt ? 'ALREADY_CURATED' : collisions[0] ? 'CORRECT_LEGACY' : 'CREATE',
    };
  });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changes }, null, 2));
  if (!apply) return;
  await prisma.$transaction(
    async (tx) => {
      for (const entry of changes) {
        if (entry.status === 'ALREADY_CURATED') continue;
        const alias = entry.existingId
          ? await tx.foodAlias.update({
              where: { id: entry.existingId },
              data: {
                normalizedAlias: entry.normalizedAlias,
                foodItemId: entry.foodItemId,
                verifiedAt: new Date(),
                verifiedByAdminId: null,
              },
            })
          : await tx.foodAlias.create({
              data: {
                alias: entry.alias,
                normalizedAlias: entry.normalizedAlias,
                foodItemId: entry.foodItemId,
                verifiedAt: new Date(),
              },
            });
        await tx.auditEvent.create({
          data: {
            action: 'PANLASANG_USDA_ALIAS_CURATED',
            entityType: 'FoodAlias',
            entityId: alias.id,
            metadata: {
              alias: entry.alias,
              foodItemId: entry.foodItemId,
              sourceRecordId: entry.sourceRecordId,
              previousFoodItemId: entry.previousFoodItemId,
              source: USDA_FDC_SOURCE,
            } as Prisma.InputJsonValue,
          },
        });
      }
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
