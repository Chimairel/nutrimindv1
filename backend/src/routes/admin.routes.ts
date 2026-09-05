import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { AdminService } from '@/services/admin.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { validateZodBody } from '@/middleware/validateZod';
import NutritionistApplicationService from '@/services/nutritionist-application.service';
import {
  applicationDecisionSchema,
  applicationScheduleSchema,
  applicationStageSchema,
} from '@/validation/nutritionist-application.schemas';

const router = Router();

// Apply auth + ADMIN role restriction
router.use(authenticate);
router.use(requireRole('ADMIN'));

/**
 * GET /api/admin/analytics
 * Returns platform-wide aggregate statistics.
 */
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await AdminService.getAnalytics();
    return res.status(200).json({ success: true, data: analytics });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve analytics.') });
  }
});

/**
 * GET /api/admin/users?page=1&limit=20&search=keyword
 * Returns paginated user list with optional search.
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await AdminService.getUsers(page, limit, search);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve users.') });
  }
});

/**
 * GET /api/admin/nutritionists
 * Returns all nutritionist profiles (pending first).
 */
router.get('/nutritionists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nutritionists = await AdminService.getNutritionists();
    return res.status(200).json({ success: true, data: nutritionists });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionists.') });
  }
});

/**
 * PATCH /api/admin/nutritionists/:id/verify
 * Verifies a nutritionist profile.
 */
router.patch('/nutritionists/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AdminService.verifyNutritionist(req.user!.userId, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to verify nutritionist.') });
  }
});

router.get('/nutritionist-applications', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await NutritionistApplicationService.listForAdmin();
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionist applications.') });
  }
});

router.patch(
  '/nutritionist-applications/:id/stage',
  validateZodBody(applicationStageSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistApplicationService.setStage(
        req.user!.userId,
        req.params.id,
        req.body.status,
        req.body.adminNotes
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to advance application.') });
    }
  }
);

router.patch(
  '/nutritionist-applications/:id/schedule',
  validateZodBody(applicationScheduleSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistApplicationService.scheduleCall(req.user!.userId, req.params.id, req.body);
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to schedule verification call.') });
    }
  }
);

router.patch(
  '/nutritionist-applications/:id/decision',
  validateZodBody(applicationDecisionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistApplicationService.decide(req.user!.userId, req.params.id, req.body);
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to record application decision.') });
    }
  }
);

router.post('/nutritionist-applications/:id/resend-invitation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await NutritionistApplicationService.resendInvitation(req.user!.userId, req.params.id);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to resend invitation.') });
  }
});

router.patch('/users/:id/suspension', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { suspended, reason } = req.body as { suspended?: unknown; reason?: unknown };
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ success: false, error: 'suspended must be a boolean.' });
    }
    if (reason !== undefined && typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'reason must be a string.' });
    }
    const result = await AdminService.setUserSuspension(
      req.user!.userId,
      req.params.id,
      suspended,
      typeof reason === 'string' ? reason.slice(0, 240) : undefined
    );
    return res.json({ success: true, data: result });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to update account status.') });
  }
});

router.get('/audit-events', async (req: AuthenticatedRequest, res: Response) => {
  const data = await AdminService.getAuditEvents(Number(req.query.page) || 1, Number(req.query.limit) || 50);
  return res.json({ success: true, data });
});

router.get('/safety-incidents', async (_req: AuthenticatedRequest, res: Response) => {
  const data = await AdminService.getSafetyIncidents();
  return res.json({ success: true, data });
});

router.get('/structured-safety-operations', async (_req: AuthenticatedRequest, res: Response) => {
  const data = await AdminService.getStructuredSafetyOperations();
  return res.json({ success: true, data });
});

export default router;
