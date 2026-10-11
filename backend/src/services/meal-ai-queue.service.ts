import { BackgroundTaskLoop } from '@/lib/background-task-loop';
import { databaseAvailabilityFailure } from '@/lib/database-availability';
import { logger } from '@/lib/logger';
import { mealWorkerDelay, MEAL_WORKER_IDLE_DELAY_MS } from '@/domain/meal-worker-scheduling.policy';
import { cycleMacroTargets, dailyTargetMap } from './meal-macro-context.service';
import { newMealJobToken, recoverExpiredMealJobLeases, startMealJobHeartbeat } from './meal-job-lease.service';
import {
  AiUsageOperation,
  HealthConditionType,
  MealCandidateProvenance,
  MealPlanCycleStatus,
  MealPlanGenerationJobStatus,
  MealPlanStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requiresMealCandidateReview } from '@/domain/meal-candidate-review.policy';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset } from '@/lib/fnri';
import { AiCapacityDeferredError } from './ai-capacity.service';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { ClinicalProfileReviewService } from './clinical-profile-review.service';
import { buildMealGenerationPrompt } from '@/domain/meal-generation-cuisine.policy';
import { buildMealGenerationResponseSchema } from '@/validation/meal-generation-response.schema';
import { earliestMissingDay } from '@/domain/meal-generation-gap.policy';
import { validateGeneratedMealCandidate, splitCustomRestrictions } from '@/domain/generated-meal-validation.policy';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';
import { getMealSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { prepareGeneratedMealIngredients, type GeneratedMeal } from './meal-generation-ingredient-preparation.service';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { buildReviewWorkKey } from '@/domain/upcoming-preparation.policy';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { MealGenerationService } from './meal-generation.service';
import { remainingGenerationSlots, continuationRetryAt } from '@/domain/meal-generation-continuation.policy';
import { recoverPartialPlanJobs } from './partial-plan-recovery.service';
import { sourceRawRecipeCandidates } from './raw-recipe-candidate.service';
import { savePreparedCorpusMeals } from './meal-plan-corpus-persistence.service';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { composedNutritionTotal, scaleFnriFoodToGrams } from '@/domain/composed-serving.policy';
import { lockUserProfile } from './profile-revision.service';
import { getManilaBusinessDateKey } from '@/domain/meal-actionability.policy';
import { retainedMealsForCycle } from './plan-repair-history.service';

const FAIR_TURN_MS = 5_000;
type Cycle = NonNullable<Awaited<ReturnType<typeof loadQueuedCycle>>>;

async function loadQueuedCycle(id: string) {
  const cycle = await prisma.mealPlanCycle.findUnique({
    where: { id },
    include: {
      snapshot: true,
      mealPlans: {
        where: { status: { not: MealPlanStatus.CANCELLED } },
        select: {
          id: true,
          scheduledDate: true,
          mealType: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
        },
      },
    },
  });
  if (!cycle) return null;
  const retained = await retainedMealsForCycle(cycle.userId, cycle.id);
  return {
    ...cycle,
    mealPlans: [
      ...cycle.mealPlans.map((meal) => ({ ...meal, retainedHistory: false })),
      ...retained.map((meal) => ({ ...meal, retainedHistory: true })),
    ],
  };
}

function terminalReason(cycle: Cycle, now: Date): string | null {
  if (!cycle.snapshot || cycle.shoppingStartedAt || cycle.incompleteAcknowledgedAt) return 'CYCLE_FROZEN';
  if (
    cycle.status === MealPlanCycleStatus.SUPERSEDED ||
    cycle.status === MealPlanCycleStatus.COMPLETED ||
    cycle.status === MealPlanCycleStatus.REVALIDATION_REQUIRED
  )
    return 'CYCLE_NOT_CURRENT';
  // A future shopping deadline closes this preparatory queue. An on-demand
  // starter may already be active, so it remains eligible for future slots.
  if (cycle.startDate > MealPlanCycleService.getBusinessDay(now) && now >= cycle.shoppingDeadlineAt)
    return 'SHOPPING_DEADLINE_PASSED';
  return null;
}

/** DB-backed, shared across app instances. A turn generates at most one day. */
export class MealAiQueueService {
  private static worker: BackgroundTaskLoop | null = null;
  private static running = false;
  private static recoveryAt = 0;
  private static stopping = false;
  private static activeRun: Promise<boolean> | null = null;
  private static activeController: AbortController | null = null;

  static async shutdown(): Promise<void> {
    this.stopping = true;
    this.activeController?.abort();
    await this.worker?.stop();
    await this.activeRun;
  }

  static async retryForCycle(userId: string, cycleId: string): Promise<boolean> {
    const cycle = await loadQueuedCycle(cycleId);
    if (!cycle || cycle.userId !== userId || terminalReason(cycle, new Date())) return false;
    await ClinicalEvidenceService.assertReadyForMealPlanning(userId);
    await ClinicalProfileReviewService.assertReadyForMealPlanning(userId);
    const context = await loadPlanningNutritionContext(prisma, userId, 'PROFILE_MISSING');
    if (
      context.profile.revision !== cycle.snapshot!.profileRevision ||
      context.profile.safetyRevision !== cycle.snapshot!.safetyRevision ||
      cycle.profileAdaptationState !== 'CURRENT' ||
      !remainingGenerationSlots(cycle.startDate, cycle.expectedSlotCount, cycle.mealPlans, new Date()).length
    )
      return false;
    if (!cycle.mealPlans.length && (await MealGenerationService.retryEmptyFailedCycle(userId, cycleId))) return true;
    const updated = await prisma.mealPlanGenerationJob.updateMany({
      where: {
        userId,
        planGroupId: cycleId,
        status: { in: [MealPlanGenerationJobStatus.FAILED, MealPlanGenerationJobStatus.COMPLETED] },
      },
      data: {
        status: MealPlanGenerationJobStatus.WAITING_FOR_AI,
        nextAttemptAt: new Date(),
        processingToken: null,
        lastErrorCode: null,
        completedAt: null,
        progressPct: 90,
        stageCode: 'WAITING_FOR_AI',
        stageMessage: 'Retrying the earliest missing meal day.',
      },
    });
    if (updated.count) this.triggerNonBlocking();
    return updated.count > 0;
  }

  private static reportWorkerFailure(error: unknown): void {
    logger.warn('meal_worker_unavailable', {
      errorCode: databaseAvailabilityFailure(error)?.errorCode ?? 'WORKER_FAILED',
    });
  }

  static startWorker(): void {
    if (this.stopping || this.worker) return;
    this.worker = new BackgroundTaskLoop(
      async () => {
        const worked = await this.runOne();
        if (worked || this.stopping) return mealWorkerDelay(worked, null);
        const next = await prisma.mealPlanGenerationJob.findFirst({
          where: {
            status: MealPlanGenerationJobStatus.WAITING_FOR_AI,
            planGroupId: { not: null },
            nextAttemptAt: { not: null },
          },
          orderBy: { nextAttemptAt: 'asc' },
          select: { nextAttemptAt: true },
        });
        return mealWorkerDelay(false, next?.nextAttemptAt ?? null);
      },
      MEAL_WORKER_IDLE_DELAY_MS,
      (error) => this.reportWorkerFailure(error)
    );
    this.worker.wake();
  }

  static triggerNonBlocking(): void {
    if (this.stopping) return;
    if (this.worker) this.worker.wake();
    else
      setImmediate(() => {
        void this.runOne().catch((error) => this.reportWorkerFailure(error));
      });
  }

  static runOne(now: Date = new Date()): Promise<boolean> {
    if (this.stopping || this.activeRun) return Promise.resolve(false);
    this.activeRun = this.performOne(now).finally(() => {
      this.activeRun = null;
    });
    return this.activeRun;
  }

  private static async performOne(now: Date): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      if (now.getTime() >= this.recoveryAt) {
        await recoverPartialPlanJobs(now);
        this.recoveryAt = now.getTime() + 5 * 60_000;
      }
      await recoverExpiredMealJobLeases(now);
      const candidates = await prisma.mealPlanGenerationJob.findMany({
        where: {
          status: MealPlanGenerationJobStatus.WAITING_FOR_AI,
          nextAttemptAt: { lte: now },
          planGroupId: { not: null },
        },
        include: { cycle: { select: { shoppingDeadlineAt: true, startDate: true } } },
        take: 100,
      });
      candidates.sort(
        (a, b) =>
          (a.cycle?.shoppingDeadlineAt.getTime() ?? Infinity) - (b.cycle?.shoppingDeadlineAt.getTime() ?? Infinity) ||
          a.nextAttemptAt!.getTime() - b.nextAttemptAt!.getTime() ||
          a.startedAt.getTime() - b.startedAt.getTime()
      );
      for (const candidate of candidates) {
        if (this.stopping) return false;
        const token = newMealJobToken();
        const claim = await prisma.mealPlanGenerationJob.updateMany({
          where: { id: candidate.id, status: MealPlanGenerationJobStatus.WAITING_FOR_AI, nextAttemptAt: { lte: now } },
          data: {
            status: MealPlanGenerationJobStatus.PROCESSING_AI,
            processingToken: token,
            attempts: { increment: 1 },
            stageCode: 'AI_GENERATION',
            stageMessage: 'Preparing the earliest missing meal day.',
          },
        });
        if (!claim.count) continue;
        const controller = new AbortController();
        this.activeController = controller;
        if (this.stopping) controller.abort();
        const stopHeartbeat = startMealJobHeartbeat(candidate.id, token, controller);
        try {
          await this.processClaim(
            candidate.id,
            candidate.planGroupId!,
            token,
            now,
            candidate.attempts + 1,
            controller.signal
          );
        } finally {
          await stopHeartbeat();
          this.activeController = null;
        }
        return true;
      }
      return false;
    } finally {
      this.running = false;
    }
  }

  private static async processClaim(
    jobId: string,
    cycleId: string,
    token: string,
    now: Date,
    attempts: number,
    signal: AbortSignal
  ): Promise<void> {
    const owned = { id: jobId, status: MealPlanGenerationJobStatus.PROCESSING_AI, processingToken: token };
    try {
      signal.throwIfAborted();
      const cycle = await loadQueuedCycle(cycleId);
      if (!cycle) throw new Error('CYCLE_MISSING');
      const blocked = terminalReason(cycle, now);
      if (blocked) throw new Error(blocked);
      await ClinicalEvidenceService.assertReadyForMealPlanning(cycle.userId);
      await ClinicalProfileReviewService.assertReadyForMealPlanning(cycle.userId);
      const context = await loadPlanningNutritionContext(prisma, cycle.userId, 'PROFILE_MISSING');
      const { profile, conditions, allergens, otherConditions, otherAllergies } = context;
      if (
        context.user.isSuspended ||
        !context.user.emailVerified ||
        !context.user.onboardingDone ||
        !context.user.tosAccepted
      )
        throw new Error('ACCOUNT_NOT_READY');
      if (
        profile.revision !== cycle.snapshot!.profileRevision ||
        profile.safetyRevision !== cycle.snapshot!.safetyRevision ||
        cycle.profileAdaptationState !== 'CURRENT'
      )
        throw new Error('PROFILE_CHANGED');

      const gaps = remainingGenerationSlots(cycle.startDate, cycle.expectedSlotCount, cycle.mealPlans, now);
      if (!gaps.length) {
        await prisma.mealPlanGenerationJob.updateMany({
          where: owned,
          data: {
            status: MealPlanGenerationJobStatus.COMPLETED,
            processingToken: null,
            nextAttemptAt: null,
            lastErrorCode: null,
            progressPct: 100,
            stageCode: 'COMPLETED',
            stageMessage: 'All remaining meal candidates are saved. Past empty slots are not backdated.',
            completedAt: now,
          },
        });
        return;
      }
      const restrictions = adaptUserSafetyRestrictions({
        healthConditions: conditions,
        allergies: allergens,
        otherConditions,
        otherAllergies,
        safetyEntries: context.user.safetyProfileEntries,
      });
      const reviewRequired = requiresMealCandidateReview(restrictions);
      const slots = earliestMissingDay(gaps);
      if (!slots.length) throw new Error('MEAL_DAY_PASSED');
      const existingMeals = cycle.mealPlans
        .filter((meal) => !meal.retainedHistory)
        .map((meal) => ({
          dayNumber: Math.round((meal.scheduledDate.getTime() - cycle.startDate.getTime()) / 86_400_000) + 1,
          mealType: meal.mealType,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
        }));
      const planningTargets = await cycleMacroTargets(prisma, cycle.snapshot, context.planningTargets);
      const riceFood =
        profile.ricePreference === 'NO_RICE'
          ? null
          : await prisma.foodItem.findFirst({
              where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
            });
      const sourced = await sourceRawRecipeCandidates({
        slots,
        planningTargets,
        existingNutrition: existingMeals,
        dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
        dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
        conditions,
        allergens,
        otherConditions,
        otherAllergies,
        reviewFreeBaseOnly: !reviewRequired,
        ricePreference: profile.ricePreference,
        riceFood,
      });
      const useCorpus = sourced.meals.length > 0;
      if (!useCorpus && !reviewRequired) throw new Error('NO_REVIEW_FREE_SOURCE');
      const sourceEvidence = useCorpus
        ? await prisma.rawRecipeCandidate.findMany({
            where: { id: { in: sourced.meals.map((meal) => meal.rawCandidateId) } },
          })
        : [];
      const sourceById = new Map(sourceEvidence.map((source) => [source.id, source]));
      const localFoods = useCorpus ? [] : await getFNRISubset();
      const foods = localFoods.slice(0, 100);
      const composition = await prisma.foodItem.findMany({
        where: { id: { in: foods.map((food) => food.id) }, source: 'FNRI' },
      });
      const foodReference = foods
        .map(
          (f) =>
            `- [FNRI_ID=${f.id}] ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g per 100g)`
        )
        .join('\n');
      const { prompt, systemInstruction } = buildMealGenerationPrompt({
        slots,
        existingMeals,
        planningTargets,
        dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
        goal: cycle.snapshot!.goal,
        dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
        ricePreference: profile.ricePreference,
        foodCulture: profile.foodCulture || 'Filipino',
        conditions,
        allergens,
        otherConditions,
        otherAllergies,
        foodReference,
      });
      const schema = buildMealGenerationResponseSchema(
        slots,
        cycle.snapshot!.dailyCalorieTarget,
        composition,
        existingMeals
      );
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          signal.throwIfAborted();
          const response = useCorpus
            ? { meals: sourced.meals }
            : await generateGenerativeJSON<{ meals: GeneratedMeal[] }>(
                attempt === 1
                  ? prompt
                  : `${prompt}\nPrevious attempt failed deterministic validation; correct the entire requested day.`,
                systemInstruction,
                schema,
                { operation: AiUsageOperation.MEAL_PLAN_GENERATION, purpose: `EARLIEST_DAY_ATTEMPT_${attempt}`, signal }
              );
          const conflicts = response.meals.flatMap(
            (meal) =>
              validateGeneratedMealCandidate({
                ingredients: meal.ingredients,
                dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
                allergens,
                customAllergies: splitCustomRestrictions(otherAllergies),
              }).definiteConflicts
          );
          if (conflicts.length) throw new Error(`DEFINITE_CONFLICT: ${conflicts.join('; ')}`);
          signal.throwIfAborted();
          const grounded = new Map(foods.map((food) => [food.id, food]));
          const { preparedMeals, compositionRevisions } = await prepareGeneratedMealIngredients({
            meals: response.meals.map((meal) => ({
              ...meal,
              candidateProvenance: useCorpus
                ? MealCandidateProvenance.RAW_RECIPE_CORPUS
                : MealCandidateProvenance.AI_FROM_SCRATCH,
            })),
            unmatchedSlots: slots,
            startDate: cycle.startDate,
            userHasConditions: conditions.some((condition) => condition !== HealthConditionType.NONE),
            // Existing source recipes retain their published nutrition and ingredient labels,
            // as in initial composition; the FNRI prompt map belongs to AI-generated meals.
            groundedFoodById: useCorpus ? new Map() : grounded,
          });
          if (riceFood && preparedMeals.some((meal) => meal.pairedRiceG))
            compositionRevisions.set(riceFood.id, riceFood.compositionRevision);
          const plateNutrition = (meal: (typeof preparedMeals)[number]) =>
            meal.pairedRiceG && riceFood
              ? composedNutritionTotal(meal, scaleFnriFoodToGrams(riceFood, meal.pairedRiceG))
              : meal;
          preparedMeals.forEach((meal) =>
            assertMealSlotCalories(plateNutrition(meal).calories, cycle.snapshot!.dailyCalorieTarget, meal.mealType)
          );
          const dayMeals = [
            ...existingMeals.filter((meal) => meal.dayNumber === slots[0].dayNumber),
            ...preparedMeals.map((meal) => ({
              dayNumber: slots[0].dayNumber,
              mealType: meal.mealType,
              ...plateNutrition(meal),
            })),
          ];
          const calorieIssues = validateGeneratedDayCalories(dayMeals, cycle.snapshot!.dailyCalorieTarget);
          if (calorieIssues.length) throw new Error(calorieIssues.join(' '));

          await prisma.$transaction(
            async (tx) => {
              signal.throwIfAborted();
              await lockUserProfile(tx, cycle.userId);
              await tx.$queryRaw`SELECT id FROM "MealPlanCycle" WHERE id = ${cycleId} FOR UPDATE`;
              const currentJob = await tx.mealPlanGenerationJob.findUnique({ where: { id: jobId } });
              const currentCycle = await tx.mealPlanCycle.findUnique({ where: { id: cycleId } });
              const { profile: currentProfile, user: currentUser } = await loadPlanningNutritionContext(
                tx,
                cycle.userId,
                'Profile missing.'
              );
              if (
                currentJob?.status !== MealPlanGenerationJobStatus.PROCESSING_AI ||
                currentJob.processingToken !== token ||
                currentUser.isSuspended ||
                !currentUser.emailVerified ||
                !currentUser.onboardingDone ||
                !currentUser.tosAccepted ||
                !currentCycle ||
                terminalReason({ ...cycle, ...currentCycle }, new Date()) ||
                currentProfile?.revision !== cycle.snapshot!.profileRevision ||
                currentProfile?.safetyRevision !== cycle.snapshot!.safetyRevision ||
                currentCycle.profileAdaptationState !== 'CURRENT'
              )
                throw new Error('QUEUE_CLAIM_STALE');
              const occupied = await tx.mealPlan.findMany({
                where: {
                  planGroupId: cycleId,
                  status: { not: MealPlanStatus.CANCELLED },
                  scheduledDate: slots[0].scheduledDate,
                },
                select: { mealType: true, calories: true, proteinG: true, carbsG: true, fatG: true },
              });
              if (preparedMeals.some((slot) => occupied.some((meal) => meal.mealType === slot.mealType)))
                throw new Error('SLOT_ALREADY_FILLED');
              const currentRetained = await retainedMealsForCycle(cycle.userId, cycleId, tx);
              if (
                preparedMeals.some((slot) =>
                  currentRetained.some(
                    (meal) =>
                      getManilaBusinessDateKey(meal.scheduledDate) === getManilaBusinessDateKey(slot.scheduledDate) &&
                      meal.mealType === slot.mealType
                  )
                )
              )
                throw new Error('SLOT_ALREADY_FILLED');
              const currentDayIssues = validateGeneratedDayCalories(
                [
                  ...occupied.map((meal) => ({ ...meal, dayNumber: slots[0].dayNumber })),
                  ...preparedMeals.map((meal) => ({
                    ...plateNutrition(meal),
                    mealType: meal.mealType,
                    dayNumber: slots[0].dayNumber,
                  })),
                ],
                cycle.snapshot!.dailyCalorieTarget
              );
              if (currentDayIssues.length) throw new Error(currentDayIssues.join(' '));
              const currentFoods = await tx.foodItem.findMany({
                where: { id: { in: [...compositionRevisions.keys()] } },
                select: { id: true, compositionRevision: true },
              });
              if (
                currentFoods.length !== compositionRevisions.size ||
                currentFoods.some((food) => food.compositionRevision !== compositionRevisions.get(food.id))
              )
                throw new Error('FOOD_EVIDENCE_CHANGED');
              const conditionsForReview = conditions.filter((condition) => condition !== HealthConditionType.NONE);
              const enhanced = requiresEscalatedMealReview(conditions, otherConditions);
              if (useCorpus) {
                await savePreparedCorpusMeals(
                  tx,
                  preparedMeals.map((meal) => {
                    const autoGeneralBase = isUnrestrictedPanlasangBaseEligible({
                      source: meal.rawCandidateId ? sourceById.get(meal.rawCandidateId) : null,
                      candidateId: meal.rawCandidateId,
                      conditions,
                      allergens,
                      otherConditions,
                      otherAllergies,
                      safetyEntries: context.user.safetyProfileEntries,
                      preparedIngredients: meal.ingredientsData,
                      servingScale: meal.servingScale,
                      preparedNutrition: meal,
                    });
                    if (!reviewRequired && !autoGeneralBase) throw new Error('NO_REVIEW_FREE_SOURCE');
                    const range = getMealSlotCalorieRange(
                      cycle.snapshot!.dailyCalorieTarget,
                      meal.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER'
                    );
                    return {
                      meal,
                      autoGeneralBase,
                      sourceEvidence: meal.rawCandidateId ? sourceById.get(meal.rawCandidateId) : undefined,
                      userId: cycle.userId,
                      planGroupId: cycleId,
                      planType: cycle.planType,
                      highRiskReviewRequired: enhanced,
                      userConditions: conditions,
                      userAllergens: allergens,
                      planConditions: conditionsForReview,
                      otherConditions,
                      otherAllergies,
                      safetyEntries: context.user.safetyProfileEntries,
                      riceFood,
                      selectionEvidence: {
                        schemaVersion: 1,
                        source: 'RAW_RECIPE_CORPUS',
                        dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
                        slotCalorieTarget: range.target,
                        slotCalorieLower: range.minimum,
                        slotCalorieUpper: range.maximum,
                        planningLocationLabel: 'Philippines',
                        consumptionEvidenceScope: null,
                        consumptionEvidenceRelease: null,
                        rankingScore: meal.rankingScore ?? null,
                        rankingReasonCodes: meal.rankingReasonCodes ?? [],
                        capturedAt: new Date().toISOString(),
                      } as Prisma.InputJsonValue,
                    };
                  })
                );
              } else
                for (const meal of preparedMeals) {
                  const serving = buildBaseServingPersistence({
                    ...meal,
                    ingredients: meal.ingredientsData,
                    evidenceSource: 'AI_GENERATED_PENDING_REVIEW',
                  });
                  const range = getMealSlotCalorieRange(
                    cycle.snapshot!.dailyCalorieTarget,
                    meal.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER'
                  );
                  await tx.mealPlan.create({
                    data: {
                      planGroupId: cycleId,
                      userId: cycle.userId,
                      status: MealPlanStatus.PENDING_REVIEW,
                      candidateProvenance: MealCandidateProvenance.AI_FROM_SCRATCH,
                      planType: cycle.planType,
                      mealType: meal.mealType,
                      mealName: meal.mealName,
                      description: meal.description,
                      calories: meal.calories,
                      proteinG: meal.proteinG,
                      carbsG: meal.carbsG,
                      fatG: meal.fatG,
                      aiConfidenceFlag: meal.aiConfidenceFlag,
                      scheduledDate: meal.scheduledDate,
                      requiresSafetyRevalidation: true,
                      safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                      highRiskReviewRequired: enhanced,
                      reviewWorkKey: buildReviewWorkKey({
                        recipeSignature: serving.baseRecipeSignature,
                        evidenceRevision: 1,
                        conditions: conditionsForReview,
                        allergens,
                        policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                        safetyScopeKey: mealApprovalSafetyScope({
                          conditions,
                          allergens,
                          otherConditions,
                          otherAllergies,
                          safetyEntries: context.user.safetyProfileEntries,
                        }).key,
                        requiredReviewerCount: 1,
                      }),
                      candidateRank: 1,
                      fallbackAvailable: false,
                      selectionEvidence: {
                        schemaVersion: 1,
                        source: 'AI_GENERATED',
                        dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
                        slotCalorieTarget: range.target,
                        slotCalorieLower: range.minimum,
                        slotCalorieUpper: range.maximum,
                        planningLocationLabel: 'Philippines',
                        consumptionEvidenceScope: null,
                        consumptionEvidenceRelease: null,
                        rankingScore: null,
                        rankingReasonCodes: [],
                        capturedAt: new Date().toISOString(),
                      } as Prisma.InputJsonValue,
                      ingredients: { create: meal.ingredientsData },
                      ...serving,
                    },
                  });
                }
              const snapshot = await tx.mealPlanCycleSnapshot.findUniqueOrThrow({ where: { planGroupId: cycleId } });
              const dailyMacroTargets = dailyTargetMap(
                [...cycle.mealPlans, ...preparedMeals].map((meal) => meal.scheduledDate),
                await cycleMacroTargets(tx, snapshot, context.planningTargets),
                snapshot.dailyMacroTargets
              );
              await tx.mealPlanCycleSnapshot.update({
                where: { planGroupId: cycleId },
                data: { dailyMacroTargets: dailyMacroTargets as Prisma.InputJsonObject },
              });
              const remaining = remainingGenerationSlots(
                cycle.startDate,
                cycle.expectedSlotCount,
                [
                  ...cycle.mealPlans,
                  ...preparedMeals.map((meal) => ({ scheduledDate: meal.scheduledDate, mealType: meal.mealType })),
                ],
                new Date()
              );
              await tx.mealPlanGenerationJob.update({
                where: { id: jobId },
                data: remaining.length
                  ? {
                      status: MealPlanGenerationJobStatus.WAITING_FOR_AI,
                      processingToken: null,
                      nextAttemptAt: new Date(Date.now() + FAIR_TURN_MS),
                      progressPct: Math.min(99, 90 + Math.round(9 * (1 - remaining.length / cycle.expectedSlotCount))),
                      lastErrorCode: null,
                      stageCode: 'WAITING_FOR_AI',
                      stageMessage: `${remaining.length} meal slot(s) awaiting generation.`,
                    }
                  : {
                      status: MealPlanGenerationJobStatus.COMPLETED,
                      processingToken: null,
                      nextAttemptAt: null,
                      lastErrorCode: null,
                      progressPct: 100,
                      stageCode: 'COMPLETED',
                      stageMessage: 'All remaining meal candidates are saved. Past empty slots are not backdated.',
                      completedAt: new Date(),
                    },
              });
              await tx.groceryList.updateMany({
                where: { userId: cycle.userId, planGroupId: cycleId },
                data: { isStale: true },
              });
            },
            { timeout: 30_000 }
          );
          await MealPlanCycleService.synchronizeLifecycle(cycle.userId);
          return;
        } catch (error) {
          if (signal.aborted) throw error;
          if (error instanceof AiCapacityDeferredError) throw error;
          lastError = error;
          if (/QUEUE_CLAIM_STALE|SLOT_ALREADY_FILLED|PROFILE_CHANGED|FOOD_EVIDENCE_CHANGED/u.test(String(error))) break;
        }
      }
      throw lastError ?? new Error('AI_VALIDATION_FAILED');
    } catch (error) {
      const deferred = error instanceof AiCapacityDeferredError;
      const interrupted = signal.aborted;
      const retryAt = interrupted
        ? new Date()
        : deferred
          ? error.retryAt
          : continuationRetryAt(error, attempts, new Date());
      await prisma.mealPlanGenerationJob.updateMany({
        where: owned,
        data: retryAt
          ? {
              status: MealPlanGenerationJobStatus.WAITING_FOR_AI,
              processingToken: null,
              nextAttemptAt: retryAt,
              lastErrorCode: interrupted
                ? 'WORKER_INTERRUPTED'
                : deferred
                  ? 'AI_CAPACITY_DEFERRED'
                  : (error as { errorCode: string }).errorCode,
              stageCode: 'WAITING_FOR_AI',
              stageMessage:
                'Preparation is temporarily delayed and will retry automatically. Earlier remaining days stay first in line.',
            }
          : {
              status: MealPlanGenerationJobStatus.FAILED,
              processingToken: null,
              nextAttemptAt: null,
              lastErrorCode: String(error).slice(0, 64),
              stageCode: 'FAILED',
              stageMessage: String(error).includes('NO_REVIEW_FREE_SOURCE')
                ? 'Some slots have no complete source recipe yet. No nutritionist review was requested.'
                : 'Some meal slots could not be prepared. Saved meals remain available for review.',
              completedAt: new Date(),
            },
      });
      if (!retryAt) console.error('[MealAiQueue] Day generation failed:', error);
    }
  }
}
