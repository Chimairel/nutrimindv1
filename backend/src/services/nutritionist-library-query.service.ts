import { MealLibraryStatus, MealType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';

export interface NutritionistLibraryFilters {
  search?: string;
  mealType?: string;
  conditionTag?: string;
  status?: string;
  verifiedByMe?: boolean;
  page?: number;
  limit?: number;
}

export function getNutritionistMealLibrary(limit = 50) {
  return prisma.mealLibrary.findMany({
    orderBy: { usageCount: 'desc' },
    take: limit,
    include: { verifiedByNutritionist: { select: { userId: true } } },
  });
}

export async function getNutritionistMealLibraryWithFilters(
  currentUserId: string,
  filters: NutritionistLibraryFilters
) {
  const { page, limit } = normalizePagination(filters.page, filters.limit, 20);
  const skip = (page - 1) * limit;
  const search = normalizeSearch(filters.search);
  const where: Prisma.MealLibraryWhereInput = {};

  if (search) where.mealName = { contains: search, mode: 'insensitive' };
  if (filters.mealType && filters.mealType !== 'All') where.mealType = filters.mealType as MealType;
  if (filters.conditionTag && filters.conditionTag !== 'All') {
    where.suitableConditions = { array_contains: filters.conditionTag };
  }
  if (filters.status && filters.status !== 'All') where.status = filters.status as MealLibraryStatus;
  if (filters.verifiedByMe) where.verifiedByNutritionist = { userId: currentUserId };

  const [total, meals] = await Promise.all([
    prisma.mealLibrary.count({ where }),
    prisma.mealLibrary.findMany({
      where,
      orderBy: { addedAt: 'desc' },
      skip,
      take: limit,
      include: {
        verifiedByNutritionist: { include: { user: { select: { name: true } } } },
        flags: {
          where: { status: 'PENDING' },
          include: { flaggedByNutritionist: { include: { user: { select: { name: true } } } } },
        },
        ingredients: { orderBy: { position: 'asc' } },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  return { total, page, limit, meals };
}
