import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { MealGenerationService } from '@/services/meal-generation.service';
import { MealLogService } from '@/services/meal-log.service';
import prisma from '@/lib/prisma';
import { MealPlanStatus, MealLogSource, MealLogDataSource, MealLogStatus } from '@prisma/client';

export class MealsController {
  /**
   * POST /api/user/meals/generate
   * Triggers the 7-day plan generation.
   */
  static async generateMealPlan(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      console.log(`[MealsController] Starting meal plan generation for user: ${userId}`);
      const planGroupId = await MealGenerationService.generate7DayPlan(userId);

      // Fetch and return the newly generated meals
      const meals = await prisma.mealPlan.findMany({
        where: { planGroupId },
        include: { ingredients: true },
        orderBy: { scheduledDate: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: {
          planGroupId,
          meals,
        },
      });
    } catch (error: any) {
      console.error('[MealsController] generateMealPlan error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate your personalized meal plan.',
      });
    }
  }

  /**
   * GET /api/user/meals/current
   * Returns current active plan meals grouped by date.
   */
  static async getCurrentPlan(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      // Find the latest non-cancelled plan group
      const latestPlan = await prisma.mealPlan.findFirst({
        where: {
          userId,
          status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
        },
        orderBy: { createdAt: 'desc' },
        select: { planGroupId: true },
      });

      if (!latestPlan) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      // Fetch meals and ingredients linked to the plan group
      const meals = await prisma.mealPlan.findMany({
        where: { planGroupId: latestPlan.planGroupId },
        include: {
          ingredients: true,
          mealLogs: {
            where: { userId },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: meals,
      });
    } catch (error: any) {
      console.error('[MealsController] getCurrentPlan error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve your current meal plan.',
      });
    }
  }

  /**
   * GET /api/user/meals/history
   * Returns all historic plans grouped by planGroupId.
   */
  static async getPlanHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const allPlans = await prisma.mealPlan.findMany({
        where: { userId },
        include: { ingredients: true },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: allPlans,
      });
    } catch (error: any) {
      console.error('[MealsController] getPlanHistory error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal plan history.',
      });
    }
  }

  /**
   * POST /api/user/meals/log-outside
   * Logs an outside meal, performing pre-checks.
   */
  static async logOutsideMeal(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { mealName, mealType, warningAcknowledged, notes } = req.body;
      if (!mealName || !mealType) {
        return res.status(400).json({ success: false, error: 'Missing mealName or mealType parameters.' });
      }

      const result = await MealLogService.logOutsideMeal({
        userId,
        mealName,
        mealType,
        warningAcknowledged,
        notes,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MealsController] logOutsideMeal error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to check or log outside meal.',
      });
    }
  }

  /**
   * PATCH /api/user/meals/:id/status
   * Toggles the log status (DONE/SKIPPED) for a scheduled meal plan item.
   */
  static async updateMealStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const mealPlanId = req.params.id;
      const { status } = req.body; // Expects 'DONE' | 'SKIPPED' | 'PENDING'

      if (!status || !['DONE', 'SKIPPED', 'PENDING'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing status parameter.' });
      }

      // Find the MealPlan item to fetch macros
      const mealPlan = await prisma.mealPlan.findFirst({
        where: { id: mealPlanId, userId },
      });

      if (!mealPlan) {
        return res.status(404).json({ success: false, error: 'Meal plan item not found.' });
      }

      // Check if a MealLog record already exists for this scheduled item
      const existingLog = await prisma.mealLog.findFirst({
        where: { userId, mealPlanId },
      });

      let updatedLog;
      if (existingLog) {
        // Update existing status
        updatedLog = await prisma.mealLog.update({
          where: { id: existingLog.id },
          data: {
            status: status as MealLogStatus,
            loggedAt: new Date(), // Keep timestamps sync with active check mark
          },
        });
      } else {
        // Create new log linked to this meal plan
        updatedLog = await prisma.mealLog.create({
          data: {
            userId,
            mealPlanId,
            source: MealLogSource.SYSTEM_GENERATED,
            mealName: mealPlan.mealName,
            calories: mealPlan.calories,
            proteinG: mealPlan.proteinG,
            carbsG: mealPlan.carbsG,
            fatG: mealPlan.fatG,
            dataSource: MealLogDataSource.FNRI, // Plan meals are FNRI validated
            status: status as MealLogStatus,
            warningType: null,
            warningShown: false,
            warningAcknowledged: false,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedLog,
      });
    } catch (error: any) {
      console.error('[MealsController] updateMealStatus error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update scheduled meal status.',
      });
    }
  }
}
