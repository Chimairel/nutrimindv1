import prisma from '@/lib/prisma';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { NutritionistProfileWorkService } from '@/services/nutritionist-profile-work.service';
import { NutritionistService } from '@/services/nutritionist.service';

/** Counts the work shown in review workspaces and the separate Audit page. */
export class NutritionistWorkCountsService {
  static async get(nutritionistProfileId: string) {
    const [mealVerifications, caseReviews, profiles, outside, dueAudit, dueProfileApprovals] = await Promise.all([
      MealBaseVerificationService.count(),
      NutritionistService.getReviewQueueCount(nutritionistProfileId),
      NutritionistProfileWorkService.queue(nutritionistProfileId),
      prisma.outsideMealReview.count({
        where: {
          requestedByUserAt: { not: null },
          status: { in: ['PENDING', 'CLAIMED'] },
          outsideMealLogItem: { mealLog: { status: 'DONE' } },
        },
      }),
      prisma.mealConditionClearance.count({
        where: {
          state: { in: ['REVIEW_DUE', 'SUSPENDED'] },
        },
      }),
      prisma.mealLibraryProfileApproval.count({
        where: {
          flaggedAt: { not: null },
        },
      }),
    ]);
    return {
      meal: mealVerifications,
      case: caseReviews + outside,
      profile: profiles.reduce((total, person) => total + (person.profileStatus ? 1 : 0) + person.documentCount, 0),
      audit: dueAudit + dueProfileApprovals,
    };
  }
}
