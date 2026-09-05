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
          isSuspended: true,
          suspendedAt: true,
          suspensionReason: true,
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
    if (profile.prcLicenseExpiry < new Date()) {
      throw new Error('An expired PRC license cannot be verified. Update and re-check the credential first.');
    }

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

  static async setUserSuspension(
    adminUserId: string,
    targetUserId: string,
    suspended: boolean,
    reason?: string
  ) {
    if (adminUserId === targetUserId) throw new Error('Administrators cannot suspend their own active account.');
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error('User not found.');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          isSuspended: suspended,
          suspendedAt: suspended ? new Date() : null,
          suspensionReason: suspended ? reason?.trim() || 'Administrative safety action' : null,
        },
        select: { id: true, isSuspended: true, suspendedAt: true, suspensionReason: true },
      });
      if (suspended) await tx.session.deleteMany({ where: { userId: targetUserId } });
      await tx.auditEvent.create({
        data: {
          actorUserId: adminUserId,
          action: suspended ? 'USER_SUSPENDED' : 'USER_REINSTATED',
          entityType: 'User',
          entityId: targetUserId,
          metadata: { reason: updated.suspensionReason },
        },
      });
      return updated;
    });
  }

  static async getAuditEvents(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: { actorUser: { select: { name: true, email: true, role: true } } },
      }),
      prisma.auditEvent.count(),
    ]);
    return { events, total, page: safePage, totalPages: Math.ceil(total / safeLimit) };
  }

  static async getSafetyIncidents() {
    return prisma.mealLibraryFlag.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        mealLibrary: { select: { id: true, mealName: true, status: true, safetyEvidenceStatus: true } },
        flaggedByNutritionist: { include: { user: { select: { name: true } } } },
      },
    });
  }

  static async getStructuredSafetyOperations() {
    const reviewStates = ['RECOGNIZED_UNSUPPORTED', 'NEEDS_CLARIFICATION', 'PENDING_REVIEW', 'INVALID'] as const;
    const [groupedEntries, reviewUsers] = await Promise.all([
      prisma.safetyProfileEntry.groupBy({
        by: ['domain', 'supportState'],
        _count: { _all: true },
        orderBy: [{ domain: 'asc' }, { supportState: 'asc' }],
      }),
      prisma.safetyProfileEntry.findMany({
        where: { supportState: { in: [...reviewStates] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);
    return {
      usersRequiringReview: reviewUsers.length,
      entries: groupedEntries.map((row) => ({
        domain: row.domain,
        supportState: row.supportState,
        count: row._count._all,
      })),
    };
  }

  /**
   * Returns aggregate platform analytics.
   */
  static async getAnalytics() {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inFortyEightHours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
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
      overdueReviews,
      activeReviewClaims,
      expiredVerifiedNutritionists,
      completeLibraryEvidence,
      incompleteLibraryEvidence,
      staleLibraryEvidence,
      failedGenerationJobs24h,
      stuckGenerationJobs,
      aiSuccess24h,
      aiFailures24h,
      adaptationReviews30d,
      pendingPlansStartingSoon,
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
      prisma.mealPlan.count({ where: { status: 'PENDING_REVIEW', createdAt: { lt: twoHoursAgo } } }),
      prisma.mealPlan.count({
        where: {
          status: 'PENDING_REVIEW',
          claimedByNutritionistId: { not: null },
          claimedAt: { gte: thirtyMinutesAgo },
        },
      }),
      prisma.nutritionistProfile.count({ where: { isVerified: true, prcLicenseExpiry: { lt: now } } }),
      prisma.mealLibrary.count({ where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE' } }),
      prisma.mealLibrary.count({ where: { safetyEvidenceStatus: 'INCOMPLETE' } }),
      prisma.mealLibrary.count({ where: { safetyEvidenceStatus: 'STALE' } }),
      prisma.mealPlanGenerationJob.count({ where: { status: 'FAILED', updatedAt: { gte: twentyFourHoursAgo } } }),
      prisma.mealPlanGenerationJob.count({ where: { status: 'GENERATING', updatedAt: { lt: twentyMinutesAgo } } }),
      prisma.aiUsageEvent.count({ where: { status: 'SUCCESS', createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.aiUsageEvent.count({ where: { status: 'FAILED', createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.weeklyCheckin.count({ where: { adaptationState: 'REVIEW_RECOMMENDED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.mealPlan.count({
        where: {
          status: 'PENDING_REVIEW',
          scheduledDate: { gte: now, lte: inFortyEightHours },
        },
      }),
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
      overdueReviews,
      activeReviewClaims,
      expiredVerifiedNutritionists,
      completeLibraryEvidence,
      incompleteLibraryEvidence,
      staleLibraryEvidence,
      failedGenerationJobs24h,
      stuckGenerationJobs,
      aiSuccess24h,
      aiFailures24h,
      adaptationReviews30d,
      pendingPlansStartingSoon,
    };
  }
}
