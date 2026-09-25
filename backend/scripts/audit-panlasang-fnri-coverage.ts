import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  createSourceIngredientFnriMatcher,
  isInvalidSourceIngredientLabel,
  normalizeSourceIngredientName,
} from '../src/domain/source-ingredient-fnri-match.policy';

const prisma = new PrismaClient();

async function main() {
  const [foods, aliases, recipes] = await Promise.all([
    prisma.foodItem.findMany({ where: { source: 'FNRI' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.foodAlias.findMany({
      where: { verifiedAt: { not: null }, foodItem: { source: 'FNRI' } },
      select: { alias: true, foodItemId: true, verifiedAt: true },
    }),
    prisma.rawRecipeCandidate.findMany({
      where: { sourceName: 'PANLASANG_PINOY' },
      select: { ingredients: true },
    }),
  ]);
  const matcher = createSourceIngredientFnriMatcher(foods, aliases);
  const unresolved = new Map<string, { count: number; examples: Set<string> }>();
  let occurrences = 0;
  let matched = 0;
  let invalid = 0;
  for (const recipe of recipes) {
    const ingredients = recipe.ingredients as Prisma.JsonValue;
    if (!Array.isArray(ingredients)) continue;
    for (const item of ingredients) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      occurrences += 1;
      if (matcher.match(name)) {
        matched += 1;
      } else if (isInvalidSourceIngredientLabel(name)) {
        invalid += 1;
      } else {
        const normalized = normalizeSourceIngredientName(name);
        const entry = unresolved.get(normalized) ?? { count: 0, examples: new Set<string>() };
        entry.count += 1;
        if (entry.examples.size < 3) entry.examples.add(name);
        unresolved.set(normalized, entry);
      }
    }
  }
  const entries = [...unresolved.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .map(([name, entry]) => ({ name, count: entry.count, examples: [...entry.examples] }));
  const all = process.argv.includes('--all');
  console.log(
    JSON.stringify(
      {
        recipes: recipes.length,
        occurrences,
        matched,
        invalid,
        unresolvedOccurrences: occurrences - matched - invalid,
        unresolvedNames: entries.length,
        entries: all ? entries : entries.slice(0, 180),
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
  .finally(async () => prisma.$disconnect());
