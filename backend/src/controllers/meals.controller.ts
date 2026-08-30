import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { MealGenerationService } from '@/services/meal-generation.service';
import { MealLogService } from '@/services/meal-log.service';
import { MealSwapService } from '@/services/meal-swap.service';
import prisma from '@/lib/prisma';
import { MealLogSource, MealLogDataSource, MealLogStatus, MealPlanStatus, MealType } from '@prisma/client';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import {
  assertUserActionableMealPlan,
  filterUserActionableMealPlans,
  getCurrentMealPlanScheduleWhere,
  getOwnedMealPlanWhere,
  getUserActionableMealPlanWhere,
  isMealPlanNotActionableError,
} from '@/domain/meal-actionability.policy';
import {
  buildPendingMealPlanPreview,
  summarizeGeneratedMealPlan,
} from '@/domain/meal-generation-result.policy';

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

      console.log('[MealsController] Starting authenticated meal plan generation.');
      const planGroupId = await MealGenerationService.generatePlanForUser(userId);

      // Fetch the new group once, but expose only actionable rows as meals.
      // Pending rows are represented by a count/status summary, never as
      // actionable meal details.
      const generatedPlanRows = await prisma.mealPlan.findMany({
        where: {
          planGroupId,
          userId,
        },
        include: { ingredients: true },
        orderBy: { scheduledDate: 'asc' },
      });
      const meals = filterUserActionableMealPlans(generatedPlanRows);
      const generationSummary = summarizeGeneratedMealPlan(generatedPlanRows);
      const pendingReview = buildPendingMealPlanPreview(generatedPlanRows);

      return res.status(200).json({
        success: true,
        data: {
          planGroupId,
          meals,
          ...generationSummary,
          pendingReview,
        },
      });
    } catch (error: any) {
      console.error(
        '[MealsController] Meal plan generation failed:',
        sanitizeErrorMessage(error, 'Internal meal generation failure.')
      );
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to generate your personalized meal plan.'),
      });
    }
  }

  static async getGenerationStatus(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const job = await MealGenerationService.getLatestGenerationStatus(userId);
    return res.status(200).json({ success: true, data: job });
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

      const now = new Date();

      // Find the latest plan group containing a currently actionable row.
      const latestPlan = await prisma.mealPlan.findFirst({
        where: {
          userId,
          ...getUserActionableMealPlanWhere(now),
        },
        orderBy: { createdAt: 'desc' },
        select: { planGroupId: true },
      });

      if (!latestPlan) {
        const latestPendingPlan = await prisma.mealPlan.findFirst({
          where: {
            userId,
            status: MealPlanStatus.PENDING_REVIEW,
            ...getCurrentMealPlanScheduleWhere(now),
          },
          orderBy: { createdAt: 'desc' },
          select: { planGroupId: true },
        });
        const pendingPlanRows = latestPendingPlan
          ? await prisma.mealPlan.findMany({
              where: {
                userId,
                planGroupId: latestPendingPlan.planGroupId,
                status: MealPlanStatus.PENDING_REVIEW,
                ...getCurrentMealPlanScheduleWhere(now),
              },
              select: {
                planType: true,
                status: true,
                mealName: true,
                mealType: true,
                description: true,
                calories: true,
                proteinG: true,
                carbsG: true,
                fatG: true,
                scheduledDate: true,
                ingredients: {
                  select: {
                    ingredientName: true,
                    category: true,
                  },
                },
              },
            })
          : [];

        return res.status(200).json({
          success: true,
          data: [],
          meta: {
            pendingReview: buildPendingMealPlanPreview(pendingPlanRows),
          },
        });
      }

      // Fetch meals and ingredients linked to the plan group
      const groupMeals = await prisma.mealPlan.findMany({
        where: {
          userId,
          planGroupId: latestPlan.planGroupId,
          ...getUserActionableMealPlanWhere(now),
        },
        include: {
          ingredients: true,
          mealLogs: {
            where: { userId },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      });
      const meals = filterUserActionableMealPlans(groupMeals, now);

      return res.status(200).json({
        success: true,
        data: meals,
        meta: {
          pendingReview: null,
        },
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
   * POST /api/user/meals/rollover
   * Creates the current full weekly plan only when the user's starter bridge
   * ended immediately before the current shopping cycle and no weekly group
   * already exists for that cycle.
   */
  static async ensureCurrentPlanRollover(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const result = await MealGenerationService.ensureCurrentWeeklyRollover(userId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      console.error(
        '[MealsController] Weekly rollover failed:',
        sanitizeErrorMessage(error, 'Weekly rollover failure.')
      );
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to prepare the current weekly meal plan.'),
      });
    }
  }

  /**
   * GET /api/user/meals/:id
   * Returns details of a specific meal plan item.
   */
  static async getMealDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const meal = await prisma.mealPlan.findFirst({
        where: getOwnedMealPlanWhere(userId, id),
        include: {
          ingredients: true,
          mealLogs: {
            where: { userId },
          },
        },
      });

      if (!meal) {
        return res.status(404).json({ success: false, error: 'Meal not found.' });
      }

      return res.status(200).json({
        success: true,
        data: meal,
      });
    } catch (error: any) {
      console.error('[MealsController] getMealDetails error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal details.',
      });
    }
  }

  /**
   * GET /api/user/meals/history
   * Returns:
   *  - "Plan Meals" = MealLog records with source=SYSTEM_GENERATED and status=DONE
   *    (meals the user checked off as eaten from their plan)
   *  - "Outside Meals" = MealLog records with source=USER_LOGGED
   * Both normalized to the same shape and sorted by loggedAt descending.
   */
  static async getPlanHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { search, source, status, startDate, endDate } = req.query;

      const where: any = { userId };

      if (search && typeof search === 'string') {
        where.mealName = {
          contains: search,
          mode: 'insensitive',
        };
      }

      if (source && typeof source === 'string') {
        where.source = source as MealLogSource;
      }

      if (status && typeof status === 'string' && status !== 'All') {
        where.status = status as MealLogStatus;
      } else {
        where.status = { in: ['DONE', 'SKIPPED'] };
      }

      if (startDate || endDate) {
        where.loggedAt = {};
        if (startDate && typeof startDate === 'string') {
          where.loggedAt.gte = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
          where.loggedAt.lte = new Date(endDate);
        }
      }

      // Fetch ALL meal logs for this user (both plan-checked and outside) with search and filters
      const allLogs = await prisma.mealLog.findMany({
        where,
        include: {
          mealPlan: {
            include: {
              swapLogs: {
                orderBy: { swappedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { loggedAt: 'desc' },
      });

      // Normalize to unified shape
      const normalized = allLogs.map((l) => {
        const latestSwap = l.mealPlan?.swapLogs?.[0];
        return {
          id: l.id,
          mealName: l.mealName,
          source: l.source as string,          // 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED'
          calories: l.calories,
          proteinG: l.proteinG,
          carbsG: l.carbsG,
          fatG: l.fatG,
          dataSource: l.dataSource as string,
          status: l.status as string,
          warningType: l.warningType ?? null,
          loggedAt: l.loggedAt.toISOString(),
          calorieDelta: latestSwap ? latestSwap.calorieDelta : null,
        };
      });

      return res.status(200).json({
        success: true,
        data: normalized,
      });
    } catch (error: any) {
      console.error('[MealsController] getPlanHistory error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve meal history.',
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

      const { mealName, mealType, warningAcknowledged, confirmationId, notes } = req.body;
      if (!mealName || !mealType) {
        return res.status(400).json({ success: false, error: 'Missing mealName or mealType parameters.' });
      }

      const result = await MealLogService.logOutsideMeal({
        userId,
        mealName,
        mealType,
        warningAcknowledged,
        confirmationId,
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
        error: sanitizeErrorMessage(error, 'Failed to check or log outside meal.'),
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
        where: getOwnedMealPlanWhere(userId, mealPlanId),
      });

      if (!mealPlan) {
        return res.status(404).json({ success: false, error: 'Meal plan item not found.' });
      }

      assertUserActionableMealPlan(mealPlan);

      const updatedLog = await prisma.mealLog.upsert({
        where: { mealPlanId },
        update: {
          status: status as MealLogStatus,
          source: MealLogSource.SYSTEM_GENERATED,
          loggedAt: new Date(),
        },
        create: {
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

      return res.status(200).json({
        success: true,
        data: updatedLog,
      });
    } catch (error: any) {
      console.error('[MealsController] updateMealStatus error:', error);
      if (isMealPlanNotActionableError(error)) {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to update scheduled meal status.',
      });
    }
  }

  /**
   * GET /api/user/meals/:id/swap-options
   * Returns compatible swap choices from verified MealLibrary.
   */
  static async getSwapOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const mealPlanId = req.params.id;
      const options = await MealSwapService.getEligibleSwapOptions(userId, mealPlanId);

      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (error: any) {
      console.error('[MealsController] getSwapOptions error:', error);
      if (isMealPlanNotActionableError(error)) {
        return res.status(409).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to retrieve swap options.'),
      });
    }
  }

  /**
   * POST /api/user/meals/:id/swap
   * Performs the meal swap.
   */
  static async executeSwap(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const mealPlanId = req.params.id;
      const { newLibraryMealId, warningShown, warningAcknowledged } = req.body;

      if (!newLibraryMealId) {
        return res.status(400).json({ success: false, error: 'Missing newLibraryMealId parameter.' });
      }

      const result = await MealSwapService.swapMeal(
        userId,
        mealPlanId,
        newLibraryMealId,
        warningShown,
        warningAcknowledged
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MealsController] executeSwap error:', error);
      if (isMealPlanNotActionableError(error)) {
        return res.status(409).json({ success: false, error: error.message });
      }
      const status = sanitizeErrorMessage(error, '').includes('limit reached') ? 403 : 400;
      return res.status(status).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to execute meal swap.'),
      });
    }
  }

  /**
   * GET /api/user/meals/:id/swap-preview
   * Generates swap calorie warnings.
   */
  static async getSwapPreview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }
      const mealPlanId = req.params.id;
      const libraryMealId = req.query.libraryMealId as string;
      if (!libraryMealId) {
        return res.status(400).json({ success: false, error: 'Missing libraryMealId query parameter.' });
      }
      const preview = await MealSwapService.getSwapPreview(userId, mealPlanId, libraryMealId);
      return res.status(200).json({ success: true, data: preview });
    } catch (error: any) {
      if (isMealPlanNotActionableError(error)) {
        return res.status(409).json({ success: false, error: error.message });
      }
      return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to preview swap.') });
    }
  }

  /**
   * GET /api/user/meals/compatible-library
   * Returns all compatible approved library meals for the logged-in user.
   */
  static async getCompatibleLibrary(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const mealType = req.query.mealType as MealType | undefined;
      const search = req.query.search as string | undefined;
      const meals = await MealSwapService.getCompatibleLibraryMeals(userId, mealType, search);

      return res.status(200).json({
        success: true,
        data: meals,
      });
    } catch (error: any) {
      console.error('[MealsController] getCompatibleLibrary error:', error);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to retrieve compatible meals.'),
      });
    }
  }
}
