import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { UserController } from '@/controllers/user.controller';
import { AuthenticatedRequest } from '@/types';
import { NotificationService } from '@/services/notification.service';
import { WeightLogService } from '@/services/weight-log.service';
import { CheckinService } from '@/services/checkin.service';
import { body } from 'express-validator';
import validate from '@/middleware/validate';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();

// Apply auth on all /api/user routes
router.use(authenticate);

/**
 * Route: GET /api/user/profile
 * Description: Retrieves full profile and clinical state details.
 * Available to all authenticated roles (USER, NUTRITIONIST, ADMIN).
 */
router.get('/profile', UserController.getProfile);
router.put('/profile/avatar', UserController.updateAvatar);

// ──────────────────────────────────────────
// Below routes are restricted to USER role
// ──────────────────────────────────────────
router.use(requireRole('USER'));

/**
 * Onboarding Flow Endpoints
 */
router.post('/onboarding/profile', UserController.updateProfile);
router.get('/onboarding/suggestions', UserController.getSuggestions);
router.post('/onboarding/conditions', UserController.updateConditions);
router.post('/onboarding/allergies', UserController.updateAllergies);
router.post('/onboarding/shopping-day', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { shoppingDayGroup } = req.body;
    if (!shoppingDayGroup || !['WEEKEND', 'WEEKDAY'].includes(shoppingDayGroup)) {
      return res.status(400).json({ success: false, error: 'shoppingDayGroup must be WEEKEND or WEEKDAY.' });
    }
    const { UserService } = await import('@/services/user.service');
    const profile = await UserService.saveShoppingDay(req.user!.userId, shoppingDayGroup);
    return res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to save shopping day preference.') });
  }
});
router.post('/onboarding/tos', UserController.acceptTos);
router.post('/onboarding/complete', UserController.completeOnboarding);

/**
 * Nutrition Report Endpoints
 */
router.get('/nutrition-report', UserController.getNutritionReport);
router.get('/nutrition-report/pdf', UserController.downloadNutritionReportPdf);
router.post('/nutrition-report/generate', UserController.generateReport);
router.post('/nutrition-report/acknowledge', UserController.acknowledgeReport);

/**
 * Profile and Account Settings
 */
router.put('/profile', UserController.updateProfile);
router.put('/profile/conditions', UserController.updateConditions);
router.put('/profile/allergies', UserController.updateAllergies);
router.put('/profile/settings', UserController.updateAccountSettings);

// ──────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────

/**
 * GET /api/user/notifications
 * Returns all notifications for the current user.
 */
router.get('/notifications', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await NotificationService.getUserNotifications(req.user!.userId);
    const unreadCount = await NotificationService.getUnreadCount(req.user!.userId);
    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve notifications.') });
  }
});

/**
 * PATCH /api/user/notifications/:id/read
 */
router.patch('/notifications/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NotificationService.markAsRead(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to mark notification as read.') });
  }
});

// ──────────────────────────────────────────
// Weight Log
// ──────────────────────────────────────────

/**
 * GET /api/user/weight-log
 * Returns weight history for charting.
 */
router.get('/weight-log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const history = await WeightLogService.getWeightHistory(req.user!.userId);
    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve weight history.') });
  }
});

/**
 * POST /api/user/weight-log
 * Logs a new weight entry.
 */
router.post(
  '/weight-log',
  [
    body('weightKg').isFloat({ min: 20, max: 300 }).withMessage('Weight must be between 20 and 300 kg.'),
    validate,
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { weightKg, note } = req.body;
      const entry = await WeightLogService.logWeight(req.user!.userId, weightKg, note);
      return res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to log weight entry.') });
    }
  }
);

// ──────────────────────────────────────────
// Weekly Check-In
// ──────────────────────────────────────────

/**
 * GET /api/user/checkin/status
 * Returns check-in status (isDue, streak, lastCheckinAt).
 */
router.get('/checkin/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await CheckinService.getCheckinStatus(req.user!.userId);
    return res.json({ success: true, data: status });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve check-in status.') });
  }
});

/**
 * POST /api/user/checkin/submit
 * Submits a weekly check-in.
 * Body: { changed: boolean, updates?: { weightKg?: number, activityLevel?: string, goal?: string } }
 */
router.post('/checkin/submit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { changed, updates } = req.body;
    const result = await CheckinService.submitCheckin(req.user!.userId, { changed, updates });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to submit check-in.') });
  }
});

export default router;
