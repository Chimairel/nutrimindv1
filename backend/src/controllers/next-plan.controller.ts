import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import prisma from '@/lib/prisma';
import { resolveUserBillingEntitlement } from '@/services/user-entitlement-reader.service';
import { MealGenerationService } from '@/services/meal-generation.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

export async function generateNextPlan(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const entitlement = await resolveUserBillingEntitlement(prisma, userId, new Date());
    if (entitlement.tier !== 'PREMIUM')
      return res.status(403).json({ success: false, error: 'Next-week planning requires Premium.' });
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const planGroupId = await MealGenerationService.generateNextWeeklyPlan(userId, profile);
    return res.json({ success: true, data: { planGroupId } });
  } catch (error) {
    return res
      .status(409)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Could not prepare next week. Please retry.') });
  }
}
