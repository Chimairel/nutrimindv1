"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const admin_service_1 = require("@/services/admin.service");
const sanitizeError_1 = require("@/lib/sanitizeError");
const router = (0, express_1.Router)();
// Apply auth + ADMIN role restriction
router.use(auth_1.default);
router.use((0, rbac_1.default)('ADMIN'));
/**
 * GET /api/admin/analytics
 * Returns platform-wide aggregate statistics.
 */
router.get('/analytics', async (req, res) => {
    try {
        const analytics = await admin_service_1.AdminService.getAnalytics();
        return res.status(200).json({ success: true, data: analytics });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve analytics.') });
    }
});
/**
 * GET /api/admin/users?page=1&limit=20&search=keyword
 * Returns paginated user list with optional search.
 */
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const result = await admin_service_1.AdminService.getUsers(page, limit, search);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve users.') });
    }
});
/**
 * GET /api/admin/nutritionists
 * Returns all nutritionist profiles (pending first).
 */
router.get('/nutritionists', async (req, res) => {
    try {
        const nutritionists = await admin_service_1.AdminService.getNutritionists();
        return res.status(200).json({ success: true, data: nutritionists });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to retrieve nutritionists.') });
    }
});
/**
 * PATCH /api/admin/nutritionists/:id/verify
 * Verifies a nutritionist profile.
 */
router.patch('/nutritionists/:id/verify', async (req, res) => {
    try {
        const result = await admin_service_1.AdminService.verifyNutritionist(req.user.userId, req.params.id);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: (0, sanitizeError_1.sanitizeErrorMessage)(error, 'Failed to verify nutritionist.') });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map