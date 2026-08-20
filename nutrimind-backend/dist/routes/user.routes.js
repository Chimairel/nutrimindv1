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
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const user_controller_1 = require("@/controllers/user.controller");
const notification_service_1 = require("@/services/notification.service");
const weight_log_service_1 = require("@/services/weight-log.service");
const checkin_service_1 = require("@/services/checkin.service");
const express_validator_1 = require("express-validator");
const validate_1 = __importDefault(require("@/middleware/validate"));
const sanitizeError_1 = require("@/lib/sanitizeError");
const router = (0, express_1.Router)();
// Apply auth on all /api/user routes
router.use(auth_1.default);
/**
 * Route: GET /api/user/profile
 * Description: Retrieves full profile and clinical state details.
 * Available to all authenticated roles (USER, NUTRITIONIST, ADMIN).
 */
router.get('/profile', user_controller_1.UserController.getProfile);
router.put('/profile/avatar', user_controller_1.UserController.updateAvatar);
// ──────────────────────────────────────────
// Below routes are restricted to USER role
// ──────────────────────────────────────────
router.use((0, rbac_1.default)('USER'));
/**
 * Onboarding Flow Endpoints
 */
router.post('/onboarding/profile', user_controller_1.UserController.updateProfile);
router.get('/onboarding/suggestions', user_controller_1.UserController.getSuggestions);
router.post('/onboarding/conditions', user_controller_1.UserController.updateConditions);
router.post('/onboarding/allergies', user_controller_1.UserController.updateAllergies);
router.post('/onboarding/shopping-day', async (req, res) => {
    try {
        const { shoppingDayGroup } = req.body;
        if (!shoppingDayGroup || !['WEEKEND', 'WEEKDAY'].includes(shoppingDayGroup)) {
            return res.status(400).json({ success: false, error: 'shoppingDayGroup must be WEEKEND or WEEKDAY.' });
        }
        const { UserService } = await Promise.resolve().then(() => __importStar(require('@/services/user.service')));
        const profile = await UserService.saveShoppingDay(req.user.userId, shoppingDayGroup);
        return res.status(200).json({ success: true, data: profile });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to save shopping day preference.') });
    }
});
router.post('/onboarding/tos', user_controller_1.UserController.acceptTos);
router.post('/onboarding/complete', user_controller_1.UserController.completeOnboarding);
/**
 * Nutrition Report Endpoints
 */
router.get('/nutrition-report', user_controller_1.UserController.getNutritionReport);
router.get('/nutrition-report/pdf', user_controller_1.UserController.downloadNutritionReportPdf);
router.post('/nutrition-report/generate', user_controller_1.UserController.generateReport);
router.post('/nutrition-report/acknowledge', user_controller_1.UserController.acknowledgeReport);
/**
 * Profile and Account Settings
 */
router.put('/profile', user_controller_1.UserController.updateProfile);
router.put('/profile/conditions', user_controller_1.UserController.updateConditions);
router.put('/profile/allergies', user_controller_1.UserController.updateAllergies);
router.put('/profile/settings', user_controller_1.UserController.updateAccountSettings);
// ──────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────
/**
 * GET /api/user/notifications
 * Returns all notifications for the current user.
 */
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await notification_service_1.NotificationService.getUserNotifications(req.user.userId);
        const unreadCount = await notification_service_1.NotificationService.getUnreadCount(req.user.userId);
        return res.json({ success: true, data: { notifications, unreadCount } });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve notifications.') });
    }
});
/**
 * PATCH /api/user/notifications/:id/read
 */
router.patch('/notifications/:id/read', async (req, res) => {
    try {
        await notification_service_1.NotificationService.markAsRead(req.user.userId, req.params.id);
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to mark notification as read.') });
    }
});
// ──────────────────────────────────────────
// Weight Log
// ──────────────────────────────────────────
/**
 * GET /api/user/weight-log
 * Returns weight history for charting.
 */
router.get('/weight-log', async (req, res) => {
    try {
        const history = await weight_log_service_1.WeightLogService.getWeightHistory(req.user.userId);
        return res.json({ success: true, data: history });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve weight history.') });
    }
});
/**
 * POST /api/user/weight-log
 * Logs a new weight entry.
 */
router.post('/weight-log', [
    (0, express_validator_1.body)('weightKg').isFloat({ min: 20, max: 300 }).withMessage('Weight must be between 20 and 300 kg.'),
    validate_1.default,
], async (req, res) => {
    try {
        const { weightKg, note } = req.body;
        const entry = await weight_log_service_1.WeightLogService.logWeight(req.user.userId, weightKg, note);
        return res.status(201).json({ success: true, data: entry });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to log weight entry.') });
    }
});
// ──────────────────────────────────────────
// Weekly Check-In
// ──────────────────────────────────────────
/**
 * GET /api/user/checkin/status
 * Returns check-in status (isDue, streak, lastCheckinAt).
 */
router.get('/checkin/status', async (req, res) => {
    try {
        const status = await checkin_service_1.CheckinService.getCheckinStatus(req.user.userId);
        return res.json({ success: true, data: status });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve check-in status.') });
    }
});
/**
 * POST /api/user/checkin/submit
 * Submits a weekly check-in.
 * Body: { changed: boolean, updates?: { weightKg?: number, activityLevel?: string, goal?: string } }
 */
router.post('/checkin/submit', async (req, res) => {
    try {
        const { changed, updates } = req.body;
        const result = await checkin_service_1.CheckinService.submitCheckin(req.user.userId, { changed, updates });
        return res.json({ success: true, data: result });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to submit check-in.') });
    }
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map