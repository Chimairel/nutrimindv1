import prisma from '@/lib/prisma';

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

        // Find if a log already exists for this user and date to avoid duplicates (safely upsert)
        const existingLog = await prisma.dailyNutritionLog.findFirst({
          where: {
            userId: user.id,
            logDate: yesterdayStart,
          },
        });

        let savedLog;
        if (existingLog) {
          savedLog = await prisma.dailyNutritionLog.update({
            where: { id: existingLog.id },
            data: {
              totalCalories,
              totalProteinG,
              totalCarbsG,
              totalFatG,
              targetCalories,
              adherencePct,
            },
          });
          console.log(`[CronService] Updated yesterday's log for ${user.email}: ${adherencePct.toFixed(1)}% Adherence.`);
        } else {
          savedLog = await prisma.dailyNutritionLog.create({
            data: {
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
          console.log(`[CronService] Created yesterday's log for ${user.email}: ${adherencePct.toFixed(1)}% Adherence.`);
        }

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
   * Sends weekly check-in notifications for all users in a shopping day group,
   * and auto-regenerates plans for users with 3+ consecutive missed check-ins.
   * Called by two separate cron jobs (one per ShoppingDayGroup).
   */
  static async runWeeklyCheckin(group: 'WEEKEND' | 'WEEKDAY') {
    console.log(`[CronService] Running weekly check-in for ${group} group...`);

    const users = await prisma.user.findMany({
      where: {
        onboardingDone: true,
        role: 'USER',
        userProfile: {
          shoppingDayGroup: group,
        },
      },
      include: {
        userProfile: true,
      },
    });

    console.log(`[CronService] Found ${users.length} ${group} users to notify.`);
    const results = [];

    for (const user of users) {
      try {
        const profile = user.userProfile;
        if (!profile) continue;

        // Send weekly check-in notification
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: '🛒 Weekly Check-In',
            message: 'Your new week is starting! Let us know if your health goals or dietary needs have changed so we can refresh your meal plan.',
            type: 'WEEKLY_CHECKIN',
          },
        });

        // Auto-regenerate if checkinStreak is -3 or worse (3 consecutive missed weeks)
        const missedCheckins = profile.checkinStreak < 0 ? Math.abs(profile.checkinStreak) : 0;
        if (missedCheckins >= 3) {
          console.log(`[CronService] Auto-regenerating plan for ${user.email} (${missedCheckins} missed check-ins).`);
          const { MealGenerationService } = await import('@/services/meal-generation.service');
          await MealGenerationService.generatePlanForUser(user.id);

          await prisma.notification.create({
            data: {
              userId: user.id,
              title: '🔄 Meal Plan Auto-Refreshed',
              message: 'We noticed you have missed several weekly check-ins, so we refreshed your meal plan with the same preferences. Update your profile anytime to customize it.',
              type: 'WEEKLY_CHECKIN',
            },
          });

          // Reset streak
          await prisma.userProfile.update({
            where: { userId: user.id },
            data: { checkinStreak: 0 },
          });
        }

        results.push({ userId: user.id, email: user.email, notified: true });
      } catch (err) {
        console.error(`[CronService] Weekly check-in failed for user ${user.email}:`, err);
        results.push({ userId: user.id, email: user.email, notified: false });
      }
    }

    return {
      success: true,
      group,
      processedCount: results.length,
      results,
    };
  }
}
