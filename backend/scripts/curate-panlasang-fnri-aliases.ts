import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { normalizeFoodName } from '../src/domain/fnri-match.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Only recipe labels with one defensible FNRI identity belong here. Raw/cooked
// mismatches, brands, mixtures, oils, and unspecified animal cuts stay unresolved.
const CURATED_ALIASES = [
  { alias: 'okra pods', fnriId: 'D139', foodName: 'Okra' },
  { alias: 'daikon radish', fnriId: 'D183', foodName: 'Radish' },
  { alias: 'malunggay leaves', fnriId: 'D094', foodName: 'Horseradish tree lvs' },
  { alias: 'fresh malunggay leaves', fnriId: 'D094', foodName: 'Horseradish tree lvs' },
  { alias: 'napa cabbage', fnriId: 'D054', foodName: 'Chinese cabbage' },
  { alias: 'chayote', fnriId: 'D050', foodName: 'Chayote fruit' },
  { alias: 'snow peas', fnriId: 'D211', foodName: 'Snow/Sugar pea pod' },
  { alias: 'spaghetti', fnriId: 'A153', foodName: 'Pasta, spaghetti' },
  { alias: 'spaghetti noodles', fnriId: 'A153', foodName: 'Pasta, spaghetti' },
  { alias: 'banana ketchup', fnriId: 'N004', foodName: 'Catsup, banana' },
  { alias: 'tomato ketchup', fnriId: 'N005', foodName: 'Catsup, tomato' },
  { alias: 'chicken wings', fnriId: 'F109', foodName: 'Chicken wing' },
  { alias: 'flat leaf parsley', fnriId: 'D159', foodName: 'Parsley lvs' },
  { alias: 'boneless chicken breast', fnriId: 'F093', foodName: 'Chicken breast' },
  { alias: 'baking potatoes', fnriId: 'B007', foodName: 'Potato' },
  { alias: 'pechay leaves', fnriId: 'D160', foodName: 'Pechay lvs' },
  { alias: 'kangkong leaves', fnriId: 'D242', foodName: 'Swamp cabbage lvs' },
  { alias: 'ripe tomato', fnriId: 'D257', foodName: 'Tomato' },
  { alias: 'cilantro', fnriId: 'D060', foodName: 'Coriander lvs' },
  { alias: 'lumpia wrapper', fnriId: 'A200', foodName: 'Spring roll wrapper, plain' },
  { alias: 'jicama', fnriId: 'D260', foodName: 'Yam bean' },
  { alias: 'misua', fnriId: 'A144', foodName: 'Noodles, wheat, thin' },
  { alias: 'sotanghon', fnriId: 'A134', foodName: 'Noodles, mung bean starch' },
  { alias: 'talong', fnriId: 'D073', foodName: 'Eggplant' },
  { alias: 'bihon', fnriId: 'A137', foodName: 'Noodles, rice' },
  { alias: 'century egg', fnriId: 'H015', foodName: 'Egg, duck, century' },
  { alias: 'kaong', fnriId: 'E090', foodName: 'Sugar palm' },
  { alias: 'pinipig', fnriId: 'A011', foodName: 'Rice, glutinous, parboiled, flattened' },
  { alias: 'tulingan', fnriId: 'G146', foodName: 'Tuna, frigate' },
  { alias: 'beef cube', fnriId: 'N002', foodName: 'Bouillon cube, beef' },
  { alias: 'gabi', fnriId: 'B015', foodName: 'Taro' },
  { alias: 'sotanghon noodles', fnriId: 'A134', foodName: 'Noodles, mung bean starch' },
  { alias: 'malunggay moringa leaves', fnriId: 'D094', foodName: 'Horseradish tree lvs' },
  { alias: 'miso', fnriId: 'C067', foodName: 'Soybean paste, miso' },
] as const;

const LEGACY_REPAIR = {
  alias: 'malunggay leaves',
  incorrectFoodName: 'Malunggay leaves powder, dry',
  correctFoodName: 'Horseradish tree lvs',
} as const;

function firstTwoCsvColumns(line: string): [string, string] {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      result.push(value.trim());
      value = '';
      if (result.length === 2) break;
    } else value += character;
  }
  if (result.length < 2) result.push(value.trim());
  return [result[0] ?? '', result[1] ?? ''];
}

async function main() {
  const csv = await readFile(path.resolve('prisma/data/fnri.csv'), 'utf8');
  const fnriNames = new Map(csv.split(/\r?\n/u).slice(1).map(firstTwoCsvColumns));
  const [foods, existingAliases] = await Promise.all([
    prisma.foodItem.findMany({ where: { source: 'FNRI' }, select: { id: true, name: true } }),
    prisma.foodAlias.findMany({ select: { id: true, alias: true, foodItemId: true, verifiedAt: true } }),
  ]);
  const foodByName = new Map(foods.map((food) => [food.name, food]));
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const canonicalByNormalizedName = new Map(foods.map((food) => [normalizeFoodName(food.name), food]));
  const aliasesByNormalizedName = new Map<string, (typeof existingAliases)[number][]>();
  for (const alias of existingAliases) {
    const key = normalizeFoodName(alias.alias);
    aliasesByNormalizedName.set(key, [...(aliasesByNormalizedName.get(key) ?? []), alias]);
  }
  const conflicts: string[] = [];
  const changes = CURATED_ALIASES.flatMap((entry) => {
    if (fnriNames.get(entry.fnriId) !== entry.foodName) {
      throw new Error(`FNRI CSV target changed for ${entry.alias}: ${entry.fnriId}`);
    }
    const food = foodByName.get(entry.foodName);
    if (!food) throw new Error(`FNRI target is absent from the catalogue: ${entry.foodName}`);
    const normalizedAlias = normalizeFoodName(entry.alias);
    const canonical = canonicalByNormalizedName.get(normalizedAlias);
    if (canonical) throw new Error(`Alias collides with canonical FNRI food: ${entry.alias}`);
    const collisions = aliasesByNormalizedName.get(normalizedAlias) ?? [];
    const repairLegacyAlias =
      entry.alias === LEGACY_REPAIR.alias &&
      entry.foodName === LEGACY_REPAIR.correctFoodName &&
      collisions.length === 1 &&
      !collisions[0].verifiedAt &&
      foodById.get(collisions[0].foodItemId)?.name === LEGACY_REPAIR.incorrectFoodName;
    if (!repairLegacyAlias && (collisions.length > 1 || collisions.some((alias) => alias.foodItemId !== food.id))) {
      conflicts.push(
        `${entry.alias} -> ${collisions
          .map(
            (alias) =>
              `${foodById.get(alias.foodItemId)?.name ?? alias.foodItemId} (${alias.verifiedAt ? 'verified' : 'legacy'})`
          )
          .join(', ')}`
      );
      return [];
    }
    return [
      {
        ...entry,
        foodItemId: food.id,
        normalizedAlias,
        existingId: collisions[0]?.id ?? null,
        previousFoodItemId: repairLegacyAlias ? collisions[0].foodItemId : null,
        status: repairLegacyAlias
          ? 'CORRECT_LEGACY'
          : collisions[0]?.verifiedAt
            ? 'ALREADY_VERIFIED'
            : collisions[0]
              ? 'VERIFY_EXISTING'
              : 'CREATE',
      },
    ];
  });
  if (conflicts.length) throw new Error(`Alias conflicts require review:\n${conflicts.join('\n')}`);
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', changes }, null, 2));
  if (!APPLY) return;
  await prisma.$transaction(
    async (tx) => {
      for (const entry of changes) {
        if (entry.status === 'ALREADY_VERIFIED') continue;
        const alias = entry.existingId
          ? await tx.foodAlias.update({
              where: { id: entry.existingId },
              data: {
                normalizedAlias: entry.normalizedAlias,
                foodItemId: entry.foodItemId,
                verifiedByAdminId: null,
                verifiedAt: new Date(),
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
            action:
              entry.status === 'CORRECT_LEGACY' ? 'PANLASANG_FNRI_ALIAS_CORRECTED' : 'PANLASANG_FNRI_ALIAS_CURATED',
            entityType: 'FoodAlias',
            entityId: alias.id,
            metadata: {
              alias: entry.alias,
              foodItemId: entry.foodItemId,
              previousFoodItemId: entry.previousFoodItemId,
              fnriCsvId: entry.fnriId,
              source: 'PANLASANG_RECIPE_LABEL_AND_FNRI_CSV',
            },
          },
        });
      }
    },
    { timeout: 60_000 }
  );
  console.log(`Curated ${changes.filter((entry) => entry.status !== 'ALREADY_VERIFIED').length} FNRI aliases.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
