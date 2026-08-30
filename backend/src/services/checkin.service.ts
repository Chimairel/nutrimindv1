import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import { getCurrentWeeklyCycleWindow } from '@/domain/meal-plan-cycle.policy';
import { evaluateWeeklyAdaptation } from '@/domain/weekly-adaptation.policy';
import type { WeeklyCheckinInput } from '@/validation/checkin.schemas';
import {
  ActivityLevel,
  Goal,
  HealthConditionType,
  NotificationType,
  Prisma,
  WeeklyAdaptationState,
} from '@prisma/client';

export class CheckinService {
  static async getCheckinStatus(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        lastCheckinAt: true,
        checkinStreak: true,
        shoppingDayOfWeek: true,
        shoppingDayGroup: true,
        user: {
          select: {
            createdAt: true,
            nutritionReport: { select: { acknowledgedAt: true } },
          },
        },
      },
    });

    if (!profile) return { isDue: false, streak: 0, lastCheckinAt: null, latestAdaptation: null };

    const now = new Date();
    const schedule = {
      shoppingDayOfWeek: profile.shoppingDayOfWeek,
      shoppingDayGroup: profile.shoppingDayGroup,
    };
    const cycle = profile.shoppingDayOfWeek !== null || profile.shoppingDayGroup
      ? getCurrentWeeklyCycleWindow(schedule, now)
      : null;
    const submittedThisCycle = cycle
      ? await prisma.weeklyCheckin.findUnique({
          where: { userId_cycleStartDate: { userId, cycleStartDate: cycle.startDate } },
          select: { adaptationState: true, weightTrendKg: true, averageAdherencePct: true, createdAt: true },
        })
      : null;

    // The report acknowledgement is the moment onboarding is complete and the
    // user first enters the product. A first-time user needs a full week of
    // real activity before NutriMind asks what changed; a null lastCheckinAt
    // must not mean "due immediately".
    const firstCheckinAnchor = profile.user.nutritionReport?.acknowledgedAt
      ?? profile.user.createdAt;
    const checkinAnchor = profile.lastCheckinAt ?? firstCheckinAnchor;
    const nextDueAt = new Date(checkinAnchor.getTime() + 7 * 86_400_000);
    return {
      isDue: !submittedThisCycle && now.getTime() >= nextDueAt.getTime(),
      streak: profile.checkinStreak,
      lastCheckinAt: profile.lastCheckinAt,
      nextDueAt,
      latestAdaptation: submittedThisCycle,
    };
  }

  static async submitCheckin(userId: string, data: WeeklyCheckinInput) {
    const now = new Date();
    const status = await CheckinService.getCheckinStatus(userId);
    if (!status.isDue) {
      throw new Error('Your next weekly check-in is not due yet.');
    }
    const observationStart = new Date(now.getTime() - 21 * 86_400_000);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: { select: { condition: true } },
      },
    });
    const profile = user?.userProfile;
    if (!profile) throw new Error('User profile must be initialized first.');
    if (profile.shoppingDayOfWeek === null && !profile.shoppingDayGroup) {
      throw new Error('A shopping day is required before weekly check-ins can be recorded.');
    }

    const cycle = getCurrentWeeklyCycleWindow(profile, now);
    const existing = await prisma.weeklyCheckin.findUnique({
      where: { userId_cycleStartDate: { userId, cycleStartDate: cycle.startDate } },
    });
    if (existing) return { ...existing, duplicate: true };

    const updates = data.changed ? data.updates : {};
    const submittedWeightKg = updates.weightKg;
    const effectiveWeightKg = submittedWeightKg ?? profile.weightKg;
    const effectiveGoal = (updates.goal as Goal | undefined) ?? profile.goal;
    const effectiveActivityLevel = (updates.activityLevel as ActivityLevel | undefined) ?? profile.activityLevel;

    const [weightHistory, adherenceHistory] = await Promise.all([
      prisma.weightLog.findMany({
        where: { userId, loggedAt: { gte: observationStart } },
        orderBy: { loggedAt: 'asc' },
        select: { weightKg: true, loggedAt: true },
      }),
      prisma.dailyNutritionLog.findMany({
        where: { userId, logDate: { gte: observationStart } },
        orderBy: { logDate: 'asc' },
        select: { adherencePct: true, logDate: true },
      }),
    ]);
    const projectedWeights = submittedWeightKg
      ? [...weightHistory, { weightKg: submittedWeightKg, loggedAt: now }]
      : weightHistory;
    const adaptation = evaluateWeeklyAdaptation({
      goal: effectiveGoal,
      weights: projectedWeights,
      adherence: adherenceHistory,
    });

    let dailyCalorieTarget = profile.dailyCalorieTarget;
    if (profile.age && profile.heightCm && effectiveWeightKg && effectiveGoal && effectiveActivityLevel) {
      const hasPregnantCondition = user.healthConditions.some(
        ({ condition }) => condition === HealthConditionType.PREGNANT
      );
      dailyCalorieTarget = calculateDailyTarget({
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: effectiveWeightKg,
        goal: effectiveGoal,
        activityLevel: effectiveActivityLevel,
        biologicalSex: profile.biologicalSex as 'MALE' | 'FEMALE' | undefined,
        hasPregnantCondition,
      }).dailyCalorieTarget;
    }

    const daysSincePreviousCheckin = profile.lastCheckinAt
      ? (now.getTime() - profile.lastCheckinAt.getTime()) / 86_400_000
      : null;
    const nextStreak = daysSincePreviousCheckin !== null && daysSincePreviousCheckin <= 14
      ? profile.checkinStreak + 1
      : 1;

    try {
      const checkin = await prisma.$transaction(async (tx) => {
        const created = await tx.weeklyCheckin.create({
          data: {
            userId,
            cycleStartDate: cycle.startDate,
            changed: data.changed,
            submittedWeightKg,
            submittedGoal: updates.goal as Goal | undefined,
            submittedActivityLevel: updates.activityLevel as ActivityLevel | undefined,
            weightTrendKg: adaptation.weightTrendKg,
            averageAdherencePct: adaptation.averageAdherencePct,
            observationDays: adaptation.observationDays,
            adaptationState: adaptation.state as WeeklyAdaptationState,
            profileSnapshot: {
              weightKg: effectiveWeightKg,
              goal: effectiveGoal,
              activityLevel: effectiveActivityLevel,
              dailyCalorieTarget,
              automaticCalorieAdjustment: adaptation.automaticCalorieAdjustment,
            },
          },
        });

        await tx.userProfile.update({
          where: { userId },
          data: {
            ...(submittedWeightKg !== undefined ? { weightKg: submittedWeightKg } : {}),
            ...(updates.goal !== undefined ? { goal: updates.goal as Goal } : {}),
            ...(updates.activityLevel !== undefined ? { activityLevel: updates.activityLevel as ActivityLevel } : {}),
            dailyCalorieTarget,
            lastCheckinAt: now,
            checkinStreak: nextStreak,
          },
        });

        if (submittedWeightKg !== undefined) {
          await tx.weightLog.create({ data: { userId, weightKg: submittedWeightKg, note: 'Weekly check-in' } });
        }

        if (adaptation.state === 'REVIEW_RECOMMENDED') {
          await tx.notification.create({
            data: {
              userId,
              title: 'Progress review recommended',
              message: 'Your recent trend and recorded adherence suggest that a nutritionist should review the next adjustment. NutriMind did not automatically change your calorie target from trend data alone.',
              type: NotificationType.REVIEW_REQUEST,
            },
          });
        }
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return {
        ...checkin,
        duplicate: false,
        streak: nextStreak,
        explanation: adaptation.explanation,
        automaticCalorieAdjustment: adaptation.automaticCalorieAdjustment,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await prisma.weeklyCheckin.findUnique({
          where: { userId_cycleStartDate: { userId, cycleStartDate: cycle.startDate } },
        });
        if (duplicate) return { ...duplicate, duplicate: true };
      }
      throw error;
    }
  }
}
