import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { NutritionReportService } from '@/services/nutrition-report.service';
import { UserController } from '@/controllers/user.controller';
import { AuthenticatedRequest } from '@/types';
import { NotificationService } from '@/services/notification.service';
import { WeightLogService } from '@/services/weight-log.service';
import { CheckinService } from '@/services/checkin.service';
import { body } from 'express-validator';
import validate from '@/middleware/validate';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import validateZodBody, { validateZodRequest } from '@/middleware/validateZod';
import { requireReadyUser, requireUserPrerequisites, requireVerifiedUser } from '@/middleware/userPrerequisites';
import {
  consentSchema,
  emptyBodySchema,
  onboardingAllergiesSchema,
  onboardingConditionsSchema,
  onboardingProfileSchema,
  profileSafetySchema,
  shoppingDaySchema,
  structuredSafetyPreviewSchema,
  structuredSafetySaveSchema,
} from '@/validation/onboarding.schemas';
import { weeklyCheckinSchema } from '@/validation/checkin.schemas';
import { z } from 'zod';
import { WaterService } from '@/services/water.service';
import { UserPrivacyService } from '@/services/user-privacy.service';
import { getActivePlanningLocationOptions } from '@/services/food-consumption-context.service';
import multer from 'multer';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';
import {
  clinicalDocumentIdParamsSchema,
  clinicalDocumentMetadataSchema,
  diabetesContextSchema,
} from '@/validation/clinical-evidence.schemas';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const accountDeletionSchema = z
  .object({
    password: z.string().min(8).max(128).optional(),
    googleIdToken: z.string().min(20).max(8192).optional(),
    confirmation: z.union([z.literal('DELETE MY KAINARA ACCOUNT'), z.literal('DELETE MY NUTRIMIND ACCOUNT')]),
  })
  .strict()
  .refine((value) => Boolean(value.password || value.googleIdToken), {
    message: 'Reauthenticate with your password or Google account.',
  });
const clinicalDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
});

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
router.post(
  '/onboarding/profile',
  requireVerifiedUser,
  validateZodBody(onboardingProfileSchema),
  UserController.updateProfile
);
router.get('/onboarding/suggestions', requireVerifiedUser, UserController.getSuggestions);
router.get('/onboarding/planning-locations', requireVerifiedUser, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(200).json({ success: true, data: await getActivePlanningLocationOptions() });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to retrieve meal-planning locations.'),
    });
  }
});
router.post(
  '/onboarding/conditions',
  requireVerifiedUser,
  validateZodBody(onboardingConditionsSchema),
  UserController.updateConditions
);
router.post(
  '/onboarding/allergies',
  requireVerifiedUser,
  validateZodBody(onboardingAllergiesSchema),
  UserController.updateAllergies
);
router.get('/onboarding/safety-catalogue', requireVerifiedUser, UserController.getSafetyCatalogue);
router.post(
  '/onboarding/safety-preview',
  requireVerifiedUser,
  validateZodBody(structuredSafetyPreviewSchema),
  UserController.previewStructuredSafety
);
router.post(
  '/onboarding/safety',
  requireVerifiedUser,
  validateZodBody(structuredSafetySaveSchema),
  UserController.saveStructuredSafety
);
router.post(
  '/onboarding/shopping-day',
  requireVerifiedUser,
  validateZodBody(shoppingDaySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shoppingDayOfWeek } = req.body;
      const { UserService } = await import('@/services/user.service');
      const profile = await UserService.saveShoppingDay(req.user!.userId, shoppingDayOfWeek);
      return res.status(200).json({ success: true, data: profile });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to save shopping day preference.') });
    }
  }
);
router.post('/onboarding/tos', requireVerifiedUser, validateZodBody(consentSchema), UserController.acceptTos);
router.post(
  '/onboarding/complete',
  requireVerifiedUser,
  validateZodBody(emptyBodySchema),
  UserController.completeOnboarding
);

/**
 * Nutrition Report Endpoints
 */
const requireReportEligible = requireUserPrerequisites({
  emailVerified: true,
  onboardingDone: true,
  currentConsent: true,
});
router.get('/nutrition-report', requireReportEligible, UserController.getNutritionReport);
router.get('/nutrition-report/history', requireReportEligible, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await NutritionReportService.getHistory(req.user!.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Could not load report history.') });
  }
});
router.get('/nutrition-report/pdf', requireReportEligible, UserController.downloadNutritionReportPdf);
router.post(
  '/nutrition-report/generate',
  requireReportEligible,
  validateZodBody(emptyBodySchema),
  UserController.generateReport
);
router.post(
  '/nutrition-report/acknowledge',
  requireReportEligible,
  validateZodBody(z.object({ version: z.number().int().positive() }).strict()),
  UserController.acknowledgeReport
);

/**
 * Profile and Account Settings
 * Users must be able to correct the profile that makes a report stale.
 */
router.put('/profile', requireReportEligible, validateZodBody(onboardingProfileSchema), UserController.updateProfile);
router.put(
  '/profile/conditions',
  requireReportEligible,
  validateZodBody(onboardingConditionsSchema),
  UserController.updateConditions
);
router.put(
  '/profile/allergies',
  requireReportEligible,
  validateZodBody(onboardingAllergiesSchema),
  UserController.updateAllergies
);
router.put(
  '/profile/safety',
  requireReportEligible,
  validateZodBody(profileSafetySchema),
  UserController.updateSafetyProfile
);
router.put('/profile/settings', requireReportEligible, UserController.updateAccountSettings);

router.get(
  '/clinical-evidence',
  requireReportEligible,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.workspace(req.user!.userId) });
  })
);
router.put(
  '/clinical-evidence/diabetes-context',
  requireReportEligible,
  validateZodBody(diabetesContextSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.saveDiabetesContext(req.user!.userId, req.body) });
  })
);
router.post(
  '/clinical-evidence/documents',
  requireReportEligible,
  clinicalDocumentUpload.single('document'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Choose a PDF, JPEG, or PNG document.' });
    let facts: unknown = [];
    try {
      facts = req.body.facts ? JSON.parse(req.body.facts) : [];
    } catch {
      return res.status(400).json({ success: false, error: 'Clinical facts must be valid JSON.' });
    }
    const parsed = clinicalDocumentMetadataSchema.safeParse({
      area: req.body.area,
      documentType: req.body.documentType,
      issuedAt: req.body.issuedAt || null,
      issuerName: req.body.issuerName || null,
      supersedesDocumentId: req.body.supersedesDocumentId || null,
      facts,
      consentAccepted: req.body.consentAccepted === 'true',
    });
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid document details.' });
    const metadata = parsed.data;
    const data = await ClinicalEvidenceService.upload({
      userId: req.user!.userId,
      file: req.file,
      ...metadata,
    });
    return res.status(201).json({ success: true, data });
  })
);
router.get(
  '/clinical-evidence/documents/:id/file',
  requireReportEligible,
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = await ClinicalEvidenceService.fileForUser(req.user!.userId, req.params.id);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);
router.delete(
  '/clinical-evidence/documents/:id',
  requireReportEligible,
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.withdraw(req.user!.userId, req.params.id) });
  })
);

// Privacy rights remain available to authenticated patient accounts even when
// onboarding, consent, or report acknowledgement is incomplete.
router.get('/account/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = await UserPrivacyService.exportAccount(req.user!.userId);
    res.setHeader('Content-Disposition', 'attachment; filename=nutrimind-account-export.json');
    return res.status(200).json(payload);
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to export account data.') });
  }
});

router.delete('/account', validateZodBody(accountDeletionSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await UserPrivacyService.deleteAccount(req.user!.userId, {
      password: req.body.password,
      googleIdToken: req.body.googleIdToken,
    });
    res.clearCookie('nutrimind_refresh', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to delete account.') });
  }
});

// Meal-related actions retain the complete readiness chain.
router.use(requireReadyUser);

router.get('/water/today', async (req: AuthenticatedRequest, res: Response) => {
  const data = await WaterService.getToday(req.user!.userId);
  return res.json({ success: true, data });
});
router.post(
  '/water',
  validateZodBody(
    z.object({
      amountMl: z.number().int().min(50).max(2000),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    const data = await WaterService.add(req.user!.userId, req.body.amountMl);
    return res.status(201).json({ success: true, data });
  }
);
router.post(
  '/water/remove',
  validateZodBody(
    z.object({
      amountMl: z.number().int().min(50).max(2000),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    const data = await WaterService.remove(req.user!.userId, req.body.amountMl);
    return res.json({ success: true, data });
  }
);
router.delete('/water/today', async (req: AuthenticatedRequest, res: Response) => {
  const data = await WaterService.resetToday(req.user!.userId);
  return res.json({ success: true, data });
});

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
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve notifications.') });
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
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to mark notification as read.') });
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
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve weight history.') });
  }
});

/**
 * POST /api/user/weight-log
 * Logs a new weight entry.
 */
router.post(
  '/weight-log',
  [
    body('weightKg').isFloat({ min: 30, max: 300 }).withMessage('Weight must be between 30 and 300 kg.').toFloat(),
    body('note')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage('Weight note must be 500 characters or fewer.'),
    validate,
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { weightKg, note } = req.body;
      const entry = await WeightLogService.logWeight(req.user!.userId, weightKg, note);
      return res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to log weight entry.') });
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
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve check-in status.') });
  }
});

/**
 * POST /api/user/checkin/submit
 * Submits a weekly check-in.
 * Body: { changed: boolean, updates?: { weightKg?: number, activityLevel?: string, goal?: string } }
 */
router.post(
  '/checkin/submit',
  validateZodBody(weeklyCheckinSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { changed, updates } = req.body;
      const result = await CheckinService.submitCheckin(req.user!.userId, { changed, updates });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to submit check-in.') });
    }
  }
);

export default router;
