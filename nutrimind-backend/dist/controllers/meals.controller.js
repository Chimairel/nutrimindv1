"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealsController = void 0;
const meal_generation_service_1 = require("@/services/meal-generation.service");
const meal_log_service_1 = require("@/services/meal-log.service");
const meal_swap_service_1 = require("@/services/meal-swap.service");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const client_1 = require("@prisma/client");
const sanitizeError_1 = require("@/lib/sanitizeError");
class MealsController {
    /**
     * POST /api/user/meals/generate
     * Triggers the 7-day plan generation.
     */
    static async generateMealPlan(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            console.log(`[MealsController] Starting meal plan generation for user: ${userId}`);
            const planGroupId = await meal_generation_service_1.MealGenerationService.generatePlanForUser(userId);
            // Fetch and return the newly generated meals
            const meals = await prisma_1.default.mealPlan.findMany({
                where: { planGroupId },
                include: { ingredients: true },
                orderBy: { scheduledDate: 'asc' },
            });
            return res.status(200).json({
                success: true,
                data: {
                    planGroupId,
                    meals,
                },
            });
        }
        catch (error) {
            console.error('[MealsController] generateMealPlan error:', error);
            return res.status(500).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to generate your personalized meal plan.'),
            });
        }
    }
    /**
     * GET /api/user/meals/current
     * Returns current active plan meals grouped by date.
     */
    static async getCurrentPlan(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            // Find the latest non-cancelled plan group
            const latestPlan = await prisma_1.default.mealPlan.findFirst({
                where: {
                    userId,
                    status: { in: [client_1.MealPlanStatus.APPROVED, client_1.MealPlanStatus.PENDING_REVIEW] },
                },
                orderBy: { createdAt: 'desc' },
                select: { planGroupId: true },
            });
            if (!latestPlan) {
                return res.status(200).json({
                    success: true,
                    data: [],
                });
            }
            // Fetch meals and ingredients linked to the plan group
            const meals = await prisma_1.default.mealPlan.findMany({
                where: { planGroupId: latestPlan.planGroupId },
                include: {
                    ingredients: true,
                    mealLogs: {
                        where: { userId },
                    },
                },
                orderBy: { scheduledDate: 'asc' },
            });
            if (meals.length > 0) {
                const lastMeal = meals[meals.length - 1];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const planEndDate = new Date(lastMeal.scheduledDate);
                planEndDate.setHours(0, 0, 0, 0);
                if (planEndDate < today) {
                    return res.status(200).json({
                        success: true,
                        data: [],
                    });
                }
            }
            return res.status(200).json({
                success: true,
                data: meals,
            });
        }
        catch (error) {
            console.error('[MealsController] getCurrentPlan error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve your current meal plan.',
            });
        }
    }
    /**
     * GET /api/user/meals/:id
     * Returns details of a specific meal plan item.
     */
    static async getMealDetails(req, res) {
        try {
            const userId = req.user?.userId;
            const { id } = req.params;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const meal = await prisma_1.default.mealPlan.findFirst({
                where: { id, userId },
                include: {
                    ingredients: true,
                    mealLogs: {
                        where: { userId },
                    },
                },
            });
            if (!meal) {
                return res.status(404).json({ success: false, error: 'Meal not found.' });
            }
            return res.status(200).json({
                success: true,
                data: meal,
            });
        }
        catch (error) {
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
    static async getPlanHistory(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { search, source, status, startDate, endDate } = req.query;
            const where = { userId };
            if (search && typeof search === 'string') {
                where.mealName = {
                    contains: search,
                    mode: 'insensitive',
                };
            }
            if (source && typeof source === 'string') {
                where.source = source;
            }
            if (status && typeof status === 'string' && status !== 'All') {
                where.status = status;
            }
            else {
                where.status = { in: ['DONE', 'SKIPPED'] };
            }
            if (startDate || endDate) {
                where.loggedAt = {};
                if (startDate && typeof startDate === 'string') {
                    where.loggedAt.gte = new Date(startDate);
                }
                if (endDate && typeof endDate === 'string') {
                    where.loggedAt.lte = new Date(endDate);
                }
            }
            // Fetch ALL meal logs for this user (both plan-checked and outside) with search and filters
            const allLogs = await prisma_1.default.mealLog.findMany({
                where,
                include: {
                    mealPlan: {
                        include: {
                            swapLogs: {
                                orderBy: { swappedAt: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { loggedAt: 'desc' },
            });
            // Normalize to unified shape
            const normalized = allLogs.map((l) => {
                const latestSwap = l.mealPlan?.swapLogs?.[0];
                return {
                    id: l.id,
                    mealName: l.mealName,
                    source: l.source, // 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED'
                    calories: l.calories,
                    proteinG: l.proteinG,
                    carbsG: l.carbsG,
                    fatG: l.fatG,
                    dataSource: l.dataSource,
                    status: l.status,
                    warningType: l.warningType ?? null,
                    loggedAt: l.loggedAt.toISOString(),
                    calorieDelta: latestSwap ? latestSwap.calorieDelta : null,
                };
            });
            return res.status(200).json({
                success: true,
                data: normalized,
            });
        }
        catch (error) {
            console.error('[MealsController] getPlanHistory error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve meal history.',
            });
        }
    }
    /**
     * POST /api/user/meals/log-outside
     * Logs an outside meal, performing pre-checks.
     */
    static async logOutsideMeal(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { mealName, mealType, warningAcknowledged, notes } = req.body;
            if (!mealName || !mealType) {
                return res.status(400).json({ success: false, error: 'Missing mealName or mealType parameters.' });
            }
            const result = await meal_log_service_1.MealLogService.logOutsideMeal({
                userId,
                mealName,
                mealType,
                warningAcknowledged,
                notes,
            });
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('[MealsController] logOutsideMeal error:', error);
            return res.status(500).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to check or log outside meal.'),
            });
        }
    }
    /**
     * PATCH /api/user/meals/:id/status
     * Toggles the log status (DONE/SKIPPED) for a scheduled meal plan item.
     */
    static async updateMealStatus(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const mealPlanId = req.params.id;
            const { status } = req.body; // Expects 'DONE' | 'SKIPPED' | 'PENDING'
            if (!status || !['DONE', 'SKIPPED', 'PENDING'].includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid or missing status parameter.' });
            }
            // Find the MealPlan item to fetch macros
            const mealPlan = await prisma_1.default.mealPlan.findFirst({
                where: { id: mealPlanId, userId },
            });
            if (!mealPlan) {
                return res.status(404).json({ success: false, error: 'Meal plan item not found.' });
            }
            // Check if a MealLog record already exists for this scheduled item
            const existingLog = await prisma_1.default.mealLog.findFirst({
                where: { userId, mealPlanId },
            });
            let updatedLog;
            if (existingLog) {
                // Update existing status
                updatedLog = await prisma_1.default.mealLog.update({
                    where: { id: existingLog.id },
                    data: {
                        status: status,
                        source: client_1.MealLogSource.SYSTEM_GENERATED,
                        loggedAt: new Date(), // Keep timestamps sync with active check mark
                    },
                });
            }
            else {
                // Create new log linked to this meal plan
                updatedLog = await prisma_1.default.mealLog.create({
                    data: {
                        userId,
                        mealPlanId,
                        source: client_1.MealLogSource.SYSTEM_GENERATED,
                        mealName: mealPlan.mealName,
                        calories: mealPlan.calories,
                        proteinG: mealPlan.proteinG,
                        carbsG: mealPlan.carbsG,
                        fatG: mealPlan.fatG,
                        dataSource: client_1.MealLogDataSource.FNRI, // Plan meals are FNRI validated
                        status: status,
                        warningType: null,
                        warningShown: false,
                        warningAcknowledged: false,
                    },
                });
            }
            return res.status(200).json({
                success: true,
                data: updatedLog,
            });
        }
        catch (error) {
            console.error('[MealsController] updateMealStatus error:', error);
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
    static async getSwapOptions(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const mealPlanId = req.params.id;
            const options = await meal_swap_service_1.MealSwapService.getEligibleSwapOptions(userId, mealPlanId);
            return res.status(200).json({
                success: true,
                data: options,
            });
        }
        catch (error) {
            console.error('[MealsController] getSwapOptions error:', error);
            return res.status(500).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve swap options.'),
            });
        }
    }
    /**
     * POST /api/user/meals/:id/swap
     * Performs the meal swap.
     */
    static async executeSwap(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const mealPlanId = req.params.id;
            const { newLibraryMealId, warningShown, warningAcknowledged } = req.body;
            if (!newLibraryMealId) {
                return res.status(400).json({ success: false, error: 'Missing newLibraryMealId parameter.' });
            }
            const result = await meal_swap_service_1.MealSwapService.swapMeal(userId, mealPlanId, newLibraryMealId, warningShown, warningAcknowledged);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('[MealsController] executeSwap error:', error);
            const status = (0, sanitizeError_1.sanitizeErrorMessage)(error, '').includes('limit reached') ? 403 : 400;
            return res.status(status).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to execute meal swap.'),
            });
        }
    }
    /**
     * GET /api/user/meals/:id/swap-preview
     * Generates swap calorie warnings.
     */
    static async getSwapPreview(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const mealPlanId = req.params.id;
            const libraryMealId = req.query.libraryMealId;
            if (!libraryMealId) {
                return res.status(400).json({ success: false, error: 'Missing libraryMealId query parameter.' });
            }
            const preview = await meal_swap_service_1.MealSwapService.getSwapPreview(userId, mealPlanId, libraryMealId);
            return res.status(200).json({ success: true, data: preview });
        }
        catch (error) {
            return res.status(400).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to preview swap.') });
        }
    }
    /**
     * GET /api/user/meals/compatible-library
     * Returns all compatible approved library meals for the logged-in user.
     */
    static async getCompatibleLibrary(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const mealType = req.query.mealType;
            const search = req.query.search;
            const meals = await meal_swap_service_1.MealSwapService.getCompatibleLibraryMeals(userId, mealType, search);
            return res.status(200).json({
                success: true,
                data: meals,
            });
        }
        catch (error) {
            console.error('[MealsController] getCompatibleLibrary error:', error);
            return res.status(500).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve compatible meals.'),
            });
        }
    }
}
exports.MealsController = MealsController;
//# sourceMappingURL=meals.controller.js.map