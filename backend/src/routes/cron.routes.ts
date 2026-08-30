import { Router, Request, Response } from 'express';
import { CronService } from '@/services/cron.service';
import { timingSafeEqual } from 'crypto';

const router = Router();

function hasValidCronCredential(req: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  const header = req.headers.authorization;
  if (!configuredSecret || !header?.startsWith('Bearer ')) return false;
  const supplied = header.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(configuredSecret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * Route: POST /api/cron/daily-checkin
 * Description: Secure endpoint that aggregates yesterday's macro totals for all active users.
 * Header Guard: Authorization: Bearer <CRON_SECRET>
 */
router.post('/daily-checkin', async (req: Request, res: Response) => {
  try {
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
    if (!hasValidCronCredential(req)) {
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

/**
 * POST /api/cron/weekly-plan-preparation
 * Run once daily. It selects exact shopping-day schedules whose review lead
 * window is due and safely catches up missed runs without duplicate plans.
 */
router.post('/weekly-plan-preparation', async (req: Request, res: Response) => {
  try {
    if (!process.env.CRON_SECRET) {
      return res.status(500).json({ success: false, error: 'Cron server configuration error.' });
    }
    if (!hasValidCronCredential(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const result = await CronService.runWeeklyPlanPreparation();
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Cron execution failed.' });
  }
});

/**
 * POST /api/cron/weekly-checkin-weekend
 * Fires Saturday night → prepares the next Sunday-to-Saturday WEEKLY plan.
 */
router.post('/weekly-checkin-weekend', async (req: Request, res: Response) => {
  try {
    if (!hasValidCronCredential(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const result = await CronService.runWeeklyCheckin('WEEKEND');
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Cron execution failed.' });
  }
});

/**
 * POST /api/cron/weekly-checkin-weekday
 * Fires Sunday night → prepares the next Monday-to-Sunday WEEKLY plan.
 */
router.post('/weekly-checkin-weekday', async (req: Request, res: Response) => {
  try {
    if (!hasValidCronCredential(req)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const result = await CronService.runWeeklyCheckin('WEEKDAY');
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Cron execution failed.' });
  }
});

export default router;
