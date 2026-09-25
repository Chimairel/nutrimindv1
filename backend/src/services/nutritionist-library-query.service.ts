import { MealLibraryStatus, MealType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';

export interface NutritionistLibraryFilters {
  search?: string;
  mealType?: string;
  conditionTag?: string;
  status?: string;
  verifiedByMe?: boolean;
  adminDraftsOnly?: boolean;
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
  if (filters.mealType && filters.mealType !== 'All') {
    where.applicableMealTypes = { some: { mealType: filters.mealType as MealType } };
  }
  if (filters.conditionTag && filters.conditionTag !== 'All') {
    where.suitableConditions = { array_contains: filters.conditionTag };
  }
  if (filters.status && filters.status !== 'All') where.status = filters.status as MealLibraryStatus;
  if (filters.verifiedByMe) where.verifiedByNutritionist = { userId: currentUserId };
  if (filters.adminDraftsOnly) {
    where.status = MealLibraryStatus.APPROVED;
    where.safetyEvidenceStatus = 'INCOMPLETE';
    where.safetyReviews = { some: { reasonCode: 'ADMIN_AUTHORED_DRAFT' } };
  }

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
        safetyReviews: {
          where: { reasonCode: 'ADMIN_AUTHORED_DRAFT' },
          select: { id: true, reasonCode: true, evidenceSnapshot: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        safetyReviewedByNutritionist: { include: { user: { select: { name: true } } } },
        applicableMealTypes: { orderBy: { mealType: 'asc' } },
      },
    }),
  ]);

  return { total, page, limit, meals };
}
