import { DietaryPreference, MealType, type Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type {
  CandidatePage,
  RecipeCandidateProjection,
  RecipeCandidateProvider,
  RecipeCandidateProvenance,
} from './recipe-candidate-provider';

type Row = Prisma.RawRecipeCandidateGetPayload<{ include: { applicableMealTypes: true } }>;

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ingredients(value: Prisma.JsonValue): RecipeCandidateProjection['ingredients'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) return [];
    const quantity =
      typeof record.quantity === 'number' && Number.isFinite(record.quantity) && record.quantity > 0
        ? record.quantity
        : undefined;
    const unit = typeof record.unit === 'string' && record.unit.trim() ? record.unit.trim() : undefined;
    return [{ name, quantity, unit }];
  });
}

function encodeCursor(row: Pick<Row, 'normalizedName' | 'id'>): string {
  return Buffer.from(JSON.stringify({ normalizedName: row.normalizedName, id: row.id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): { normalizedName: string; id: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof value.normalizedName === 'string' && typeof value.id === 'string'
      ? { normalizedName: value.normalizedName, id: value.id }
      : null;
  } catch {
    throw new Error('Invalid candidate cursor.');
  }
}

function project(row: Row): RecipeCandidateProjection {
  const parsedIngredients = ingredients(row.ingredients);
  const nutrition =
    row.calories === null || row.proteinG === null || row.carbsG === null || row.fatG === null
      ? null
      : { calories: row.calories, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG };
  return {
    id: row.id,
    providerRecordId: row.sourceRecordId,
    provenance: row.sourceName === 'USER_OBSERVED' ? 'USER_OBSERVED' : 'PANLASANG_PINOY',
    displayName: row.recipeName,
    normalizedName: row.normalizedName,
    category: row.category,
    description: row.description,
    contentSignature: row.contentSignature,
    sourceUrl: row.sourceUrl,
    applicableMealTypes: row.applicableMealTypes.map((entry) => entry.mealType),
    dietaryTags: jsonStrings(row.dietaryTags).filter((tag): tag is DietaryPreference =>
      Object.values(DietaryPreference).includes(tag as DietaryPreference)
    ),
    ingredients: parsedIngredients,
    ingredientsComplete: parsedIngredients.length > 0 && parsedIngredients.every((item) => item.quantity !== undefined),
    nutrition,
    servingDescription: row.originalServings ? `Original recipe yields ${row.originalServings} servings` : null,
    riceRole: row.riceRole,
    imageUrl: row.sourceImageUrl,
    videoUrl: row.sourceVideoUrl,
    state: row.status === 'AVAILABLE' ? 'ACTIVE' : 'RETIRED',
  };
}

export class DatabaseRecipeCandidateProvider implements RecipeCandidateProvider {
  readonly provenance = 'MIXED_CORPUS' as const;

  async list(input: {
    sourceKind?: RecipeCandidateProvenance;
    recentFirst?: boolean;
    mealType?: MealType;
    dietaryPreference?: DietaryPreference;
    search?: string;
    calorieMinimum?: number;
    calorieMaximum?: number;
    excludeIds?: readonly string[];
    cursor?: string;
    limit: number;
  }): Promise<CandidatePage> {
    const limit = Math.max(1, Math.min(input.limit, 120));
    const cursor = decodeCursor(input.cursor);
    const rows = await prisma.rawRecipeCandidate.findMany({
      where: {
        status: 'AVAILABLE',
        sourceName: input.sourceKind ?? { in: ['PANLASANG_PINOY', 'USER_OBSERVED'] },
        ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
        ...(input.dietaryPreference ? { dietaryTags: { array_contains: [input.dietaryPreference] } } : {}),
        ...(input.search ? { recipeName: { contains: input.search, mode: 'insensitive' } } : {}),
        ...(input.calorieMinimum !== undefined || input.calorieMaximum !== undefined
          ? { calories: { gte: input.calorieMinimum, lte: input.calorieMaximum } }
          : {}),
        ...(input.excludeIds?.length ? { id: { notIn: [...input.excludeIds] } } : {}),
        ...(cursor
          ? {
              OR: [
                { normalizedName: { gt: cursor.normalizedName } },
                { normalizedName: cursor.normalizedName, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { applicableMealTypes: { orderBy: { mealType: 'asc' } } },
      orderBy: input.recentFirst && !input.cursor
        ? [{ indexedAt: 'desc' }, { id: 'asc' }]
        : [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map(project),
      nextCursor: !input.recentFirst && hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
    };
  }
}

export const databaseRecipeCandidateProvider = new DatabaseRecipeCandidateProvider();
export const panlasangRecipeCandidateProvider = databaseRecipeCandidateProvider;
