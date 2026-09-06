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
import { billingOperationsStatusService } from '@/billing/runtime';
import { emptyBodySchema } from '@/validation/onboarding.schemas';
import { CompensationAdminService } from '@/services/compensation-admin.service';
import {
  createCompensationAdjustmentSchema,
  createCompensationPeriodSchema,
  createCompensationPolicySchema,
  decideCompensationAdjustmentSchema,
  prepareCompensationPayoutSchema,
  recordManualPayoutSchema,
  reverseWorkCreditSchema,
} from '@/validation/compensation.schemas';

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

router.get('/compensation', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.getWorkspace() });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve compensation operations.') });
  }
});

router.post('/compensation/policies', validateZodBody(createCompensationPolicySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.createPolicy(req.user!.userId, req.body) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to draft compensation policy.') });
  }
});

router.post('/compensation/policies/:id/activate', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.activatePolicy(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to activate compensation policy.') });
  }
});

router.post('/compensation/periods', validateZodBody(createCompensationPeriodSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.openPeriod(req.user!.userId, req.body) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to open compensation period.') });
  }
});

router.post('/compensation/periods/:id/close', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.closePeriod(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to close compensation period.') });
  }
});

router.post('/compensation/periods/:id/statements', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.generateStatements(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to calculate compensation statements.') });
  }
});

router.post('/compensation/statements/:id/adjustments', validateZodBody(createCompensationAdjustmentSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.createAdjustment(req.user!.userId, req.params.id, req.body) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to propose compensation adjustment.') });
  }
});

router.post('/compensation/adjustments/:id/decision', validateZodBody(decideCompensationAdjustmentSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.decideAdjustment(req.user!.userId, req.params.id, req.body) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to decide compensation adjustment.') });
  }
});

router.post('/compensation/statements/:id/review', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.reviewStatement(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to review compensation statement.') });
  }
});

router.post('/compensation/statements/:id/approve', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.approveStatement(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to approve compensation statement.') });
  }
});

router.post('/compensation/statements/:id/payouts', validateZodBody(prepareCompensationPayoutSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.prepareManualPayout(req.user!.userId, req.params.id, req.body.idempotencyKey) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to prepare manual payout evidence.') });
  }
});

router.post('/compensation/payouts/:id/approve', validateZodBody(emptyBodySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.approveManualPayout(req.user!.userId, req.params.id) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to approve manual payout evidence.') });
  }
});

router.post('/compensation/payouts/:id/record', validateZodBody(recordManualPayoutSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await CompensationAdminService.recordManualPayout(req.user!.userId, req.params.id, req.body.externalReference) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to record off-platform payout evidence.') });
  }
});

router.post('/compensation/work-credits/:id/reverse', validateZodBody(reverseWorkCreditSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(201).json({ success: true, data: await CompensationAdminService.reverseWorkCredit(req.user!.userId, req.params.id, req.body.reversalActionKey, req.body.reasonCode) });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to reverse work credit.') });
  }
});

router.get('/billing-operations', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await billingOperationsStatusService.getStatus();
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to retrieve billing operations.' });
  }
});

export default router;
