"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
class CronService {
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
        const users = await prisma_1.default.user.findMany({
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
                const mealLogs = await prisma_1.default.mealLog.findMany({
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
                }
                else {
                    // If no calories logged, adherence is 0
                    adherencePct = 0;
                }
                // Find if a log already exists for this user and date to avoid duplicates (safely upsert)
                const existingLog = await prisma_1.default.dailyNutritionLog.findFirst({
                    where: {
                        userId: user.id,
                        logDate: yesterdayStart,
                    },
                });
                let savedLog;
                if (existingLog) {
                    savedLog = await prisma_1.default.dailyNutritionLog.update({
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
                }
                else {
                    savedLog = await prisma_1.default.dailyNutritionLog.create({
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
            }
            catch (userErr) {
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
    static async runWeeklyCheckin(group) {
        console.log(`[CronService] Running weekly check-in for ${group} group...`);
        const users = await prisma_1.default.user.findMany({
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
                if (!profile)
                    continue;
                // Generate new weekly plan for this user
                console.log(`[CronService] Generating new weekly plan for ${user.email}...`);
                const { MealGenerationService } = await Promise.resolve().then(() => __importStar(require('@/services/meal-generation.service')));
                await MealGenerationService.generatePlanForUser(user.id);
                // Send weekly check-in notification
                await prisma_1.default.notification.create({
                    data: {
                        userId: user.id,
                        title: '🛒 Weekly Check-In',
                        message: 'Your new weekly meal plan is ready! Let us know if your health goals or dietary needs have changed.',
                        type: 'WEEKLY_CHECKIN',
                    },
                });
                // Handle missed check-in streak degradation
                // If the user's lastCheckinAt is older than 7 days, they missed
                // their weekly check-in window and their streak should be reset.
                const lastCheckin = profile.lastCheckinAt;
                const now = new Date();
                const missedWindow = lastCheckin
                    ? (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24) > 7
                    : false; // No lastCheckinAt = first cycle, don't penalise
                if (missedWindow && profile.checkinStreak > 0) {
                    console.log(`[CronService] Streak broken for ${user.email} (last check-in: ${lastCheckin?.toISOString()}). Resetting to 0.`);
                    await prisma_1.default.userProfile.update({
                        where: { userId: user.id },
                        data: { checkinStreak: 0 },
                    });
                    await prisma_1.default.notification.create({
                        data: {
                            userId: user.id,
                            title: '⚠️ Streak Broken',
                            message: `Your ${profile.checkinStreak}-week check-in streak has been reset because you missed last week's check-in. Complete this week's check-in to start building your streak again!`,
                            type: 'WEEKLY_CHECKIN',
                        },
                    });
                }
                results.push({ userId: user.id, email: user.email, notified: true });
            }
            catch (err) {
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
exports.CronService = CronService;
//# sourceMappingURL=cron.service.js.map