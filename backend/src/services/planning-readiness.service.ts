import prisma from '@/lib/prisma';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { determinePlanningReadiness, type PlanningReadiness } from '@/domain/planning-readiness.policy';

export class PlanningReadinessService {
  static async getForUser(userId: string): Promise<PlanningReadiness> {
    const [requirements, context] = await Promise.all([
      ClinicalEvidenceService.requirementsForUser(userId),
      loadUserNutritionContext(prisma, userId, 'Complete your health profile before requesting a meal plan.'),
    ]);

    return determinePlanningReadiness({
      requirements,
      restrictionsRequireReview: context.safetyRestrictions.requiresReview,
      conditions: context.conditions,
    });
  }
}
