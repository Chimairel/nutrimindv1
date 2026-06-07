"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const calculations_1 = require("@/lib/calculations");
const client_1 = require("@prisma/client");
class UserService {
    /**
     * Updates or creates the user's base profile settings.
     */
    static async updateUserProfile(userId, data) {
        const profile = await prisma_1.default.userProfile.upsert({
            where: { userId },
            update: {
                ...data,
            },
            create: {
                userId,
                ...data,
            },
        });
        return profile;
    }
    /**
     * Updates user health conditions atomically within a transaction.
     */
    static async updateHealthConditions(userId, conditions) {
        // Perform operations in a database transaction to ensure atomicity
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete all existing conditions
            await tx.healthCondition.deleteMany({
                where: { userId },
            });
            // 2. Create the new conditions
            if (conditions.length > 0) {
                await tx.healthCondition.createMany({
                    data: conditions.map((cond) => ({
                        userId,
                        condition: cond,
                    })),
                });
            }
        });
        // Fetch and return updated conditions
        return prisma_1.default.healthCondition.findMany({
            where: { userId },
        });
    }
    /**
     * Updates user allergens atomically within a transaction.
     * Note: The schema model is "Allgy" and field is "allergen".
     */
    static async updateAllergies(userId, allergies) {
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete all existing allergies
            await tx.allgy.deleteMany({
                where: { userId },
            });
            // 2. Create the new allergies
            if (allergies.length > 0) {
                await tx.allgy.createMany({
                    data: allergies.map((allg) => ({
                        userId,
                        allergen: allg,
                    })),
                });
            }
        });
        // Fetch and return updated allergies
        return prisma_1.default.allgy.findMany({
            where: { userId },
        });
    }
    /**
     * Accepts the Terms of Service.
     */
    static async acceptTos(userId) {
        return prisma_1.default.user.update({
            where: { id: userId },
            data: {
                tosAccepted: true,
                tosAcceptedAt: new Date(),
            },
        });
    }
    /**
     * Finalizes user onboarding by:
     * 1. Pulling their latest profile and health conditions.
     * 2. Calculating BMR/TDEE and setting the target daily calories.
     * 3. Updating the profile with the calculated target and setting onboardingDone = true.
     */
    static async completeOnboarding(userId, biologicalSex) {
        // 1. Fetch User profile and clinical conditions
        const profile = await prisma_1.default.userProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new Error('User profile must be initialized before completing onboarding.');
        }
        // Verify critical statistics exist
        const { age, heightCm, weightKg, goal, activityLevel } = profile;
        if (!age || !heightCm || !weightKg || !goal || !activityLevel) {
            throw new Error('Onboarding stats (age, height, weight, goal, activityLevel) are incomplete.');
        }
        const healthConditions = await prisma_1.default.healthCondition.findMany({
            where: { userId },
        });
        const hasPregnantCondition = healthConditions.some((c) => c.condition === client_1.HealthConditionType.PREGNANT);
        // 2. Run calorie target calculations
        const calculations = (0, calculations_1.calculateDailyTarget)({
            age,
            heightCm,
            weightKg,
            goal,
            activityLevel,
            biologicalSex,
            hasPregnantCondition,
        });
        // 3. Persist targets and flag onboarding as complete
        await prisma_1.default.$transaction([
            prisma_1.default.userProfile.update({
                where: { userId },
                data: {
                    dailyCalorieTarget: calculations.dailyCalorieTarget,
                },
            }),
            prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    onboardingDone: true,
                },
            }),
        ]);
        return {
            dailyCalorieTarget: calculations.dailyCalorieTarget,
            onboardingDone: true,
        };
    }
    /**
     * Fetches the complete dynamic User details (with Profile, Conditions, Allergies, NutritionReport)
     * to fully support client-side AuthContext synchronization.
     */
    static async getUserProfileDetails(userId) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                tosAccepted: true,
                tosAcceptedAt: true,
                onboardingDone: true,
                createdAt: true,
                updatedAt: true,
                userProfile: true,
                healthConditions: {
                    select: {
                        condition: true,
                    },
                },
                allergies: {
                    select: {
                        allergen: true,
                    },
                },
                nutritionReport: {
                    select: {
                        id: true,
                        generatedAt: true,
                        acknowledgedAt: true,
                    },
                },
            },
        });
        if (!user) {
            return null;
        }
        // Transform into clean structure for client
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tosAccepted: user.tosAccepted,
            tosAcceptedAt: user.tosAcceptedAt,
            onboardingDone: user.onboardingDone,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            userProfile: user.userProfile,
            healthConditions: user.healthConditions.map((c) => c.condition),
            allergies: user.allergies.map((a) => a.allergen),
            nutritionReport: user.nutritionReport,
        };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map