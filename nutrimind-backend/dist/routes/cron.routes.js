"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cron_service_1 = require("@/services/cron.service");
const router = (0, express_1.Router)();
/**
 * Route: POST /api/cron/daily-checkin
 * Description: Secure endpoint that aggregates yesterday's macro totals for all active users.
 * Header Guard: Authorization: Bearer <CRON_SECRET>
 */
router.post('/daily-checkin', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const systemCronSecret = process.env.CRON_SECRET;
        // 1. Guardrail: Validate server CRON_SECRET is configured
        if (!systemCronSecret) {
            console.error('[CronRouter] CRON_SECRET is not configured in backend environment.');
            return res.status(500).json({
                success: false,
                error: 'Cron server configuration error.',
            });
        }
        // 2. Guardrail: Validate Bearer token format and matching secret values
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Authorization Bearer token is required.',
            });
        }
        const token = authHeader.split(' ')[1];
        if (token !== systemCronSecret) {
            console.warn('[CronRouter] Unauthorized daily check-in trigger attempt with invalid secret.');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid cron token credential.',
            });
        }
        // 3. Execution: Trigger daily adherence calculator
        const result = await cron_service_1.CronService.runDailyCheckin();
        return res.status(200).json(result);
    }
    catch (err) {
        console.error('[CronRouter] Failed to run daily check-in cron job:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Cron execution failed.',
        });
    }
});
/**
 * POST /api/cron/weekly-checkin-weekend
 * Fires Saturday night → notifies + optionally regenerates plans for WEEKEND shoppers.
 */
router.post('/weekly-checkin-weekend', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token || token !== process.env.CRON_SECRET) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        const result = await cron_service_1.CronService.runWeeklyCheckin('WEEKEND');
        return res.status(200).json(result);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Cron execution failed.' });
    }
});
/**
 * POST /api/cron/weekly-checkin-weekday
 * Fires Sunday night → notifies + optionally regenerates plans for WEEKDAY shoppers.
 */
router.post('/weekly-checkin-weekday', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token || token !== process.env.CRON_SECRET) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        const result = await cron_service_1.CronService.runWeeklyCheckin('WEEKDAY');
        return res.status(200).json(result);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Cron execution failed.' });
    }
});
exports.default = router;
//# sourceMappingURL=cron.routes.js.map