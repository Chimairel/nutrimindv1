import prisma from '@/lib/prisma';

export class AdminService {
  /**
   * Returns all users with pagination and search.
   */
  static async getUsers(page = 1, limit = 20, search?: string) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          onboardingDone: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Returns all nutritionist profiles (pending first).
   */
  static async getNutritionists() {
    return prisma.nutritionistProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ isVerified: 'asc' }, { userId: 'asc' }],
    });
  }

  /**
   * Verifies a nutritionist by admin.
   */
  static async verifyNutritionist(adminUserId: string, nutritionistProfileId: string) {
    const profile = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
    });

    if (!profile) throw new Error('Nutritionist profile not found.');
    if (profile.isVerified) throw new Error('Nutritionist is already verified.');

    // Update the nutritionist profile
    await prisma.nutritionistProfile.update({
      where: { id: nutritionistProfileId },
      data: {
        isVerified: true,
        verifiedByAdminId: adminUserId,
        verifiedAt: new Date(),
      },
    });

    // Update the user's role to NUTRITIONIST
    await prisma.user.update({
      where: { id: profile.userId },
      data: { role: 'NUTRITIONIST' },
    });

    return { success: true };
  }

  /**
   * Returns aggregate platform analytics.
   */
  static async getAnalytics() {
    const [
      totalUsers,
      totalNutritionists,
      verifiedNutritionists,
      activeMealPlans,
      pendingReviews,
      libraryCount,
      totalMealLogs,
      totalFoodItems,
      totalAliases,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.nutritionistProfile.count(),
      prisma.nutritionistProfile.count({ where: { isVerified: true } }),
      prisma.mealPlan.count({ where: { status: 'APPROVED' } }),
      prisma.mealPlan.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.mealLibrary.count(),
      prisma.mealLog.count(),
      prisma.foodItem.count(),
      prisma.foodAlias.count(),
    ]);

    return {
      totalUsers,
      totalNutritionists,
      verifiedNutritionists,
      activeMealPlans,
      pendingReviews,
      libraryCount,
      totalMealLogs,
      totalFoodItems,
      totalAliases,
    };
  }
}
