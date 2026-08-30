import prisma from '@/lib/prisma';
import { getNutritionEligibleMealLogWhere } from '@/domain/meal-actionability.policy';
import {
  getManilaDateKey,
  getNextWeeklyCycleWindow,
  isWeeklyPlanPreparationDue,
} from '@/domain/meal-plan-cycle.policy';

export class CronService {
  /**
   * Aggregates completed calorie logs from yesterday for all onboarded users,
   * calculates clinical calorie adherence, and logs daily performance metrics.
   */
  static async runDailyCheckin() {
    console.log('[CronService] Initiating daily nutrition check-in aggregates...');

    // 1. Resolve 'yesterday' time bounds
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    console.log(`[CronService] Targeted time bounds: ${yesterdayStart.toISOString()} -> ${yesterdayEnd.toISOString()}`);

    // 2. Fetch all onboarded standard users with profiles
    const users = await prisma.user.findMany({
      where: {
        onboardingDone: true,
        role: 'USER',
      },
      include: {
        userProfile: true,
      },
    });

    console.log(`[CronService] Found ${users.length} onboarded users to process.`);
    const processedLogs = [];

    // 3. Process logs per user
    for (const user of users) {
      try {
        const targetCalories = user.userProfile?.dailyCalorieTarget || 0;
        if (targetCalories <= 0) {
          console.log(`[CronService] Skipping user ${user.email} due to missing or invalid calorie targets.`);
          continue;
        }

        // Fetch completed meal logs for yesterday
        const mealLogs = await prisma.mealLog.findMany({
          where: {
            userId: user.id,
            status: 'DONE',
            ...getNutritionEligibleMealLogWhere(),
            loggedAt: {
              gte: yesterdayStart,
              lte: yesterdayEnd,
            },
          },
        });

        // Sum yesterday's totals
        let totalCalories = 0;
        let totalProteinG = 0;
        let totalCarbsG = 0;
        let totalFatG = 0;

        for (const log of mealLogs) {
          totalCalories += log.calories;
          totalProteinG += log.proteinG;
          totalCarbsG += log.carbsG;
          totalFatG += log.fatG;
        }

        // Calculate clinical adherence percentage:
        // Penalizes both over-eating and under-eating to encourage clinical calorie discipline.
        let adherencePct = 0;
        if (totalCalories > 0) {
          const deviationPct = Math.abs((totalCalories - targetCalories) / targetCalories) * 100;
          adherencePct = Math.max(0, 100 - deviationPct);
        } else {
          // If no calories logged, adherence is 0
          adherencePct = 0;
        }

        const savedLog = await prisma.dailyNutritionLog.upsert({
          where: {
            userId_logDate: { userId: user.id, logDate: yesterdayStart },
          },
          update: {
              totalCalories,
              totalProteinG,
              totalCarbsG,
              totalFatG,
              targetCalories,
              adherencePct,
          },
          create: {
              userId: user.id,
              logDate: yesterdayStart,
              totalCalories,
              totalProteinG,
              totalCarbsG,
              totalFatG,
              targetCalories,
              adherencePct,
          },
        });
        console.log(`[CronService] Upserted yesterday's log for ${user.email}: ${adherencePct.toFixed(1)}% Adherence.`);

        processedLogs.push(savedLog);
      } catch (userErr) {
        console.error(`[CronService] Failed to process aggregates for user ${user.email}:`, userErr);
      }
    }

    return {
      success: true,
      processedCount: processedLogs.length,
      logs: processedLogs,
    };
  }

  /**
   * One daily scheduler prepares plans whose review window is due. Exact
   * shopping days remove the need for seven cron definitions; the generation
   * service supplies the durable per-cycle idempotency key.
   */
  static async runWeeklyPlanPreparation(
    now: Date = new Date(),
    legacyGroup?: 'WEEKEND' | 'WEEKDAY'
  ) {
    console.log(`[CronService] Running daily weekly-plan preparation for ${getManilaDateKey(now)}...`);

    const users = await prisma.user.findMany({
      where: {
        onboardingDone: true,
        role: 'USER',
        ...(legacyGroup ? { userProfile: { shoppingDayGroup: legacyGroup } } : {}),
      },
      select: {
        id: true,
        userProfile: {
          select: {
            shoppingDayOfWeek: true,
            shoppingDayGroup: true,
            lastCheckinAt: true,
            checkinStreak: true,
          },
        },
      },
    });

    console.log(`[CronService] Evaluating ${users.length} onboarded schedules.`);
    const results = [];

    for (const user of users) {
      try {
        const profile = user.userProfile;
        if (!profile) continue;
        const schedule = {
          shoppingDayOfWeek: profile.shoppingDayOfWeek,
          shoppingDayGroup: profile.shoppingDayGroup,
        };
        if (!isWeeklyPlanPreparationDue(schedule, now)) continue;

        const cycle = getNextWeeklyCycleWindow(schedule, now);
        const cycleKey = getManilaDateKey(cycle.startDate);
        console.log(`[CronService] Preparing cycle ${cycleKey} for user ${user.id}.`);
        const { MealGenerationService } = await import('@/services/meal-generation.service');
        const planGroupId = await MealGenerationService.generateNextWeeklyPlan(user.id, schedule, now);

        const notificationTitle = `Upcoming plan · ${cycleKey}`;
        const priorNotification = await prisma.notification.findFirst({
          where: { userId: user.id, type: 'WEEKLY_CHECKIN', title: notificationTitle },
          select: { id: true },
        });
        if (!priorNotification) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              title: notificationTitle,
              message: 'Your next weekly plan is being prepared before your grocery day. Newly generated meals remain clearly marked until staff review is complete.',
              type: 'WEEKLY_CHECKIN',
            },
          });
        }

        // Handle missed check-in streak degradation
        // If the user's lastCheckinAt is older than 7 days, they missed
        // their weekly check-in window and their streak should be reset.
        const lastCheckin = profile.lastCheckinAt;
        const missedWindow = lastCheckin
          ? (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24) > 7
          : false; // No lastCheckinAt = first cycle, don't penalise

        if (missedWindow && profile.checkinStreak > 0) {
          console.log(`[CronService] Resetting a missed check-in streak for user ${user.id}.`);

          await prisma.userProfile.update({
            where: { userId: user.id },
            data: { checkinStreak: 0 },
          });

          await prisma.notification.create({
            data: {
              userId: user.id,
              title: '⚠️ Streak Broken',
              message: `Your ${profile.checkinStreak}-week check-in streak has been reset because you missed last week's check-in. Complete this week's check-in to start building your streak again!`,
              type: 'WEEKLY_CHECKIN',
            },
          });
        }

        results.push({ userId: user.id, planGroupId, cycleStart: cycleKey, prepared: true });
      } catch (err) {
        console.error(`[CronService] Weekly plan preparation failed for user ${user.id}:`, err);
        results.push({ userId: user.id, prepared: false });
      }
    }

    return {
      success: true,
      processedCount: results.length,
      results,
    };
  }

  /** Backwards-compatible wrapper for the two historical cron endpoints. */
  static async runWeeklyCheckin(group: 'WEEKEND' | 'WEEKDAY') {
    return CronService.runWeeklyPlanPreparation(new Date(), group);
  }
}
