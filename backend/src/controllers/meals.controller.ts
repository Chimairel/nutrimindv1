import { Response } from 'express';
import { lockUserProfile } from '@/services/profile-revision.service';
import { AuthenticatedRequest } from '@/types';
import { MealGenerationService } from '@/services/meal-generation.service';
import { MealAiQueueService } from '@/services/meal-ai-queue.service';
import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import { MealLogService } from '@/services/meal-log.service';
import { OutsideMealCaptureService } from '@/services/outside-meal-capture.service';
import { OutsideMealReviewService } from '@/services/outside-meal-review.service';
import { ObservedMealService } from '@/services/observed-meal.service';
import { MealSwapService } from '@/services/meal-swap.service';
import { MealFavoriteService } from '@/services/meal-favorite.service';
import { UpcomingPlanPreparationService } from '@/services/upcoming-plan-preparation.service';
import { GroceryService } from '@/services/grocery.service';
import prisma from '@/lib/prisma';
import { MealLogSource, MealLogDataSource, MealLogStatus, MealType, MealPlanStatus } from '@prisma/client';
import { missingMealSlots } from '@/domain/meal-generation-gap.policy';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import {
  assertUserLoggableMealPlan,
  filterUserActionableMealPlans,
  getOwnedMealPlanWhere,
  isMealPlanNotActionableError,
} from '@/domain/meal-actionability.policy';
import {
  buildPendingMealPlanPreview,
  summarizeGeneratedMealPlan,
  type PendingMealPreviewInput,
} from '@/domain/meal-generation-result.policy';
import { buildMealExplanation } from '@/domain/meal-explanation.policy';
import {
  toPublicMealImage,
  toPublicRawRecipeImage,
  type MealImageRecord,
  type PublicMealImage,
  type RawRecipeImageRecord,
} from '@/domain/meal-image.policy';
import { resolveLibraryRecipeImages } from '@/services/library-recipe-image.service';
import { resolveLibraryRecipeCookingLinks } from '@/services/library-recipe-cooking-link.service';
import { cookingLinkForMeal, type PublicMealCookingLink } from '@/domain/meal-cooking-link.policy';
import { getPlanHistory } from './meals-history.controller';
import { AppError } from '@/errors/AppError';

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

const rawRecipeImageSelect = {
  recipeName: true,
  sourceName: true,
  sourceUrl: true,
  sourceImageUrl: true,
  sourceVideoUrl: true,
} as const;

function planImage(
  meal: {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
  },
  libraryImages?: ReadonlyMap<string, PublicMealImage>
) {
  const rawRecipe = isUserSwappedMeal(meal.selectionEvidence) ? null : meal.sourceRawRecipeCandidate;
  const libraryImage = meal.libraryMeal ? toPublicMealImage(meal.libraryMeal) : null;
  if (libraryImage?.kind === 'EXACT' && meal.libraryMeal?.imagePublicId) return libraryImage;
  return (
    (rawRecipe ? toPublicRawRecipeImage(rawRecipe) : null) ||
    (meal.libraryMeal ? libraryImages?.get(meal.libraryMeal.id) : null) ||
    libraryImage
  );
}

function isUserSwappedMeal(selectionEvidence: unknown): boolean {
  return typeof selectionEvidence === 'object' && selectionEvidence !== null &&
    'source' in selectionEvidence && selectionEvidence.source === 'USER_SWAP';
}

function planCookingLink(
  meal: {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
  },
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
): PublicMealCookingLink | null {
  const rawRecipe = isUserSwappedMeal(meal.selectionEvidence) ? null : meal.sourceRawRecipeCandidate;
  const rawLink = cookingLinkForMeal({ sourceRawRecipeCandidate: rawRecipe });
  if (rawLink?.kind === 'PANLASANG_RECIPE') return rawLink;
  return (meal.libraryMeal ? libraryCookingLinks?.get(meal.libraryMeal.id) : null) ||
    cookingLinkForMeal({ libraryDescription: meal.libraryMeal?.description }) || rawLink || null;
}

function pendingPreviewWithImages<
  T extends PendingMealPreviewInput & {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
  },
>(
  rows: readonly T[],
  libraryImages?: ReadonlyMap<string, PublicMealImage>,
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
) {
  return buildPendingMealPlanPreview(rows.map((row) => ({
    ...row,
    image: planImage(row, libraryImages),
    cookingLink: planCookingLink(row, libraryCookingLinks),
  })));
}

function serializeActionableMeal<
  T extends {
    nutritionist: Parameters<typeof toPublicVerifier>[0];
    selectionEvidence: unknown;
    libraryMealId: string | null;
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    status: string;
    aiConfidenceFlag: string;
    calories: number;
    ingredients: Array<{ dataSource: string; foodItemId: string | null }>;
  },
>(
  meal: T,
  libraryImages?: ReadonlyMap<string, PublicMealImage>,
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
) {
  const { nutritionist, selectionEvidence, libraryMeal, sourceRawRecipeCandidate, ...publicMeal } = meal;
  const verifier = toPublicVerifier(nutritionist);
  return {
    ...publicMeal,
    image: planImage({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryImages),
    cookingLink: planCookingLink({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryCookingLinks),
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
        include: {
          ingredients: true,
          libraryMeal: true,
          sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
        },
        orderBy: { scheduledDate: 'asc' },
      });
      const libraryImages = await resolveLibraryRecipeImages(
        generatedPlanRows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(
        generatedPlanRows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const meals = filterUserActionableMealPlans(generatedPlanRows).map(
        ({ libraryMeal, sourceRawRecipeCandidate, ...meal }) => ({
          ...meal,
          image: planImage({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence: meal.selectionEvidence }, libraryImages),
          cookingLink: planCookingLink({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence: meal.selectionEvidence }, libraryCookingLinks),
        })
      );
      const generationSummary = summarizeGeneratedMealPlan(generatedPlanRows);
      const pendingReview = pendingPreviewWithImages(generatedPlanRows, libraryImages, libraryCookingLinks);
      const planSnapshot = await prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId } });
      const cycle = await prisma.mealPlanCycle.findUnique({ where: { id: planGroupId } });
      const awaitingGenerationCount = cycle ? missingMealSlots(
        cycle.startDate, cycle.expectedSlotCount,
        generatedPlanRows.filter((row) => row.status !== MealPlanStatus.CANCELLED)
      ).length : 0;
      const generationJob = await prisma.mealPlanGenerationJob.findUnique({
        where: { planGroupId }, select: { status: true },
      });

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
          cycle,
          awaitingGenerationCount,
          generationStatus: generationJob?.status ?? null,
        },
      });
    } catch (error: any) {
      console.error(
        '[MealsController] Meal plan generation failed:',
        sanitizeErrorMessage(error, 'Internal meal generation failure.')
      );
      return res.status(error instanceof AppError ? error.statusCode : 500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to generate your personalized meal plan.'),
        code: error instanceof AppError ? error.errorCode : undefined,
        details: error instanceof AppError ? error.details : undefined,
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

  static async retryMissingGeneration(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    try {
      const queued = await MealAiQueueService.retryForCycle(userId, req.params.cycleId);
      return res.status(queued ? 202 : 409).json({
        success: queued,
        ...(queued ? { data: { status: 'WAITING_FOR_AI' } } : { error: 'This cycle cannot be retried. Refresh its status or request a new plan.' }),
      });
    } catch (error) {
      return res.status(error instanceof AppError ? error.statusCode : 500).json({
        success: false, error: sanitizeErrorMessage(error, 'Could not retry meal generation.'),
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

      const cycle = await MealPlanCycleService.getCurrentCycle(userId);
      if (!cycle) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: {
            cycle: null,
            pendingReview: buildPendingMealPlanPreview([]),
            planSnapshot: null,
            awaitingGenerationCount: 0,
            generationStatus: null,
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
          sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
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
      const libraryImages = await resolveLibraryRecipeImages(
        groupMeals.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(
        groupMeals.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const meals = groupMeals
        .filter((meal) => clearedIds.has(meal.id))
        .map((meal) => serializeActionableMeal(meal, libraryImages, libraryCookingLinks));
      const planSnapshot = await prisma.mealPlanCycleSnapshot.findUnique({
        where: { planGroupId: cycle.id },
      });
      const generationJob = await prisma.mealPlanGenerationJob.findUnique({
        where: { planGroupId: cycle.id }, select: { status: true },
      });

      return res.status(200).json({
        success: true,
        data: meals,
        meta: {
          cycle,
          pendingReview: pendingPreviewWithImages(groupMeals, libraryImages, libraryCookingLinks),
          planSnapshot,
          awaitingGenerationCount: missingMealSlots(
            cycle.startDate, cycle.expectedSlotCount,
            groupMeals.filter((row) => row.status !== MealPlanStatus.CANCELLED)
          ).length,
          generationStatus: generationJob?.status ?? null,
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
        return res.status(200).json({ success: true, data: [], meta: { cycles, pendingReview: null,
          awaitingGeneration: { current: 0, upcoming: 0 }, generationStatus: { current: null, upcoming: null } } });
      }
      const rows = await prisma.mealPlan.findMany({
        where: { userId, planGroupId: { in: cycleIds } },
        include: {
          ingredients: true,
          libraryMeal: true,
          sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
          mealLogs: { where: { userId } },
          nutritionist: { include: { user: { select: { name: true, image: true } } } },
        },
        orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
      });
      const clearedByCycle = await Promise.all(
        cycleIds.map((cycleId) => MealPlanCycleService.getClearedMealPlanIds(userId, cycleId))
      );
      const generationJobs = await prisma.mealPlanGenerationJob.findMany({
        where: { planGroupId: { in: cycleIds } }, select: { planGroupId: true, status: true },
      });
      const generationStatusFor = (cycleId?: string | null) => generationJobs.find((job) => job.planGroupId === cycleId)?.status ?? null;
      const clearedIds = new Set(clearedByCycle.flat());
      const libraryImages = await resolveLibraryRecipeImages(
        rows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(
        rows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
      );
      const meals = rows
        .filter((meal) => clearedIds.has(meal.id))
        .map((meal) => ({
          ...serializeActionableMeal(meal, libraryImages, libraryCookingLinks),
          cycleScope: meal.planGroupId === cycles.upcoming?.id ? 'UPCOMING' : 'CURRENT',
        }));
      return res.status(200).json({
        success: true,
        data: meals,
        meta: {
          cycles,
          pendingReview: pendingPreviewWithImages(rows, libraryImages, libraryCookingLinks),
          awaitingGeneration: {
            current: cycles.current ? missingMealSlots(cycles.current.startDate, cycles.current.expectedSlotCount,
              rows.filter((row) => row.planGroupId === cycles.current?.id && row.status !== MealPlanStatus.CANCELLED)).length : 0,
            upcoming: cycles.upcoming ? missingMealSlots(cycles.upcoming.startDate, cycles.upcoming.expectedSlotCount,
              rows.filter((row) => row.planGroupId === cycles.upcoming?.id && row.status !== MealPlanStatus.CANCELLED)).length : 0,
          },
          generationStatus: {
            current: generationStatusFor(cycles.current?.id),
            upcoming: generationStatusFor(cycles.upcoming?.id),
          },
        },
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
          sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
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

      const libraryImages = await resolveLibraryRecipeImages(meal.libraryMeal ? [meal.libraryMeal] : []);
      const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(meal.libraryMeal ? [meal.libraryMeal] : []);

      return res.status(200).json({
        success: true,
        data: serializeActionableMeal(meal, libraryImages, libraryCookingLinks),
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
  static getPlanHistory = getPlanHistory;

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

      const {
        mealName,
        items,
        mealType,
        useAiEstimate,
        requestKey,
        warningAcknowledged,
        confirmationId,
        notes,
        estimationContext,
        consumedAt,
      } = req.body;

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
        estimationContext,
        consumedAt,
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

  static async getOutsideSuggestions(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({
        success: true,
        data: await OutsideMealCaptureService.suggestions(req.user!.userId, String(req.query.search)),
      });
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to load food suggestions.') });
    }
  }

  static async editOutsideItem(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealCaptureService.editItem(
        req.user!.userId,
        req.params.id,
        req.params.itemId,
        req.body
      );
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to revise outside meal.') });
    }
  }

  static async voidOutsideLog(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealCaptureService.voidLog(req.user!.userId, req.params.id, req.body.reason);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to void outside meal.') });
    }
  }

  static async requestOutsideItemReview(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealReviewService.requestByUser(req.user!.userId, req.params.id, req.params.itemId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not request outside-meal review.') });
    }
  }

  static async replyToOutsideItemReview(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealReviewService.replyByUser(
        req.user!.userId,
        req.params.id,
        req.params.itemId,
        req.body.message
      );
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not send clarification.') });
    }
  }

  static async consentToObservedMealReuse(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ObservedMealService.consent(req.user!.userId, req.params.id, req.params.itemId, req.body);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not submit this food for reuse.') });
    }
  }

  static async withdrawObservedMealReuse(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ObservedMealService.withdraw(req.user!.userId, req.params.id);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not withdraw reuse permission.') });
    }
  }

  static async attachOutsideImage(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file)
        return res.status(400).json({ success: false, error: 'Choose a JPG, PNG, or WebP image under 2 MB.' });
      const data = await OutsideMealCaptureService.attachImage(req.user!.userId, req.params.id, req.file);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to attach image.') });
    }
  }

  static async getOutsideImage(req: AuthenticatedRequest, res: Response) {
    try {
      const image = await OutsideMealCaptureService.image(req.user!.userId, req.params.id);
      res.setHeader('Content-Type', image.mime);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(image.buffer);
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 404)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Image unavailable.') });
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
        const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(
          userId,
          mealPlan.planGroupId,
          new Date(),
          tx
        );
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
      const {
        newLibraryMealId,
        warningShown,
        warningAcknowledged,
        previewToken,
        requestKey,
        groceryDeltaAcknowledged,
      } = req.body;

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
