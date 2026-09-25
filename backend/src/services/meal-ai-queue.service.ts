import { randomUUID } from 'crypto';
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
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset } from '@/lib/fnri';
import { AiCapacityDeferredError } from './ai-capacity.service';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { ClinicalEvidenceService } from './clinical-evidence.service';
import { buildMealGenerationPrompt } from '@/domain/meal-generation-cuisine.policy';
import { buildMealGenerationResponseSchema } from '@/validation/meal-generation-response.schema';
import { earliestMissingDay, missingMealSlots } from '@/domain/meal-generation-gap.policy';
import { validateGeneratedMealCandidate, splitCustomRestrictions } from '@/domain/generated-meal-validation.policy';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';
import { formatMealLocalityPreference } from '@/domain/planning-location.policy';
import { getMealSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { getLocalizedFoodConsumptionContext } from './food-consumption-context.service';
import { prepareGeneratedMealIngredients, type GeneratedMeal } from './meal-generation-ingredient-preparation.service';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { buildReviewWorkKey } from '@/domain/upcoming-preparation.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION, requiresEscalatedMealReview } from '@/domain/meal-plan-production-safety.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';

const LEASE_MS = 20 * 60_000;
const FAIR_TURN_MS = 5_000;
type Cycle = NonNullable<Awaited<ReturnType<typeof loadQueuedCycle>>>;

async function loadQueuedCycle(id: string) {
  return prisma.mealPlanCycle.findUnique({
    where: { id },
    include: {
      snapshot: true,
      mealPlans: {
        where: { status: { not: MealPlanStatus.CANCELLED } },
        select: { id: true, scheduledDate: true, mealType: true, calories: true },
      },
    },
  });
}

function terminalReason(cycle: Cycle, now: Date): string | null {
  if (!cycle.snapshot || cycle.shoppingStartedAt || cycle.incompleteAcknowledgedAt) return 'CYCLE_FROZEN';
  if (cycle.status === MealPlanCycleStatus.SUPERSEDED || cycle.status === MealPlanCycleStatus.COMPLETED || cycle.status === MealPlanCycleStatus.REVALIDATION_REQUIRED)
    return 'CYCLE_NOT_CURRENT';
  // A future shopping deadline closes this preparatory queue. An on-demand
  // starter may already be active, so it remains eligible for future slots.
  if (cycle.startDate > MealPlanCycleService.getBusinessDay(now) && now >= cycle.shoppingDeadlineAt)
    return 'SHOPPING_DEADLINE_PASSED';
  return null;
}

/** DB-backed, shared across app instances. A turn generates at most one day. */
export class MealAiQueueService {
  private static running = false;

  static async retryForCycle(userId: string, cycleId: string): Promise<boolean> {
    const cycle = await loadQueuedCycle(cycleId);
    if (!cycle || cycle.userId !== userId || terminalReason(cycle, new Date())) return false;
    await ClinicalEvidenceService.assertReadyForMealPlanning(userId);
    const context = await loadUserNutritionContext(prisma, userId, 'PROFILE_MISSING');
    if (context.profile.revision !== cycle.snapshot!.profileRevision ||
        context.profile.safetyRevision !== cycle.snapshot!.safetyRevision ||
        cycle.profileAdaptationState !== 'CURRENT' ||
        !missingMealSlots(cycle.startDate, cycle.expectedSlotCount, cycle.mealPlans).length) return false;
    const updated = await prisma.mealPlanGenerationJob.updateMany({
      where: { userId, planGroupId: cycleId, status: MealPlanGenerationJobStatus.FAILED },
      data: {
        status: MealPlanGenerationJobStatus.WAITING_FOR_AI, nextAttemptAt: new Date(),
        processingToken: null, lastErrorCode: null, completedAt: null, progressPct: 90,
        stageCode: 'WAITING_FOR_AI', stageMessage: 'Retrying the earliest missing meal day.',
      },
    });
    if (updated.count) this.triggerNonBlocking();
    return updated.count > 0;
  }

  static triggerNonBlocking(): void {
    setImmediate(() => { void this.runOne().catch((error) => console.error('[MealAiQueue] Trigger failed:', error)); });
  }

  static async runOne(now: Date = new Date()): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      await prisma.mealPlanGenerationJob.updateMany({
        where: { status: MealPlanGenerationJobStatus.PROCESSING_AI, updatedAt: { lt: new Date(now.getTime() - LEASE_MS) } },
        data: { status: MealPlanGenerationJobStatus.WAITING_FOR_AI, processingToken: null, nextAttemptAt: now },
      });
      const candidates = await prisma.mealPlanGenerationJob.findMany({
        where: { status: MealPlanGenerationJobStatus.WAITING_FOR_AI, nextAttemptAt: { lte: now }, planGroupId: { not: null } },
        include: { cycle: { select: { shoppingDeadlineAt: true, startDate: true } } },
        take: 100,
      });
      candidates.sort((a, b) =>
        (a.cycle?.shoppingDeadlineAt.getTime() ?? Infinity) - (b.cycle?.shoppingDeadlineAt.getTime() ?? Infinity) ||
        a.nextAttemptAt!.getTime() - b.nextAttemptAt!.getTime() || a.startedAt.getTime() - b.startedAt.getTime()
      );
      for (const candidate of candidates) {
        const token = randomUUID();
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
        await this.processClaim(candidate.id, candidate.planGroupId!, token, now);
        return true;
      }
      return false;
    } finally {
      this.running = false;
    }
  }

  private static async processClaim(jobId: string, cycleId: string, token: string, now: Date): Promise<void> {
    const owned = { id: jobId, status: MealPlanGenerationJobStatus.PROCESSING_AI, processingToken: token };
    try {
      const cycle = await loadQueuedCycle(cycleId);
      if (!cycle) throw new Error('CYCLE_MISSING');
      const blocked = terminalReason(cycle, now);
      if (blocked) throw new Error(blocked);
      await ClinicalEvidenceService.assertReadyForMealPlanning(cycle.userId);
      const context = await loadUserNutritionContext(prisma, cycle.userId, 'PROFILE_MISSING');
      const { profile, conditions, allergens, otherConditions, otherAllergies } = context;
      if (profile.revision !== cycle.snapshot!.profileRevision || profile.safetyRevision !== cycle.snapshot!.safetyRevision || cycle.profileAdaptationState !== 'CURRENT')
        throw new Error('PROFILE_CHANGED');

      const gaps = missingMealSlots(cycle.startDate, cycle.expectedSlotCount, cycle.mealPlans);
      if (!gaps.length) {
        await prisma.mealPlanGenerationJob.updateMany({ where: owned, data: {
          status: MealPlanGenerationJobStatus.COMPLETED, processingToken: null, nextAttemptAt: null,
          lastErrorCode: null, progressPct: 100, stageCode: 'COMPLETED', stageMessage: 'All meal candidates are saved.', completedAt: now,
        } });
        return;
      }
      const slots = earliestMissingDay(gaps.filter(
        (slot) => slot.scheduledDate >= MealPlanCycleService.getBusinessDay(now)
      ));
      if (!slots.length) throw new Error('MEAL_DAY_PASSED');
      const existingMeals = cycle.mealPlans.map((meal) => ({
        dayNumber: Math.round((meal.scheduledDate.getTime() - cycle.startDate.getTime()) / 86_400_000) + 1,
        mealType: meal.mealType,
        calories: meal.calories,
      }));
      const localFoods = await getFNRISubset();
      const localized = await getLocalizedFoodConsumptionContext(profile);
      const foods = [...new Map([...localized.items, ...localFoods].map((food) => [food.id, food])).values()].slice(0, 100);
      const composition = await prisma.foodItem.findMany({ where: { id: { in: foods.map((food) => food.id) }, source: 'FNRI' } });
      const foodReference = foods.map((f) =>
        `- [FNRI_ID=${f.id}] ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g per 100g)`
      ).join('\n');
      const { prompt, systemInstruction } = buildMealGenerationPrompt({
        slots, existingMeals, dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
        goal: cycle.snapshot!.goal,
        dietaryPreference: profile.dietaryPreference || 'OMNIVORE', ricePreference: profile.ricePreference,
        foodCulture: profile.foodCulture || 'Filipino', planningLocationLabel: formatMealLocalityPreference(profile),
        conditions, allergens, otherConditions, otherAllergies, foodReference,
        popularFoodReference: localized.text, consumptionEvidenceScope: localized.matchedScope?.label,
      });
      const schema = buildMealGenerationResponseSchema(slots, cycle.snapshot!.dailyCalorieTarget, composition, existingMeals);
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await generateGenerativeJSON<{ meals: GeneratedMeal[] }>(
            attempt === 1 ? prompt : `${prompt}\nPrevious attempt failed deterministic validation; correct the entire requested day.`,
            systemInstruction, schema,
            { operation: AiUsageOperation.MEAL_PLAN_GENERATION, purpose: `EARLIEST_DAY_ATTEMPT_${attempt}` }
          );
          const conflicts = response.meals.flatMap((meal) => validateGeneratedMealCandidate({
            ingredients: meal.ingredients,
            dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
            allergens, customAllergies: splitCustomRestrictions(otherAllergies),
          }).definiteConflicts);
          if (conflicts.length) throw new Error(`DEFINITE_CONFLICT: ${conflicts.join('; ')}`);
          const grounded = new Map(foods.map((food) => [food.id, food]));
          const { preparedMeals, compositionRevisions } = await prepareGeneratedMealIngredients({
            meals: response.meals.map((meal) => ({ ...meal, candidateProvenance: MealCandidateProvenance.AI_FROM_SCRATCH })),
            unmatchedSlots: slots, startDate: cycle.startDate,
            userHasConditions: conditions.some((condition) => condition !== HealthConditionType.NONE),
            groundedFoodById: grounded,
          });
          preparedMeals.forEach((meal) => assertMealSlotCalories(meal.calories, cycle.snapshot!.dailyCalorieTarget, meal.mealType));
          const dayMeals = [...existingMeals, ...preparedMeals.map((meal) => ({
            dayNumber: slots[0].dayNumber, mealType: meal.mealType, calories: meal.calories,
          }))];
          const calorieIssues = validateGeneratedDayCalories(dayMeals, cycle.snapshot!.dailyCalorieTarget);
          if (calorieIssues.length) throw new Error(calorieIssues.join(' '));

          await prisma.$transaction(async (tx) => {
            const currentJob = await tx.mealPlanGenerationJob.findUnique({ where: { id: jobId } });
            const currentCycle = await tx.mealPlanCycle.findUnique({ where: { id: cycleId } });
            const currentProfile = await tx.userProfile.findUnique({ where: { userId: cycle.userId } });
            if (currentJob?.status !== MealPlanGenerationJobStatus.PROCESSING_AI || currentJob.processingToken !== token ||
                !currentCycle || terminalReason({ ...cycle, ...currentCycle }, new Date()) ||
                currentProfile?.revision !== cycle.snapshot!.profileRevision ||
                currentProfile?.safetyRevision !== cycle.snapshot!.safetyRevision || currentCycle.profileAdaptationState !== 'CURRENT')
              throw new Error('QUEUE_CLAIM_STALE');
            const occupied = await tx.mealPlan.findMany({
              where: { planGroupId: cycleId, status: { not: MealPlanStatus.CANCELLED }, scheduledDate: slots[0].scheduledDate },
              select: { mealType: true },
            });
            if (slots.some((slot) => occupied.some((meal) => meal.mealType === slot.mealType))) throw new Error('SLOT_ALREADY_FILLED');
            const currentFoods = await tx.foodItem.findMany({
              where: { id: { in: [...compositionRevisions.keys()] } }, select: { id: true, compositionRevision: true },
            });
            if (currentFoods.length !== compositionRevisions.size || currentFoods.some((food) => food.compositionRevision !== compositionRevisions.get(food.id)))
              throw new Error('FOOD_EVIDENCE_CHANGED');
            const conditionsForReview = conditions.filter((condition) => condition !== HealthConditionType.NONE);
            const enhanced = requiresEscalatedMealReview(conditions, otherConditions);
            for (const meal of preparedMeals) {
              const serving = buildBaseServingPersistence({ ...meal, ingredients: meal.ingredientsData, evidenceSource: 'AI_GENERATED_PENDING_REVIEW' });
              const range = getMealSlotCalorieRange(cycle.snapshot!.dailyCalorieTarget, meal.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER');
              await tx.mealPlan.create({ data: {
                planGroupId: cycleId, userId: cycle.userId, status: MealPlanStatus.PENDING_REVIEW,
                candidateProvenance: MealCandidateProvenance.AI_FROM_SCRATCH, planType: cycle.planType,
                mealType: meal.mealType, mealName: meal.mealName, description: meal.description,
                calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG,
                aiConfidenceFlag: meal.aiConfidenceFlag, scheduledDate: meal.scheduledDate,
                requiresSafetyRevalidation: true, safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                highRiskReviewRequired: enhanced,
                reviewWorkKey: buildReviewWorkKey({ recipeSignature: serving.baseRecipeSignature, evidenceRevision: 1,
                  conditions: conditionsForReview, allergens, policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                  requiredReviewerCount: enhanced ? 2 : 1 }),
                candidateRank: 1, fallbackAvailable: false,
                selectionEvidence: {
                  schemaVersion: 1, source: 'AI_GENERATED', dailyCalorieTarget: cycle.snapshot!.dailyCalorieTarget,
                  slotCalorieTarget: range.target, slotCalorieLower: range.minimum, slotCalorieUpper: range.maximum,
                  localityPreference: profile.mealLocalityPreference,
                  planningLocationLabel: formatMealLocalityPreference(profile),
                  consumptionEvidenceScope: localized.matchedScope?.label ?? null,
                  consumptionEvidenceRelease: localized.releaseLabel,
                  rankingScore: null, rankingReasonCodes: [], capturedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
                ingredients: { create: meal.ingredientsData }, ...serving,
              } });
            }
            const snapshot = await tx.mealPlanCycleSnapshot.findUniqueOrThrow({ where: { planGroupId: cycleId } });
            const dailyMacroTargets = { ...(snapshot.dailyMacroTargets as Record<string, {
              calories: number; proteinG: number; carbsG: number; fatG: number;
            }>) };
            for (const meal of preparedMeals) {
              const key = getManilaDateKey(meal.scheduledDate);
              const current = dailyMacroTargets[key] ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
              dailyMacroTargets[key] = {
                calories: current.calories + meal.calories,
                proteinG: current.proteinG + meal.proteinG,
                carbsG: current.carbsG + meal.carbsG,
                fatG: current.fatG + meal.fatG,
              };
            }
            await tx.mealPlanCycleSnapshot.update({
              where: { planGroupId: cycleId },
              data: { dailyMacroTargets: dailyMacroTargets as Prisma.InputJsonObject },
            });
            const remaining = missingMealSlots(cycle.startDate, cycle.expectedSlotCount, [
              ...cycle.mealPlans, ...preparedMeals.map((meal) => ({ scheduledDate: meal.scheduledDate, mealType: meal.mealType })),
            ]);
            await tx.mealPlanGenerationJob.update({ where: { id: jobId }, data: remaining.length ? {
              status: MealPlanGenerationJobStatus.WAITING_FOR_AI, processingToken: null,
              nextAttemptAt: new Date(Date.now() + FAIR_TURN_MS), progressPct: Math.min(99, 90 + Math.round(9 * (1 - remaining.length / cycle.expectedSlotCount))),
              lastErrorCode: null,
              stageCode: 'WAITING_FOR_AI', stageMessage: `${remaining.length} meal slot(s) awaiting generation.`,
            } : {
              status: MealPlanGenerationJobStatus.COMPLETED, processingToken: null, nextAttemptAt: null,
              lastErrorCode: null,
              progressPct: 100, stageCode: 'COMPLETED', stageMessage: 'All meal candidates are saved.', completedAt: new Date(),
            } });
          }, { timeout: 30_000 });
          await MealPlanCycleService.synchronizeLifecycle(cycle.userId);
          return;
        } catch (error) {
          if (error instanceof AiCapacityDeferredError) throw error;
          lastError = error;
          if (/QUEUE_CLAIM_STALE|SLOT_ALREADY_FILLED|PROFILE_CHANGED|FOOD_EVIDENCE_CHANGED/u.test(String(error))) break;
        }
      }
      throw lastError ?? new Error('AI_VALIDATION_FAILED');
    } catch (error) {
      const deferred = error instanceof AiCapacityDeferredError;
      await prisma.mealPlanGenerationJob.updateMany({ where: owned, data: deferred ? {
        status: MealPlanGenerationJobStatus.WAITING_FOR_AI, processingToken: null, nextAttemptAt: error.retryAt,
        lastErrorCode: 'AI_CAPACITY_DEFERRED', stageCode: 'WAITING_FOR_AI',
        stageMessage: 'AI capacity is limited. Earlier days remain first in line.',
      } : {
        status: MealPlanGenerationJobStatus.FAILED, processingToken: null, nextAttemptAt: null,
        lastErrorCode: String(error).slice(0, 64), stageCode: 'FAILED',
        stageMessage: 'Some meal slots could not be prepared. Saved meals remain available for review.', completedAt: new Date(),
      } });
      if (!deferred) console.error('[MealAiQueue] Day generation failed:', error);
    }
  }
}
