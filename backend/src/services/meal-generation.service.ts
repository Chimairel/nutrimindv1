import prisma from '@/lib/prisma';

import { PlanType, MealPlanGenerationJobStatus, MealPlanCycleStatus, Prisma } from '@prisma/client';

import {
  getCurrentWeeklyCycleWindow,
  getMealPlanCycleTiming,
  getManilaDateKey,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  type MealPlanGenerationWindow,
  type WeeklyCycleWindow,
} from '@/domain/meal-plan-cycle.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';

import { loadUserNutritionContext } from '@/domain/user-nutrition-context';

import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';

import { getPreparationLeadDays } from '@/domain/upcoming-preparation.policy';
import { generate7DayPlan } from './meal-plan-composition.service';

export class MealGenerationService {
  private static readonly GENERATION_JOB_TTL_MS = 20 * 60 * 1000;
  private static readonly rolloverRequests = new Map<
    string,
    Promise<{
      rolledOver: boolean;
      planGroupId: string | null;
    }>
  >();

  /**
   * Determines whether to generate a STARTER plan (partial days until next
   * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
   * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
   */
  static async generatePlanForUser(
    userId: string,
    now: Date = new Date(),
    options: { replaceExisting?: boolean } = {}
  ): Promise<string> {
    const currentCycle = await MealPlanCycleService.getCurrentCycle(userId, now);
    if (currentCycle) {
      if (!options.replaceExisting) return currentCycle.id;
      const numDays = Math.round((currentCycle.endDate.getTime() - currentCycle.startDate.getTime()) / 86_400_000) + 1;
      return MealGenerationService.generateWindowOnce(
        userId,
        { planType: currentCycle.planType, numDays, startDate: currentCycle.startDate },
        true
      );
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const window = getOnDemandMealPlanWindow(
      {
        shoppingDayOfWeek: profile?.shoppingDayOfWeek,
        shoppingDayGroup: profile?.shoppingDayGroup,
      },
      now
    );

    console.log(
      `[Meal Generation] Generating ${window.planType} plan: ${window.numDays} day(s) from ${getManilaDateKey(window.startDate)}.`
    );
    return MealGenerationService.generateWindowOnce(userId, window, options.replaceExisting === true);
  }

  private static async findExistingPlan(
    userId: string,
    planType: PlanType,
    window: WeeklyCycleWindow
  ): Promise<string | null> {
    const existingCycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        planType,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: { cycleRevision: 'desc' },
      select: { id: true },
    });

    return existingCycle?.id ?? null;
  }

  /**
   * Idempotently prepares the next full cycle once its versioned Manila-time
   * window opens. The generation-job uniqueness constraint coalesces scheduler,
   * page recovery, and report-acknowledgment triggers.
   */
  static async ensureUpcomingPlanForUser(
    userId: string,
    now: Date = new Date()
  ): Promise<{ state: 'NOT_OPEN' | 'EXISTING' | 'PREPARED'; planGroupId: string | null }> {
    const context = await loadUserNutritionContext(
      prisma,
      userId,
      'User profile must be initialized before preparing an upcoming meal plan.'
    );
    const profile = context.profile;
    if (profile.shoppingDayOfWeek === null && !profile.shoppingDayGroup) {
      return { state: 'NOT_OPEN', planGroupId: null };
    }
    const window = getNextWeeklyCycleWindow(profile, now);
    const assuranceTier = getMaximumAssuranceTier(context.conditions);
    const timing = getMealPlanCycleTiming(PlanType.WEEKLY, window.startDate, 7, getPreparationLeadDays(assuranceTier));
    const existingCycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        planType: PlanType.WEEKLY,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: { cycleRevision: 'desc' },
      select: {
        id: true,
        profileAdaptationState: true,
        acknowledgedProfileRevision: true,
        shoppingStartedAt: true,
      },
    });
    if (existingCycle) {
      const rebuildable =
        !existingCycle.shoppingStartedAt &&
        existingCycle.acknowledgedProfileRevision === profile.revision &&
        (existingCycle.profileAdaptationState === 'REBUILD_REQUIRED' ||
          existingCycle.profileAdaptationState === 'SAFETY_REVALIDATION_REQUIRED');
      if (!rebuildable) return { state: 'EXISTING', planGroupId: existingCycle.id };
      const planGroupId = await MealGenerationService.generateWindowOnce(
        userId,
        { planType: PlanType.WEEKLY, numDays: 7, startDate: window.startDate },
        true
      );
      return { state: 'PREPARED', planGroupId };
    }
    if (now.getTime() < timing.preparationOpensAt.getTime()) {
      return { state: 'NOT_OPEN', planGroupId: null };
    }
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, {
      planType: PlanType.WEEKLY,
      numDays: 7,
      startDate: window.startDate,
    });
    return { state: 'PREPARED', planGroupId };
  }

  static async generateWindowOnce(
    userId: string,
    window: MealPlanGenerationWindow,
    replaceExisting = false
  ): Promise<string> {
    const endDate = getScheduledMealDate(window.startDate, Math.max(0, window.numDays - 1));
    const existing = await MealGenerationService.findExistingPlan(userId, window.planType, {
      startDate: window.startDate,
      endDate,
    });
    if (existing && !replaceExisting) return existing;

    let job = null;
    let claimedNewJob = false;
    try {
      job = await prisma.mealPlanGenerationJob.create({
        data: {
          userId,
          planType: window.planType,
          cycleStartDate: window.startDate,
          progressPct: 5,
          stageCode: 'PROFILE',
          stageMessage: 'Preparing your nutrition profile.',
        },
      });
      claimedNewJob = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      job = await prisma.mealPlanGenerationJob.findUnique({
        where: {
          userId_planType_cycleStartDate: {
            userId,
            planType: window.planType,
            cycleStartDate: window.startDate,
          },
        },
      });
    }
    if (!job) throw new Error('Unable to establish an idempotent meal-plan generation job.');

    if (!claimedNewJob) {
      const completedByPeer = await MealGenerationService.findExistingPlan(userId, window.planType, {
        startDate: window.startDate,
        endDate,
      });
      if (completedByPeer && !replaceExisting) return completedByPeer;

      const staleCutoff = new Date(Date.now() - MealGenerationService.GENERATION_JOB_TTL_MS);
      const reclaimed = await prisma.mealPlanGenerationJob.updateMany({
        where: {
          id: job.id,
          OR: [
            { status: MealPlanGenerationJobStatus.FAILED },
            { status: MealPlanGenerationJobStatus.COMPLETED },
            { status: MealPlanGenerationJobStatus.GENERATING, updatedAt: { lt: staleCutoff } },
          ],
        },
        data: {
          status: MealPlanGenerationJobStatus.GENERATING,
          attempts: { increment: 1 },
          planGroupId: null,
          lastErrorCode: null,
          progressPct: 5,
          stageCode: 'PROFILE',
          stageMessage: 'Preparing your nutrition profile.',
          startedAt: new Date(),
          completedAt: null,
        },
      });
      if (reclaimed.count !== 1) {
        throw new Error('Meal plan generation is already in progress for this cycle.');
      }
    }

    try {
      const planGroupId = await MealGenerationService.generate7DayPlan(
        userId,
        window.planType,
        window.numDays,
        window.startDate,
        job.id
      );
      await prisma.mealPlanGenerationJob.update({
        where: { id: job.id },
        data: {
          status: MealPlanGenerationJobStatus.COMPLETED,
          planGroupId,
          lastErrorCode: null,
          progressPct: 100,
          stageCode: 'COMPLETED',
          stageMessage: 'Your plan is ready for review.',
          completedAt: new Date(),
        },
      });
      return planGroupId;
    } catch (error) {
      await prisma.mealPlanGenerationJob.updateMany({
        where: { id: job.id, status: MealPlanGenerationJobStatus.GENERATING },
        data: {
          status: MealPlanGenerationJobStatus.FAILED,
          lastErrorCode: 'GENERATION_FAILED',
          stageCode: 'FAILED',
          stageMessage: 'Plan generation could not be completed.',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  static async ensureCurrentWeeklyRollover(
    userId: string,
    now: Date = new Date()
  ): Promise<{ rolledOver: boolean; planGroupId: string | null }> {
    const existingRequest = MealGenerationService.rolloverRequests.get(userId);
    if (existingRequest) return existingRequest;

    const request = MealGenerationService.performCurrentWeeklyRollover(userId, now);
    MealGenerationService.rolloverRequests.set(userId, request);

    try {
      return await request;
    } finally {
      MealGenerationService.rolloverRequests.delete(userId);
    }
  }

  private static async performCurrentWeeklyRollover(
    userId: string,
    now: Date
  ): Promise<{ rolledOver: boolean; planGroupId: string | null }> {
    const authoritativeCurrent = await MealPlanCycleService.getCurrentCycle(userId, now);
    if (authoritativeCurrent) {
      return { rolledOver: false, planGroupId: authoritativeCurrent.id };
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { shoppingDayGroup: true, shoppingDayOfWeek: true },
    });
    if (!profile || (profile.shoppingDayOfWeek === null && !profile.shoppingDayGroup)) {
      return { rolledOver: false, planGroupId: null };
    }

    const window = getCurrentWeeklyCycleWindow(profile, now);
    const existingPlanGroupId = await MealGenerationService.findExistingPlan(userId, PlanType.WEEKLY, window);
    if (existingPlanGroupId) {
      return { rolledOver: false, planGroupId: existingPlanGroupId };
    }

    // A brand-new user has no plan to roll over. Their first STARTER/WEEKLY
    // plan must be created by the explicit Generate Meal Plan action so the
    // dashboard can show its progress UI instead of blocking page hydration
    // on a long-running Gemini request.
    const previousPlan = await prisma.mealPlan.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!previousPlan) {
      return { rolledOver: false, planGroupId: null };
    }

    // Rollover is schedule-derived and idempotent. Create only the active
    // remainder of the cycle instead of backdating a seven-day plan.
    const catchUpWindow = getOnDemandMealPlanWindow(profile, now);
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, catchUpWindow);
    return { rolledOver: true, planGroupId };
  }

  /**
   * Generates a meal plan for N days, customized to the user's macro metrics,
   * clinical restrictions, food preferences, and cultural style.
   * planType: STARTER (bridge plan) or WEEKLY (normal 7-day cycle).
   * numDays: number of days to cover (1-7).
   * startDate: the first day of the plan.
   */
  static generate7DayPlan = generate7DayPlan;

  static async getLatestGenerationStatus(userId: string) {
    const activeJob = await prisma.mealPlanGenerationJob.findFirst({
      where: { userId, status: MealPlanGenerationJobStatus.GENERATING },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        progressPct: true,
        stageCode: true,
        stageMessage: true,
        planGroupId: true,
        lastErrorCode: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    if (activeJob) return activeJob;

    return prisma.mealPlanGenerationJob.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        progressPct: true,
        stageCode: true,
        stageMessage: true,
        planGroupId: true,
        lastErrorCode: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
  }
}
