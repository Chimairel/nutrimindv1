"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const calculations_1 = require("@/lib/calculations");
const client_1 = require("@prisma/client");
class ProgressService {
    /**
     * Logs a new weight reading, updates the user's profile,
     * and dynamically recalculates the daily calorie target.
     */
    static async logWeight(userId, weightKg, note) {
        if (weightKg <= 0) {
            throw new Error('Weight must be a positive number.');
        }
        // 1. Create a WeightLog entry
        const weightLog = await prisma_1.default.weightLog.create({
            data: {
                userId,
                weightKg,
                note,
            },
        });
        // 2. Fetch profile stats to run Mifflin-St Jeor recalculation
        const profile = await prisma_1.default.userProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new Error('Profile not found.');
        }
        const { age, heightCm, goal, activityLevel } = profile;
        // Check if the user has completed onboarding stats
        if (age && heightCm && goal && activityLevel) {
            // Fetch health conditions for pregnancy check
            const healthConditions = await prisma_1.default.healthCondition.findMany({
                where: { userId },
            });
            const hasPregnantCondition = healthConditions.some((c) => c.condition === client_1.HealthConditionType.PREGNANT);
            // Recalculate TDEE targets based on the NEW weight!
            const calculations = (0, calculations_1.calculateDailyTarget)({
                age,
                heightCm,
                weightKg, // Use the new weight
                goal,
                activityLevel,
                hasPregnantCondition,
            });
            // Update the user profile with the new weight and recalculated calorie targets
            await prisma_1.default.userProfile.update({
                where: { userId },
                data: {
                    weightKg,
                    dailyCalorieTarget: calculations.dailyCalorieTarget,
                },
            });
        }
        else {
            // If profile is somehow not fully completed yet, just update the weight
            await prisma_1.default.userProfile.update({
                where: { userId },
                data: {
                    weightKg,
                },
            });
        }
        return weightLog;
    }
    /**
     * Retrieves the weight history and nutrition compliance metrics of the user.
     */
    static async getProgressHistory(userId) {
        // 1. Fetch weight logs sorted chronologically
        const weightLogs = await prisma_1.default.weightLog.findMany({
            where: { userId },
            orderBy: {
                loggedAt: 'asc',
            },
        });
        // 2. Fetch daily nutrition adherence logs sorted chronologically
        const dailyNutritionLogs = await prisma_1.default.dailyNutritionLog.findMany({
            where: { userId },
            orderBy: {
                logDate: 'asc',
            },
        });
        return {
            weightLogs,
            dailyNutritionLogs,
        };
    }
}
exports.ProgressService = ProgressService;
//# sourceMappingURL=progress.service.js.map