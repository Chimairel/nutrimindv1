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
exports.UserController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const user_service_1 = require("@/services/user.service");
const nutrition_report_service_1 = require("@/services/nutrition-report.service");
const sanitizeError_1 = require("@/lib/sanitizeError");
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
            // Convert number fields to floats/ints if they are passed as strings
            const data = { ...req.body };
            if (data.age)
                data.age = parseInt(data.age);
            if (data.heightCm)
                data.heightCm = parseFloat(data.heightCm);
            if (data.weightKg)
                data.weightKg = parseFloat(data.weightKg);
            if (data.targetWeightKg)
                data.targetWeightKg = parseFloat(data.targetWeightKg);
            const profile = await user_service_1.UserService.updateUserProfile(userId, data);
            const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
            if (user?.onboardingDone) {
                await user_service_1.UserService.completeOnboarding(userId);
            }
            const profileDetails = await user_service_1.UserService.getUserProfileDetails(userId);
            return res.status(200).json({
                success: true,
                data: profileDetails,
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
            const { conditions, otherConditions } = req.body;
            if (!Array.isArray(conditions)) {
                return res.status(400).json({ success: false, error: 'Request body must contain an array of conditions.' });
            }
            const savedConditions = await user_service_1.UserService.updateHealthConditions(userId, conditions);
            // Validate otherConditions free text
            if (typeof otherConditions === 'string' && otherConditions.trim()) {
                const rawConditions = otherConditions.split(',').map((c) => c.trim()).filter(Boolean);
                const { COMMON_CONDITIONS, HealthValidationService } = await Promise.resolve().then(() => __importStar(require('@/services/health-validation.service')));
                const normalizedList = [];
                for (const rawCond of rawConditions) {
                    const exactMatch = COMMON_CONDITIONS.find((c) => c.toLowerCase() === rawCond.toLowerCase());
                    if (exactMatch) {
                        normalizedList.push(exactMatch);
                    }
                    else {
                        try {
                            const normalized = await HealthValidationService.normalizeHealthInput(rawCond, 'condition');
                            if (normalized === 'INVALID') {
                                return res.status(400).json({
                                    success: false,
                                    error: `We couldn't recognize "${rawCond}" as a health condition. Please check your spelling, or describe it differently.`,
                                    errorCode: 'UNRECOGNIZED_INPUT',
                                });
                            }
                            normalizedList.push(normalized);
                        }
                        catch (err) {
                            console.error('[UserController] Normalization service error:', err);
                            return res.status(503).json({
                                success: false,
                                error: 'The health validation service is temporarily unavailable. Please try again in a few moments.',
                                errorCode: 'VALIDATION_SERVICE_UNAVAILABLE',
                            });
                        }
                    }
                }
                await user_service_1.UserService.updateOtherConditions(userId, normalizedList.join(', '));
            }
            else {
                await user_service_1.UserService.updateOtherConditions(userId, '');
            }
            await user_service_1.UserService.runSafetyRecheck(userId);
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
     * Saves Allergy records.
     */
    static async updateAllergies(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { allergies, otherAllergies } = req.body;
            if (!Array.isArray(allergies)) {
                return res.status(400).json({ success: false, error: 'Request body must contain an array of allergies.' });
            }
            const savedAllergies = await user_service_1.UserService.updateAllergies(userId, allergies);
            // Validate otherAllergies free text
            if (typeof otherAllergies === 'string' && otherAllergies.trim()) {
                const rawAllergies = otherAllergies.split(',').map((a) => a.trim()).filter(Boolean);
                const { COMMON_ALLERGIES, HealthValidationService } = await Promise.resolve().then(() => __importStar(require('@/services/health-validation.service')));
                const normalizedList = [];
                for (const rawAller of rawAllergies) {
                    const exactMatch = COMMON_ALLERGIES.find((a) => a.toLowerCase() === rawAller.toLowerCase());
                    if (exactMatch) {
                        normalizedList.push(exactMatch);
                    }
                    else {
                        try {
                            const normalized = await HealthValidationService.normalizeHealthInput(rawAller, 'allergy');
                            if (normalized === 'INVALID') {
                                return res.status(400).json({
                                    success: false,
                                    error: `We couldn't recognize "${rawAller}" as a food allergen. Please check your spelling, or describe it differently.`,
                                    errorCode: 'UNRECOGNIZED_INPUT',
                                });
                            }
                            normalizedList.push(normalized);
                        }
                        catch (err) {
                            console.error('[UserController] Normalization service error:', err);
                            return res.status(503).json({
                                success: false,
                                error: 'The allergy validation service is temporarily unavailable. Please try again in a few moments.',
                                errorCode: 'VALIDATION_SERVICE_UNAVAILABLE',
                            });
                        }
                    }
                }
                await user_service_1.UserService.updateOtherAllergies(userId, normalizedList.join(', '));
            }
            else {
                await user_service_1.UserService.updateOtherAllergies(userId, '');
            }
            await user_service_1.UserService.runSafetyRecheck(userId);
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
            const result = await user_service_1.UserService.completeOnboarding(userId);
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            console.error('[UserController] completeOnboarding error:', error);
            return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to complete user onboarding.') });
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
     * GET /api/user/nutrition-report/pdf
     * Streams the nutrition report as a PDF
     */
    static async downloadNutritionReportPdf(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const report = await nutrition_report_service_1.NutritionReportService.getReport(userId);
            if (!report) {
                return res.status(404).json({ success: false, error: 'Report not found.' });
            }
            const userDetails = await user_service_1.UserService.getUserProfileDetails(userId);
            if (!userDetails) {
                return res.status(404).json({ success: false, error: 'User details not found.' });
            }
            const React = await Promise.resolve().then(() => __importStar(require('react')));
            const { NutritionReportPDF, streamPdf } = await Promise.resolve().then(() => __importStar(require('@/lib/pdf')));
            const document = React.createElement(NutritionReportPDF, { user: userDetails, report });
            const stream = await streamPdf(document);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=nutrimind-report.pdf');
            stream.pipe(res);
        }
        catch (error) {
            console.error('[UserController] downloadNutritionReportPdf error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
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
            const report = await nutrition_report_service_1.NutritionReportService.generateReport(userId);
            return res.status(200).json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            console.error('[UserController] generateReport error:', error);
            return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to generate nutrition report.') });
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
    /**
     * PUT /api/user/profile/settings
     * Updates core account credentials (name, email) and optionally password.
     */
    static async updateAccountSettings(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const { name, email, currentPassword, newPassword } = req.body;
            // Fetch user to check password and email uniqueness
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found.' });
            }
            const updateData = {};
            if (name && typeof name === 'string') {
                updateData.name = name.trim();
            }
            if (email && typeof email === 'string') {
                const sanitizedEmail = email.trim().toLowerCase();
                if (sanitizedEmail !== user.email) {
                    // Check uniqueness
                    const existingUser = await prisma_1.default.user.findUnique({
                        where: { email: sanitizedEmail },
                    });
                    if (existingUser) {
                        return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
                    }
                    updateData.email = sanitizedEmail;
                }
            }
            // Handle password change if requested
            if (currentPassword || newPassword) {
                if (!currentPassword || !newPassword) {
                    return res.status(400).json({ success: false, error: 'Both current password and new password are required to change your password.' });
                }
                // Verify current password
                const isPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
                if (!isPasswordValid) {
                    return res.status(400).json({ success: false, error: 'Incorrect current password.' });
                }
                // Validate new password strength: length >= 8, >= 1 uppercase, >= 1 number
                const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
                if (!passwordRegex.test(newPassword)) {
                    return res.status(400).json({
                        success: false,
                        error: 'New password must be at least 8 characters long, contain at least one uppercase letter, and at least one number.',
                    });
                }
                // Hash new password
                const salt = await bcryptjs_1.default.genSalt(12);
                updateData.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
            }
            // Save changes
            const updatedUser = await prisma_1.default.user.update({
                where: { id: userId },
                data: updateData,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    onboardingDone: true,
                },
            });
            return res.status(200).json({
                success: true,
                message: 'Account settings updated successfully.',
                data: updatedUser,
            });
        }
        catch (error) {
            console.error('[UserController] updateAccountSettings error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update account settings.' });
        }
    }
    /**
     * PUT /api/user/profile/avatar
     * Updates User's avatar seed (stored in image field)
     */
    static async updateAvatar(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
            }
            const { image } = req.body;
            if (typeof image !== 'string') {
                return res.status(400).json({ success: false, error: 'image seed is required.' });
            }
            const updatedUser = await user_service_1.UserService.updateUserImage(userId, image);
            return res.status(200).json({
                success: true,
                data: {
                    image: updatedUser.image,
                },
            });
        }
        catch (error) {
            console.error('[UserController] updateAvatar error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update user avatar.' });
        }
    }
    /**
     * GET /api/user/onboarding/suggestions
     * Returns curated lists of common clinical conditions and food allergens for autocompleting.
     */
    static async getSuggestions(req, res) {
        try {
            const { COMMON_CONDITIONS, COMMON_ALLERGIES } = await Promise.resolve().then(() => __importStar(require('@/services/health-validation.service')));
            return res.status(200).json({
                success: true,
                data: {
                    conditions: COMMON_CONDITIONS,
                    allergies: COMMON_ALLERGIES,
                },
            });
        }
        catch (error) {
            console.error('[UserController] getSuggestions error:', error);
            return res.status(500).json({ success: false, error: 'Failed to retrieve autocomplete suggestions.' });
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map