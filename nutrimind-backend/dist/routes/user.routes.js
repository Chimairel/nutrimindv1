"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const user_controller_1 = require("@/controllers/user.controller");
const router = (0, express_1.Router)();
// Apply auth + USER role restrictions on all /api/user routes
router.use(auth_1.default);
router.use((0, rbac_1.default)('USER'));
/**
 * Route: GET /api/user/profile
 * Description: Retrieves full profile and clinical state details.
 */
router.get('/profile', user_controller_1.UserController.getProfile);
/**
 * Onboarding Flow Endpoints
 */
router.post('/onboarding/profile', user_controller_1.UserController.updateProfile);
router.post('/onboarding/conditions', user_controller_1.UserController.updateConditions);
router.post('/onboarding/allergies', user_controller_1.UserController.updateAllergies);
router.post('/onboarding/tos', user_controller_1.UserController.acceptTos);
router.post('/onboarding/complete', user_controller_1.UserController.completeOnboarding);
/**
 * Nutrition Report Endpoints
 */
router.get('/nutrition-report', user_controller_1.UserController.getNutritionReport);
router.post('/nutrition-report/generate', user_controller_1.UserController.generateReport);
router.post('/nutrition-report/acknowledge', user_controller_1.UserController.acknowledgeReport);
exports.default = router;
//# sourceMappingURL=user.routes.js.map