"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const grocery_controller_1 = require("@/controllers/grocery.controller");
const router = (0, express_1.Router)();
// Restrict all grocery endpoints to authenticated standard USERs
router.use(auth_1.default);
router.use((0, rbac_1.default)('USER'));
/**
 * Route: POST /api/user/grocery/generate
 * Description: Compiles and creates a grocery list from the active plan.
 */
router.post('/generate', grocery_controller_1.GroceryController.generate);
/**
 * Route: GET /api/user/grocery/current
 * Description: Retrieves the user's active grocery list.
 */
router.get('/current', grocery_controller_1.GroceryController.getCurrent);
/**
 * Route: PATCH /api/user/grocery/items/:id/toggle
 * Description: Toggles checked status of a grocery item.
 */
router.patch('/items/:id/toggle', grocery_controller_1.GroceryController.toggleItem);
exports.default = router;
//# sourceMappingURL=grocery.routes.js.map