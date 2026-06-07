"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const progress_controller_1 = require("@/controllers/progress.controller");
const router = (0, express_1.Router)();
// Apply auth + USER role restrict on all /api/user/progress routes
router.use(auth_1.default);
router.use((0, rbac_1.default)('USER'));
/**
 * Route: POST /api/user/progress/weight
 * Description: Logs a new weight value, updating profile and recalculating target calories.
 */
router.post('/weight', progress_controller_1.ProgressController.logWeight);
/**
 * Route: GET /api/user/progress/history
 * Description: Fetches historical weight logs and daily nutritional adherence scores.
 */
router.get('/history', progress_controller_1.ProgressController.getHistory);
exports.default = router;
//# sourceMappingURL=progress.routes.js.map