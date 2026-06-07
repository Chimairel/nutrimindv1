"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const rbac_1 = __importDefault(require("@/middleware/rbac"));
const router = (0, express_1.Router)();
// Apply auth + NUTRITIONIST role restriction on all /api/nutritionist routes
router.use(auth_1.default);
router.use((0, rbac_1.default)('NUTRITIONIST'));
/**
 * Route: GET /api/nutritionist/profile
 * Description: Placeholder endpoint for nutritionist details.
 */
router.get('/profile', (req, res) => {
    return res.status(200).json({
        success: true,
        data: {
            message: 'Access granted: Nutritionist is authorized.',
            nutritionist: req.user,
        },
    });
});
exports.default = router;
//# sourceMappingURL=nutritionist.routes.js.map