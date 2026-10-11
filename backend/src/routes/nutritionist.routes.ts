import { clinicalClarificationRouter } from './clinical-clarification.routes';
import { mealReviewRouter } from './meal-review.routes';
import { Router, Response } from 'express';
import { AppError } from '@/errors/AppError';
import { z } from 'zod';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import requireEligibleNutritionist from '@/middleware/nutritionistEligibility';
import validateZodBody, { validateZodRequest } from '@/middleware/validateZod';
import {
  nutritionistReviewActionSchema,
  regenerateCandidateSchema,
  replaceAndApproveSchema,
  claimMealReviewSchema,
} from '@/validation/nutritionist.schemas';
import { isNutritionistReviewConflict } from '@/domain/nutritionist-review-http.policy';
import { OutsideMealReviewService } from '@/services/outside-meal-review.service';
import { ObservedMealService } from '@/services/observed-meal.service';
import {
  outsideMealReviewBodySchema,
  outsideMealReviewParamsSchema,
  observedMealAdmissionSchema,
} from '@/validation/user-action.schemas';
import { asyncHandler } from '@/middleware/errorHandler';
import {
  ClearanceDecisionValue,
  ClinicalEvidenceArea,
  HealthConditionType,
  RuleApprovalDecision,
} from '@prisma/client';
import { ConditionClearanceService } from '@/services/condition-clearance.service';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';
import { ClinicalProfileReviewService } from '@/services/clinical-profile-review.service';
import { clinicalDocumentIdParamsSchema, clinicalDocumentReviewSchema } from '@/validation/clinical-evidence.schemas';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { NutritionistWorkCountsService } from '@/services/nutritionist-work-counts.service';
import { NutritionistProfileWorkService } from '@/services/nutritionist-profile-work.service';
import { NutritionistAuditService } from '@/services/nutritionist-audit.service';
import { AuditDetailsService } from '@/services/audit-details.service';

import libraryRouter from './nutritionist-library.routes';
import reviewSwapRouter from './nutritionist-review-swap.routes';

const router = Router();

// Apply auth + NUTRITIONIST role restriction
router.use(authenticate);
router.use(requireRole('NUTRITIONIST'));
router.use(requireEligibleNutritionist);
router.use(clinicalClarificationRouter('rnd'));
router.use(reviewSwapRouter);
router.use('/meal-review-cases', mealReviewRouter('rnd'));

const mealVerificationParams = z
  .object({
    kind: z.enum(['LIBRARY_MEAL', 'RAW_RECIPE', 'GENERATED_RECIPE']),
    id: z.string().min(1),
  })
  .strict();
const mealVerificationDecision = z
  .object({
    decision: z.enum(['VERIFIED', 'REJECTED']),
    rationale: z.string().trim().min(10).max(1000),
  })
  .strict();
const profileReviewParams = z.object({ userId: z.string().min(1) }).strict();
const profileWorkDocumentParams = z.object({ userId: z.string().min(1), id: z.string().min(1) }).strict();
const profileReviewDecision = z
  .object({
    decision: z.enum(['APPROVED', 'DECLINED', 'REQUEST_DETAILS']),
    notes: z.string().trim().min(10).max(2000),
    profileRevision: z.number().int().nonnegative(),
    scopeKey: z.string().min(1).max(10000),
    area: z.nativeEnum(ClinicalEvidenceArea).optional(),
    conditionAssessments: z
      .array(
        z
          .object({
            entryId: z.string().min(1),
            rationale: z.string().trim().min(10).max(2000),
            reviewedDietaryAndTreatmentEffects: z.literal(true),
            reviewedFoodborneIllnessRisk: z.literal(true),
          })
          .strict()
      )
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === 'REQUEST_DETAILS' && !value.area) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['area'],
        message: 'Select the clinical area for the document request.',
      });
    }
  });

router.get(
  '/review-work-counts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await NutritionistWorkCountsService.get(req.nutritionistProfileId!) });
  })
);

router.get(
  '/profile-work',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await NutritionistProfileWorkService.queue(req.nutritionistProfileId!) });
  })
);
router.get(
  '/profile-work/:userId',
  validateZodRequest({ params: profileReviewParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await NutritionistProfileWorkService.detail(req.params.userId, req.nutritionistProfileId!),
    });
  })
);
router.get(
  '/profile-work/:userId/documents/:id',
  validateZodRequest({ params: profileWorkDocumentParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await NutritionistProfileWorkService.assertQueued(req.params.userId, req.nutritionistProfileId!);
    res.json({
      success: true,
      data: await ClinicalEvidenceService.claimForProfileWork(
        req.nutritionistProfileId!,
        req.params.userId,
        req.params.id
      ),
    });
  })
);
router.get(
  '/profile-work/:userId/documents/:id/file',
  validateZodRequest({ params: profileWorkDocumentParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await NutritionistProfileWorkService.assertQueued(req.params.userId, req.nutritionistProfileId!);
    const file = await ClinicalEvidenceService.fileForClaimedProfileWork(
      req.nutritionistProfileId!,
      req.user!.userId,
      req.params.userId,
      req.params.id
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);
router.get(
  '/audit-history',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        mine: z.enum(['true', 'false']).optional(),
      })
      .strict()
      .safeParse(req.query);
    if (!query.success) return res.status(400).json({ success: false, error: 'Check the audit filters.' });
    res.json({
      success: true,
      data: await NutritionistAuditService.history(
        query.data.page,
        query.data.limit,
        undefined,
        query.data.mine === 'true' ? req.user!.userId : undefined
      ),
    });
  })
);
router.get(
  '/audit-history/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = z.string().min(1).max(200).safeParse(req.params.id);
    if (!id.success || Object.keys(req.query).length)
      return res.status(400).json({ success: false, error: 'Invalid audit record.' });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: await AuditDetailsService.detail(id.data, 'nutritionist') });
  })
);

router.get(
  '/profile-reviews',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalProfileReviewService.queue(req.nutritionistProfileId!) });
  })
);
router.get(
  '/profile-reviews/:userId',
  validateZodRequest({ params: profileReviewParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalProfileReviewService.detail(req.params.userId, req.nutritionistProfileId!),
    });
  })
);
router.post(
  '/profile-reviews/:userId/claim',
  validateZodRequest({ params: profileReviewParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalProfileReviewService.claim(req.nutritionistProfileId!, req.params.userId),
    });
  })
);
router.post(
  '/profile-reviews/:userId/release',
  validateZodRequest({ params: profileReviewParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalProfileReviewService.claim(req.nutritionistProfileId!, req.params.userId, true),
    });
  })
);
router.post(
  '/profile-reviews/:userId/decision',
  validateZodRequest({ params: profileReviewParams, body: profileReviewDecision }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalProfileReviewService.decide(
        req.nutritionistProfileId!,
        req.params.userId,
        req.body.decision,
        req.body.notes,
        req.body.area,
        { profileRevision: req.body.profileRevision, scopeKey: req.body.scopeKey },
        req.body.conditionAssessments
      ),
    });
  })
);

router.get(
  '/meal-verification',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await MealBaseVerificationService.list(req.nutritionistProfileId!);
    res.json({ success: true, data });
  })
);
router.post(
  '/meal-verification/:kind/:id/claim',
  validateZodRequest({ params: mealVerificationParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await MealBaseVerificationService.claim(
      req.nutritionistProfileId!,
      req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE',
      req.params.id
    );
    res.json({ success: true, data });
  })
);
router.post(
  '/meal-verification/:kind/:id/release',
  validateZodRequest({ params: mealVerificationParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await MealBaseVerificationService.release(
      req.nutritionistProfileId!,
      req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE',
      req.params.id
    );
    res.json({ success: true });
  })
);
router.post(
  '/meal-verification/:kind/:id/decision',
  validateZodRequest({ params: mealVerificationParams, body: mealVerificationDecision }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await MealBaseVerificationService.decide(
      req.nutritionistProfileId!,
      req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE',
      req.params.id,
      req.body.decision,
      req.body.rationale
    );
    res.json({ success: true, data });
  })
);

router.get(
  '/outside-meal-reviews',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.queue(req.nutritionistProfileId!);
    res.status(200).json({ success: true, data });
  })
);

router.get(
  '/observed-meal-submissions',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({ success: true, data: await ObservedMealService.pending() });
  })
);

router.post(
  '/observed-meal-submissions/:id/admit',
  validateZodRequest({ params: outsideMealReviewParamsSchema, body: observedMealAdmissionSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await ObservedMealService.admit(req.nutritionistProfileId!, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  })
);

router.post(
  '/outside-meal-reviews/:id/claim',
  validateZodRequest({ params: outsideMealReviewParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.claim(req.nutritionistProfileId!, req.params.id);
    res.status(200).json({ success: true, data });
  })
);

router.patch(
  '/outside-meal-reviews/:id',
  validateZodRequest({ params: outsideMealReviewParamsSchema, body: outsideMealReviewBodySchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.resolve(req.nutritionistProfileId!, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  })
);

router.get(
  '/outside-meal-reviews/:id/image',
  validateZodRequest({ params: outsideMealReviewParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const image = await OutsideMealReviewService.imageForClaimedReview(req.nutritionistProfileId!, req.params.id);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(image.buffer);
  })
);

/**
 * GET /api/nutritionist/queue
 * Returns the review queue (assigned first, sorted by confidence flag).
 */
router.get('/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queue = await NutritionistService.getReviewQueue(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: queue });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve review queue.') });
  }
});

router.get(
  '/clinical-evidence',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.queue(req.nutritionistProfileId!) });
  })
);
router.get(
  '/clinical-evidence/:id',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalEvidenceService.claimDetail(req.nutritionistProfileId!, req.params.id),
    });
  })
);
router.get(
  '/clinical-evidence/:id/file',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = await ClinicalEvidenceService.fileForClaimedReview(
      req.nutritionistProfileId!,
      req.user!.userId,
      req.params.id
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);
router.patch(
  '/clinical-evidence/:id',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema, body: clinicalDocumentReviewSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalEvidenceService.review({
        nutritionistProfileId: req.nutritionistProfileId!,
        actorUserId: req.user!.userId,
        documentId: req.params.id,
        ...req.body,
      }),
    });
  })
);

// Historical dispute records remain blocked and auditable; no new adjudication workflow.
const retiredDispute = (_req: AuthenticatedRequest, res: Response) =>
  res.status(410).json({ success: false, code: 'MEAL_DISPUTES_RETIRED', error: 'Meal dispute resolution is retired.' });

router.get('/governance/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.view === 'disputed') return retiredDispute(req, res);
    const view = 'audit';
    const data = await ConditionClearanceService.getGovernanceQueue(req.nutritionistProfileId!, view);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve governance queue.') });
  }
});

const decisionSchema = z.object({
  decision: z.nativeEnum(ClearanceDecisionValue),
  rationale: z.string().trim().max(1000).optional(),
});

router.post(
  '/library/:id/condition-clearances',
  validateZodBody(
    decisionSchema.extend({
      condition: z.nativeEnum(HealthConditionType).refine((value) => value !== HealthConditionType.NONE),
      userScopeId: z.string().trim().min(1).optional().nullable(),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.submitManualDecision({
        nutritionistProfileId: req.nutritionistProfileId!,
        mealLibraryId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Clearance decision failed.') });
    }
  }
);

router.post('/condition-clearances/:id/resolve', retiredDispute);

router.post(
  '/condition-clearances/:id/suspend',
  validateZodBody(z.object({ reason: z.string().trim().min(3).max(240) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.suspendClearance(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.reason
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Suspension failed.') });
    }
  }
);

router.post('/review/:id/dispute-resolution', retiredDispute);

router.post('/rule-policies/:id/impact', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await ConditionClearanceService.generateRulesetImpact(req.nutritionistProfileId!, req.params.id);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Impact analysis failed.') });
  }
});

router.post(
  '/rule-policies/:id/decisions',
  validateZodBody(
    z.object({
      decision: z.nativeEnum(RuleApprovalDecision),
      rationale: z.string().trim().max(1000).optional(),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.approveRulesetVersion({
        nutritionistProfileId: req.nutritionistProfileId!,
        policyVersionId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Ruleset decision failed.') });
    }
  }
);

router.post(
  '/rule-policies/:id/suspend',
  validateZodBody(z.object({ reason: z.string().trim().min(3).max(240) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.suspendRuleset(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.reason
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Ruleset suspension failed.') });
    }
  }
);

/**
 * GET /api/nutritionist/queue/:id
 * Fetches a non-claiming review preview. A separate POST acquires the lock.
 */
router.get('/queue/:id', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const mealPlanId = req.params.id;
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, mealPlanId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    const message = sanitizeErrorMessage(error, 'Failed to retrieve review card details.');
    if (message.includes('not found')) {
      return res.status(404).json({ success: false, error: message });
    }
    if (isNutritionistReviewConflict(message)) {
      return res.status(409).json({ success: false, error: message });
    }
    return res.status(500).json({ success: false, error: message });
  }
});

router.post(
  '/queue/:id/claim',
  validateZodBody(claimMealReviewSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await NutritionistService.getReviewCardDetails(
        req.nutritionistProfileId!,
        req.params.id,
        true,
        req.body.expectedContextKey
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
      const message = sanitizeErrorMessage(error, 'Could not claim this review.');
      return res.status(isNutritionistReviewConflict(message) ? 409 : 422).json({ success: false, error: message });
    }
  }
);

router.post('/queue/:id/release', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.releaseReviewClaim(req.nutritionistProfileId!, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    return res
      .status(409)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Could not release this review.') });
  }
});

router.get(
  '/queue/:id/clinical-evidence/:documentId/file',
  validateZodRequest({
    params: z.object({ id: z.string().min(1).max(200), documentId: z.string().min(1).max(200) }).strict(),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = await ClinicalEvidenceService.fileForClaimedMealReview(
      req.nutritionistProfileId!,
      req.user!.userId,
      req.params.id,
      req.params.documentId
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);

/**
 * PATCH /api/nutritionist/review/:id
 * Approve or reject a meal plan.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
router.patch(
  '/review/:id',
  validateZodBody(nutritionistReviewActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action, note, updates, expectedContextKey, replacementOutcome } = req.body;
      const mealPlanId = req.params.id;

      if (action === 'approve') {
        const result = await NutritionistService.approveMealPlan(
          req.nutritionistProfileId!,
          mealPlanId,
          note,
          updates,
          expectedContextKey
        );
        return res.status(200).json({ success: true, data: result });
      } else if (action === 'reject') {
        if (!note) return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
        const result = await NutritionistService.rejectMealPlan(
          req.nutritionistProfileId!,
          mealPlanId,
          note,
          expectedContextKey,
          replacementOutcome
        );
        return res.status(200).json({ success: true, data: result });
      } else {
        return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
      }
    } catch (error: any) {
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
      const msg = sanitizeErrorMessage(error, 'Failed to process review action.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * POST /api/nutritionist/review/:id/regenerate-candidate
 * Generates an in-flight AI replacement candidate for a rejected meal slot
 * based on negative constraint reasoning.
 */
router.post(
  '/review/:id/regenerate-candidate',
  validateZodBody(regenerateCandidateSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mealPlanId = req.params.id;
      const { reason } = req.body;
      const candidate = await NutritionistService.generateReplacementCandidate(
        req.nutritionistProfileId!,
        mealPlanId,
        reason,
        req.body.expectedContextKey
      );
      return res.status(200).json({ success: true, data: candidate });
    } catch (error: any) {
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
      const msg = sanitizeErrorMessage(error, 'Failed to generate replacement candidate.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * POST /api/nutritionist/review/:id/replace-and-approve
 * Propose a replacement that awaits general verification and case review.
 */
router.post(
  '/review/:id/replace-and-approve',
  validateZodBody(replaceAndApproveSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mealPlanId = req.params.id;
      const result = await NutritionistService.replaceAndApproveMealPlan(
        req.nutritionistProfileId!,
        mealPlanId,
        req.body
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
      const msg = sanitizeErrorMessage(error, 'Failed to replace and approve meal.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

router.use(libraryRouter);

/**
 * GET /api/nutritionist/approved
 * Returns all meal plans this nutritionist has approved.
 */
router.get('/approved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approved = await NutritionistService.getApprovedMeals(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: approved });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve approved meals.') });
  }
});

/**
 * POST /api/nutritionist/approved/:id/reusable-draft
 * Explicit second action: prepare a deduplicated reusable evidence draft from
 * a meal already approved for one user. This does not certify safety.
 */
router.post('/approved/:id/reusable-draft', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.createReusableLibraryDraft(req.nutritionistProfileId!, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = sanitizeErrorMessage(error, 'Failed to prepare reusable meal evidence.');
    if (message.includes('Only the nutritionist')) return res.status(403).json({ success: false, error: message });
    if (message.includes('not found')) return res.status(404).json({ success: false, error: message });
    if (message.includes('Only a current') || message.includes('requires at least')) {
      return res.status(422).json({ success: false, error: message });
    }
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/nutritionist/profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    return res.status(200).json({ success: true, data: { ...profile, user: req.user } });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionist profile.') });
  }
});

/**
 * PATCH /api/nutritionist/profile
 */
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bio, specialization } = req.body;
    const profile = await NutritionistService.updateProfile(req.user!.userId, { bio, specialization });
    return res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to update nutritionist profile.') });
  }
});

export default router;
