"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressController = void 0;
const progress_service_1 = require("@/services/progress.service");
const sanitizeError_1 = require("@/lib/sanitizeError");
class ProgressController {
    /**
     * Logs a new weight log and triggers recalculation of daily calorie targets.
     */
    static async logWeight(req, res) {
        try {
            const userId = req.user?.userId;
            const { weightKg, note } = req.body;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            if (weightKg === undefined || typeof weightKg !== 'number' || weightKg <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid weightKg property (positive number) is required.',
                });
            }
            const weightLog = await progress_service_1.ProgressService.logWeight(userId, weightKg, note);
            return res.status(200).json({
                success: true,
                message: 'Weight logged successfully. Your daily calorie target has been dynamically recalculated.',
                data: weightLog,
            });
        }
        catch (err) {
            console.error('[ProgressController] logWeight error:', err);
            return res.status(400).json({
                success: false,
                error: (0, sanitizeError_1.sanitizeErrorMessage)(err, 'Failed to record weight entry.'),
            });
        }
    }
    /**
     * Retrieves weight and daily nutrition logs history.
     */
    static async getHistory(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized.' });
            }
            const history = await progress_service_1.ProgressService.getProgressHistory(userId);
            return res.status(200).json({
                success: true,
                data: history,
            });
        }
        catch (err) {
            console.error('[ProgressController] getHistory error:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve progress tracking history.',
            });
        }
    }
}
exports.ProgressController = ProgressController;
//# sourceMappingURL=progress.controller.js.map