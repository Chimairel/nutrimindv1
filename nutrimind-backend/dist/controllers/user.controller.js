"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("@/services/user.service");
const nutrition_report_service_1 = require("@/services/nutrition-report.service");
class UserController {
    /**
     * GET /api/user/profile
     * Returns complete profile details (User + Profile + Conditions + Allergies + NutritionReport status)
     */
    static async getProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
            }
            const profileDetails = await user_service_1.UserService.getUserProfileDetails(userId);
            if (!profileDetails) {
                return res.status(404).json({ success: false, error: 'User details not found.' });
            }
            return res.status(200).json({
                success: true,
                data: profileDetails,
            });
        }
        catch (error) {
            console.error('[UserController] getProfile error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error resolving profile details.' });
        }
    }
    /**
     * POST /api/user/onboarding/profile
     * Saves UserProfile metrics.
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const profile = await user_service_1.UserService.updateUserProfile(userId, req.body);
            return res.status(200).json({
                success: true,
                data: profile,
            });
        }
        catch (error) {
            console.error('[UserController] updateProfile error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update user profile statistics.' });
        }
    }
    /**
     * POST /api/user/onboarding/conditions
     * Saves HealthCondition records.
     */
    static async updateConditions(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { conditions } = req.body;
            if (!Array.isArray(conditions)) {
                return res.status(400).json({ success: false, error: 'Request body must contain an array of conditions.' });
            }
            const savedConditions = await user_service_1.UserService.updateHealthConditions(userId, conditions);
            return res.status(200).json({
                success: true,
                data: savedConditions,
            });
        }
        catch (error) {
            console.error('[UserController] updateConditions error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update clinical health conditions.' });
        }
    }
    /**
     * POST /api/user/onboarding/allergies
     * Saves Allergy records (Allgy model).
     */
    static async updateAllergies(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { allergies } = req.body;
            if (!Array.isArray(allergies)) {
                return res.status(400).json({ success: false, error: 'Request body must contain an array of allergies.' });
            }
            const savedAllergies = await user_service_1.UserService.updateAllergies(userId, allergies);
            return res.status(200).json({
                success: true,
                data: savedAllergies,
            });
        }
        catch (error) {
            console.error('[UserController] updateAllergies error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update food allergens.' });
        }
    }
    /**
     * POST /api/user/onboarding/tos
     * Sets tosAccepted=true.
     */
    static async acceptTos(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const updatedUser = await user_service_1.UserService.acceptTos(userId);
            return res.status(200).json({
                success: true,
                data: {
                    tosAccepted: updatedUser.tosAccepted,
                    tosAcceptedAt: updatedUser.tosAcceptedAt,
                },
            });
        }
        catch (error) {
            console.error('[UserController] acceptTos error:', error);
            return res.status(500).json({ success: false, error: 'Failed to sign Terms of Service agreement.' });
        }
    }
    /**
     * POST /api/user/onboarding/complete
     * Sets onboardingDone=true and calculates dailyCalorieTarget.
     */
    static async completeOnboarding(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { biologicalSex } = req.body;
            const result = await user_service_1.UserService.completeOnboarding(userId, biologicalSex);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('[UserController] completeOnboarding error:', error);
            return res.status(500).json({ success: false, error: error.message || 'Failed to complete user onboarding.' });
        }
    }
    /**
     * GET /api/user/nutrition-report
     * Returns current user report.
     */
    static async getNutritionReport(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const report = await nutrition_report_service_1.NutritionReportService.getReport(userId);
            return res.status(200).json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            console.error('[UserController] getNutritionReport error:', error);
            return res.status(500).json({ success: false, error: 'Failed to retrieve nutrition report.' });
        }
    }
    /**
     * POST /api/user/nutrition-report/generate
     * Generates custom mock report.
     */
    static async generateReport(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const report = await nutrition_report_service_1.NutritionReportService.generateMockReport(userId);
            return res.status(200).json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            console.error('[UserController] generateReport error:', error);
            return res.status(500).json({ success: false, error: error.message || 'Failed to generate nutrition report.' });
        }
    }
    /**
     * POST /api/user/nutrition-report/acknowledge
     * Sets report acknowledgedAt=now.
     */
    static async acknowledgeReport(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const report = await nutrition_report_service_1.NutritionReportService.acknowledgeReport(userId);
            return res.status(200).json({
                success: true,
                data: {
                    acknowledgedAt: report.acknowledgedAt,
                },
            });
        }
        catch (error) {
            console.error('[UserController] acknowledgeReport error:', error);
            return res.status(500).json({ success: false, error: 'Failed to acknowledge nutrition report.' });
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map