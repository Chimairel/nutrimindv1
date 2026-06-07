"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("@/middleware/auth"));
const fnri_1 = require("@/lib/fnri");
const router = (0, express_1.Router)();
// Secure router under authentication
router.use(auth_1.default);
/**
 * Route: GET /api/fnri/lookup
 * Query: name (The ingredient name search term, e.g. "rice")
 * Description: Executes the 4-step clinical lookup chain to return nutritional statistics.
 */
router.get('/lookup', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing required string query parameter "name".',
            });
        }
        console.log(`[FNRI Route] Invoking lookup for search term: "${name}"`);
        const result = await (0, fnri_1.lookupIngredient)(name);
        return res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('[FNRI Route] Lookup query execution failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to resolve ingredient query details.',
        });
    }
});
exports.default = router;
//# sourceMappingURL=fnri.routes.js.map