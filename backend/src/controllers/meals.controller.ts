import { Response } from 'express';
import { lockUserProfile } from '@/services/profile-revision.service';
import { AuthenticatedRequest } from '@/types';
import { MealGenerationService } from '@/services/meal-generation.service';
import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import { MealLogService } from '@/services/meal-log.service';
import { MealSwapService } from '@/services/meal-swap.service';
import { MealFavoriteService } from '@/services/meal-favorite.service';
import { UpcomingPlanPreparationService } from '@/services/upcoming-plan-preparation.service';
import { GroceryService } from '@/services/grocery.service';
import prisma from '@/lib/prisma';
import { MealLogSource, MealLogDataSource, MealLogStatus, MealType } from '@prisma/client';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import {
  assertUserLoggableMealPlan,
  filterUserActionableMealPlans,
  getOwnedMealPlanWhere,
  isMealPlanNotActionableError,
} from '@/domain/meal-actionability.policy';
import { buildPendingMealPlanPreview, summarizeGeneratedMealPlan } from '@/domain/meal-generation-result.policy';
import { buildMealExplanation } from '@/domain/meal-explanation.policy';
import { toPublicMealImage, toPublicYouTubeThumbnail, type MealImageRecord } from '@/domain/meal-image.policy';

function toPublicVerifier(
  nutritionist: {
    prcLicenseNumber: string;
    prcLicenseExpiry: Date;
    specialization: string | null;
    yearsOfExperience: number | null;
    university: string | null;
    bio: string | null;
    officialHeadshot?: string | null;
    digitalSignature?: string | null;
    user: { name: string; image?: string | null };
  } | null
) {
  if (!nutritionist) return null;
  return {
    name: nutritionist.user.name,
    image: nutritionist.officialHeadshot || nutritionist.user.image || null,
    officialHeadshot: nutritionist.officialHeadshot || null,
    digitalSignature: nutritionist.digitalSignature || null,
    prcLicenseNumber: nutritionist.prcLicenseNumber,
    prcLicenseExpiry: nutritionist.prcLicenseExpiry,
    specialization: nutritionist.specialization,
    yearsOfExperience: nutritionist.yearsOfExperience,
    university: nutritionist.university,
    bio: nutritionist.bio,
  };
}

function serializeActionableMeal<
  T extends {
    nutritionist: Parameters<typeof toPublicVerifier>[0];
    selectionEvidence: unknown;
    libraryMealId: string | null;
    libraryMeal?: MealImageRecord | null;
    sourceRawRecipeCandidate?: {
      recipeName: string;
      sourceVideoUrl: string | null;
    } | null;
    status: string;
    aiConfidenceFlag: string;
    calories: number;
    ingredients: Array<{ dataSource: string; foodItemId: string | null }>;
  },
>(meal: T) {
  const { nutritionist, selectionEvidence, libraryMeal, sourceRawRecipeCandidate, ...publicMeal } = meal;
  const verifier = toPublicVerifier(nutritionist);
  return {
    ...publicMeal,
    image:
      (libraryMeal ? toPublicMealImage(libraryMeal) : null) ||
      (sourceRawRecipeCandidate ? toPublicYouTubeThumbnail(sourceRawRecipeCandidate) : null),
    verifier,
    explanation: buildMealExplanation({
      libraryMealId: meal.libraryMealId,
      status: meal.status,
      aiConfidenceFlag: meal.aiConfidenceFlag,
      calories: meal.calories,
      verifierName: verifier?.name,
      ingredients: meal.ingredients,
      selectionEvidence,
    }),
  };
}

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
      const planGroupId = await MealGenerationService.generatePlanForUser(userId, new Date(), {
        replaceExisting: req.body.replaceExisting === true,
      });

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
      const planSnapshot = await prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId } });

      // The grocery checklist is a projection of the actionable plan, not a
      // second user-generated artifact. Build it as part of successful plan
      // generation whenever at least one approved meal is available. A retry
      // remains safe because GroceryService replaces the prior projection.
      if (meals.length > 0) {
        await GroceryService.generateGroceryList(userId, undefined, planGroupId);
      }

      return res.status(200).json({
        success: true,
        data: {
          planGroupId,
          meals,
          ...generationSummary,
          pendingReview,
          planSnapshot,
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

      const cycle = await MealPlanCycleService.getCurrentCycle(userId);
      if (!cycle) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: {
            cycle: null,
            pendingReview: buildPendingMealPlanPreview([]),
            planSnapshot: null,
          },
        });
      }

      // The cycle row is the authoritative dated identity. Live profile
      // shopping preferences do not move or hide an already-created cycle.
      const groupMeals = await prisma.mealPlan.findMany({
        where: {
          userId,
          planGroupId: cycle.id,
        },
        include: {
          ingredients: true,
          libraryMeal: true,
          sourceRawRecipeCandidate: {
            select: { recipeName: true, sourceVideoUrl: true },
          },
          mealLogs: {
            where: { userId },
          },
          nutritionist: {
            include: { user: { select: { name: true, image: true } } },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      });
      const clearedIds = new Set(await MealPlanCycleService.getClearedMealPlanIds(userId, cycle.id));
      const meals = groupMeals
        .filter((meal) => clearedIds.has(meal.id))
        .map(serializeActionableMeal);
      const planSnapshot = await prisma.mealPlanCycleSnapshot.findUnique({
        where: { planGroupId: cycle.id },
      });

      return res.status(200).json({
        success: true,
        data: meals,
        meta: {
          cycle,
          pendingReview: buildPendingMealPlanPreview(groupMeals),
          planSnapshot,
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

  /** GET /api/user/meals/workspace — cleared current and upcoming slots. */
  static async getPlanWorkspace(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      UpcomingPlanPreparationService.triggerNonBlocking(userId);
      const cycles = await MealPlanCycleService.getCurrentAndUpcoming(userId);
      const cycleIds = [cycles.current?.id, cycles.upcoming?.id].filter((id): id is string => Boolean(id));
      if (!cycleIds.length) {
        return res.status(200).json({ success: true, data: [], meta: { cycles, pendingReview: null } });
      }
      const rows = await prisma.mealPlan.findMany({
        where: { userId, planGroupId: { in: cycleIds } },
        include: {
          ingredients: true,
          libraryMeal: true,
          sourceRawRecipeCandidate: { select: { recipeName: true, sourceVideoUrl: true } },
          mealLogs: { where: { userId } },
          nutritionist: { include: { user: { select: { name: true, image: true } } } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
      });
      const clearedByCycle = await Promise.all(
        cycleIds.map((cycleId) => MealPlanCycleService.getClearedMealPlanIds(userId, cycleId))
      );
      const clearedIds = new Set(clearedByCycle.flat());
      const meals = rows
        .filter((meal) => clearedIds.has(meal.id))
        .map((meal) => ({
          ...serializeActionableMeal(meal),
          cycleScope: meal.planGroupId === cycles.upcoming?.id ? 'UPCOMING' : 'CURRENT',
        }));
      return res.status(200).json({
        success: true,
        data: meals,
        meta: { cycles, pendingReview: buildPendingMealPlanPreview(rows) },
      });
    } catch (error) {
      console.error('[MealsController] getPlanWorkspace error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve your meal workspace.' });
    }
  }

  /** GET /api/user/meals/cycles — authoritative current/upcoming identities. */
  static async getPlanCycles(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      UpcomingPlanPreparationService.triggerNonBlocking(userId);
      const cycles = await MealPlanCycleService.getCurrentAndUpcoming(userId);
      return res.status(200).json({ success: true, data: cycles });
    } catch (error) {
      console.error('[MealsController] getPlanCycles error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve plan cycles.' });
    }
  }

  /** POST /api/user/meals/cycles/:cycleId/acknowledge-incomplete */
  static async acknowledgeIncompleteCycle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      // Materialize the confirmed subset before acknowledgment freezes it.
      // A zero-slot cycle may still be acknowledged, but has no actionable
      // grocery rows until at least one slot is cleared.
      try {
        await GroceryService.generateGroceryList(userId, undefined, req.params.cycleId);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('No approved meals')) throw error;
      }
      const cycle = await MealPlanCycleService.acknowledgeIncompleteCycle(userId, req.params.cycleId);
      return res.status(200).json({ success: true, data: cycle });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to acknowledge the incomplete cycle.';
      return res.status(400).json({ success: false, error: message });
    }
  }

  /** POST /api/user/meals/cycles/:cycleId/start-shopping */
  static async startShopping(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      const cycle = await MealPlanCycleService.startShopping(userId, req.params.cycleId);
      return res.status(200).json({ success: true, data: cycle });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start shopping.';
      return res.status(400).json({ success: false, error: message });
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
          libraryMeal: true,
          sourceRawRecipeCandidate: {
            select: { recipeName: true, sourceVideoUrl: true },
          },
          mealLogs: {
            where: { userId },
          },
          nutritionist: {
            include: { user: { select: { name: true, image: true } } },
          },
        },
      });

      if (!meal) {
        return res.status(404).json({ success: false, error: 'Meal not found.' });
      }

      return res.status(200).json({
        success: true,
        data: serializeActionableMeal(meal),
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
          outsideItems: true,
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
          source: l.source as string, // 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED'
          calories: l.calories,
          proteinG: l.proteinG,
          carbsG: l.carbsG,
          fatG: l.fatG,
          dataSource: l.dataSource as string,
          status: l.status as string,
          warningType: l.warningType ?? null,
          nutritionCompleteness: l.nutritionCompleteness,
          provisionalCalories: l.provisionalCalories,
          mealType: l.mealType ?? l.mealPlan?.mealType ?? null,
          notes: l.notes ?? null,
          outsideItems: l.outsideItems,
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

      const { mealName, items, mealType, useAiEstimate, requestKey, warningAcknowledged, confirmationId, notes } =
        req.body;

      const result = await MealLogService.logOutsideMeal({
        userId,
        mealName,
        items,
        mealType,
        useAiEstimate,
        requestKey,
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
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      return res.status(status).json({
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
      const { status, notes } = req.body; // Expects 'DONE' | 'SKIPPED' | 'PENDING', optional notes

      if (!status || !['DONE', 'SKIPPED', 'PENDING'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing status parameter.' });
      }

      const updatedLog = await prisma.$transaction(async (tx) => {
        await lockUserProfile(tx, userId);
        // Find the MealPlan item to fetch macros
        const mealPlan = await tx.mealPlan.findFirst({
          where: getOwnedMealPlanWhere(userId, mealPlanId),
        });

        if (!mealPlan) {
          throw new Error('Meal plan item not found.');
        }

        assertUserLoggableMealPlan(mealPlan);
        const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, mealPlan.planGroupId, new Date(), tx);
        if (!clearedIds.includes(mealPlan.id)) {
          throw new Error('This meal needs safety revalidation before it can be logged.');
        }

        return tx.mealLog.upsert({
          where: { mealPlanId },
          update: {
            status: status as MealLogStatus,
            loggedAt: mealPlan.scheduledDate,
            ...(mealPlan.mealType ? { mealType: mealPlan.mealType } : {}),
            ...(notes !== undefined ? { notes: notes ?? null } : {}),
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
            notes: notes ?? null,
            mealType: mealPlan.mealType,
            loggedAt: mealPlan.scheduledDate,
          },
        });
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
      const { newLibraryMealId, warningShown, warningAcknowledged, previewToken, requestKey, groceryDeltaAcknowledged } = req.body;

      if (!newLibraryMealId) {
        return res.status(400).json({ success: false, error: 'Missing newLibraryMealId parameter.' });
      }

      const result = await MealSwapService.swapMeal(
        userId,
        mealPlanId,
        newLibraryMealId,
        warningShown,
        warningAcknowledged,
        previewToken,
        requestKey,
        groceryDeltaAcknowledged
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      console.error('[MealsController] executeSwap error:', sanitizeErrorMessage(error, 'Meal swap failure.'));
      if (isMealPlanNotActionableError(error)) {
        return res.status(409).json({ success: false, error: error.message });
      }
      return res.status(400).json({
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

      const page = await MealSwapService.getCompatibleLibraryMeals(userId, {
        mealType: req.query.mealType as MealType | undefined,
        search: req.query.search as string | undefined,
        date: req.query.date as string | undefined,
        favoriteOnly: req.query.favoriteOnly === 'true',
        riceRole: req.query.riceRole as 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | undefined,
        cursor: req.query.cursor as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      return res.status(200).json({
        success: true,
        data: page.items,
        meta: { total: page.total, nextCursor: page.nextCursor },
      });
    } catch (error: any) {
      console.error('[MealsController] getCompatibleLibrary error:', error);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to retrieve compatible meals.'),
      });
    }
  }

  static async addLibraryFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      const favorite = await MealFavoriteService.add(userId, req.params.id);
      return res.status(200).json({ success: true, data: { mealLibraryId: favorite.mealLibraryId, isFavorite: true } });
    } catch (error: any) {
      const message = sanitizeErrorMessage(error, 'Failed to favorite meal.');
      return res.status(message === 'Library meal not found.' ? 404 : 400).json({ success: false, error: message });
    }
  }

  static async removeLibraryFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      return res.status(200).json({ success: true, data: await MealFavoriteService.remove(userId, req.params.id) });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to remove favorite.') });
    }
  }

  /**
   * PATCH /api/user/meals/logs/:id/notes
   * Updates user notes on a logged meal (owned by the authenticated user).
   */
  static async updateMealLogNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const logId = req.params.id;
      const { notes } = req.body;

      const log = await prisma.mealLog.findFirst({
        where: { id: logId, userId },
      });

      if (!log) {
        return res.status(404).json({ success: false, error: 'Meal log not found.' });
      }

      const updated = await prisma.mealLog.update({
        where: { id: logId },
        data: {
          notes: notes !== undefined ? notes : null,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          id: updated.id,
          notes: updated.notes,
        },
      });
    } catch (error: any) {
      console.error('[MealsController] updateMealLogNotes error:', error);
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to update meal notes.'),
      });
    }
  }
}
