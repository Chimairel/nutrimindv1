"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const meals_controller_1 = require("@/controllers/meals.controller");
const router = (0, express_1.Router)();
// Apply auth + USER role restrict on all /api/user/meals routes
router.use(auth_1.default);
router.use((0, rbac_1.default)('USER'));
/**
 * Route: POST /api/user/meals/generate
 * Description: Generates a 7-day, 21-meal plan.
 */
router.post('/generate', meals_controller_1.MealsController.generateMealPlan);
/**
 * Route: GET /api/user/meals/current
 * Description: Returns current active meal plan items.
 */
router.get('/current', meals_controller_1.MealsController.getCurrentPlan);
/**
 * Route: GET /api/user/meals/history
 * Description: Returns all historic meal plans.
 */
router.get('/history', meals_controller_1.MealsController.getPlanHistory);
/**
 * Route: POST /api/user/meals/log-outside
 * Description: Performs AI validation checks and logs outside meals.
 */
router.post('/log-outside', meals_controller_1.MealsController.logOutsideMeal);
/**
 * Route: PATCH /api/user/meals/:id/status
 * Description: Checks off scheduled meals as DONE or SKIPPED.
 */
router.patch('/:id/status', meals_controller_1.MealsController.updateMealStatus);
exports.default = router;
//# sourceMappingURL=meals.routes.js.map