import { Router, Request, Response } from 'express';
import { CronService } from '@/services/cron.service';

const router = Router();

/**
 * Route: POST /api/cron/daily-checkin
 * Description: Secure endpoint that aggregates yesterday's macro totals for all active users.
 * Header Guard: Authorization: Bearer <CRON_SECRET>
 */
router.post('/daily-checkin', async (req: Request, res: Response) => {
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
    const result = await CronService.runDailyCheckin();
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[CronRouter] Failed to run daily check-in cron job:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Cron execution failed.',
    });
  }
});

export default router;
