import { Router, Response } from 'express';
import { z } from 'zod';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import requireEligibleNutritionist from '@/middleware/nutritionistEligibility';
import { certifyMealLibrarySafetySchema } from '@/domain/meal-library-safety-review.schema';
import validateZodBody, { validateZodRequest } from '@/middleware/validateZod';
import {
  libraryFlagResolutionSchema,
  libraryMealEditSchema,
  libraryMealFlagSchema,
  nutritionistReviewActionSchema,
  regenerateCandidateSchema,
  replaceAndApproveSchema,
} from '@/validation/nutritionist.schemas';
import { NutritionistCompensationService } from '@/services/compensation-admin.service';
import { isNutritionistReviewConflict } from '@/domain/nutritionist-review-http.policy';
import { OutsideMealReviewService } from '@/services/outside-meal-review.service';
import { ObservedMealService } from '@/services/observed-meal.service';
import {
  outsideMealReviewBodySchema,
  outsideMealReviewParamsSchema,
  observedMealAdmissionSchema,
} from '@/validation/user-action.schemas';
import { asyncHandler } from '@/middleware/errorHandler';
import { ClearanceDecisionValue, HealthConditionType, RuleApprovalDecision } from '@prisma/client';
import { ConditionClearanceService } from '@/services/condition-clearance.service';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';
import {
  clinicalDocumentIdParamsSchema,
  clinicalDocumentReviewSchema,
} from '@/validation/clinical-evidence.schemas';

const router = Router();

// Apply auth + NUTRITIONIST role restriction
router.use(authenticate);
router.use(requireRole('NUTRITIONIST'));
router.use(requireEligibleNutritionist);

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
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.queue() });
  })
);
router.get(
  '/clinical-evidence/:id',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.claimDetail(req.nutritionistProfileId!, req.params.id) });
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

router.get('/governance/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const view = req.query.view === 'disputed' ? 'disputed' : 'audit';
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

router.post(
  '/condition-clearances/:id/resolve',
  validateZodBody(decisionSchema.extend({ rationale: z.string().trim().min(1).max(1000) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.resolveDispute({
        nutritionistProfileId: req.nutritionistProfileId!,
        clearanceId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Dispute resolution failed.') });
    }
  }
);

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

router.post(
  '/review/:id/dispute-resolution',
  validateZodBody(
    z.object({
      decision: z.enum(['APPROVE', 'REJECT']),
      rationale: z.string().trim().min(3).max(1000),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistService.resolveMealPlanDispute(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.decision,
        req.body.rationale
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Adjudication failed.') });
    }
  }
);

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
  try {
    const mealPlanId = req.params.id;
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, mealPlanId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
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

router.post('/queue/:id/claim', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, req.params.id, true);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = sanitizeErrorMessage(error, 'Could not claim this review.');
    return res.status(isNutritionistReviewConflict(message) ? 409 : 422).json({ success: false, error: message });
  }
});

router.post('/queue/:id/release', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.releaseReviewClaim(req.nutritionistProfileId!, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not release this review.') });
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
      const { action, note, updates } = req.body;
      const mealPlanId = req.params.id;

      if (action === 'approve') {
        const result = await NutritionistService.approveMealPlan(req.nutritionistProfileId!, mealPlanId, note, updates);
        return res.status(200).json({ success: true, data: result });
      } else if (action === 'reject') {
        if (!note) return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
        const result = await NutritionistService.rejectMealPlan(req.nutritionistProfileId!, mealPlanId, note);
        return res.status(200).json({ success: true, data: result });
      } else {
        return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
      }
    } catch (error: any) {
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
        reason
      );
      return res.status(200).json({ success: true, data: candidate });
    } catch (error: any) {
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
 * Atomically replaces the rejected meal with the approved candidate,
 * certifying the replacement immediately for zero-pending patient delivery.
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
      const msg = sanitizeErrorMessage(error, 'Failed to replace and approve meal.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * GET /api/nutritionist/library
 * Browse the MealLibrary with search, filters, and pagination.
 */
router.get('/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, verifiedByMe, adminDraftsOnly, page, limit } = req.query;
    const library = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      verifiedByMe: verifiedByMe === 'true',
      adminDraftsOnly: adminDraftsOnly === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return res.status(200).json({ success: true, data: library });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal library.') });
  }
});

router.get('/library-coverage', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = await NutritionistService.getMealLibraryCoverage();
    return res.status(200).json({ success: true, data: coverage });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal-library coverage.') });
  }
});

/**
 * POST /api/nutritionist/library/:id/safety-evidence/certify
 * Certify one exact current evidence revision after strict server validation.
 */
router.post(
  '/library/:id/safety-evidence/certify',
  validateZodBody(certifyMealLibrarySafetySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const meal = await NutritionistService.certifyLibraryMealSafety(
        req.nutritionistProfileId!,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: meal });
    } catch (error: any) {
      const message = sanitizeErrorMessage(error, 'Failed to certify meal safety evidence.');
      if (message.includes('revision conflict') || message.includes('Flagged or archived')) {
        return res.status(409).json({ success: false, error: message });
      }
      if (message.includes('requires') || message.includes('must be resolved')) {
        return res.status(422).json({ success: false, error: message });
      }
      if (message.includes('Only a currently verified')) {
        return res.status(403).json({ success: false, error: message });
      }
      if (message.includes('not found')) {
        return res.status(404).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/nutritionist/library/:id
 * Retrieve details of a single library meal.
 */
router.get('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meal = await NutritionistService.getLibraryMeal(req.params.id);
    if (!meal) return res.status(404).json({ success: false, error: 'Meal not found.' });
    return res.status(200).json({ success: true, data: meal });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve library meal details.') });
  }
});

/**
 * PATCH /api/nutritionist/library/:id
 * Edit library meal details (Only original verifier or admin override).
 */
router.patch(
  '/library/:id',
  validateZodBody(libraryMealEditSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await NutritionistService.editLibraryMeal(
        req.user!.userId,
        req.user!.role,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to edit library meal.') });
    }
  }
);

/**
 * DELETE /api/nutritionist/library/:id
 * Delete a meal from library (Only original verifier or admin override).
 */
router.delete('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NutritionistService.deleteLibraryMeal(req.user!.userId, req.user!.role, req.params.id);
    return res.status(200).json({ success: true, message: 'Meal deleted successfully.' });
  } catch (error: any) {
    return res
      .status(400)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to delete library meal.') });
  }
});

/**
 * POST /api/nutritionist/library/:id/flag
 * Flag a meal for re-review (Only allowed if requester is NOT original verifier).
 */
router.post(
  '/library/:id/flag',
  validateZodBody(libraryMealFlagSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ success: false, error: 'Flag reason is required.' });

      const flag = await NutritionistService.flagLibraryMeal(req.user!.userId, req.params.id, reason);
      return res.status(201).json({ success: true, data: flag });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to flag library meal.') });
    }
  }
);

/**
 * PATCH /api/nutritionist/library/:id/resolve-flag
 * Resolve pending flags (Only original verifier or admin override).
 */
router.patch(
  '/library/:id/resolve-flag',
  validateZodBody(libraryFlagResolutionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { resolution, updatedFields } = req.body;
      if (!resolution) return res.status(400).json({ success: false, error: 'Resolution action is required.' });

      const result = await NutritionistService.resolveLibraryMealFlag(
        req.user!.userId,
        req.user!.role,
        req.params.id,
        resolution,
        updatedFields
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to resolve library meal flag.') });
    }
  }
);

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

router.get('/compensation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await NutritionistCompensationService.getOwn(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve your compensation records.') });
  }
});

const updatePayoutMethodSchema = z.object({
  channel: z.enum(['GCASH', 'MAYA', 'BPI', 'BDO', 'UNIONBANK', 'OTHER']),
  accountName: z.string().trim().min(1, 'Account name is required.').max(120),
  accountNumber: z.string().trim().min(4, 'Account or mobile number is required.').max(50),
  bankName: z.string().trim().max(80).optional().nullable(),
});

router.patch(
  '/compensation/payout-method',
  validateZodBody(updatePayoutMethodSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistCompensationService.updatePayoutMethod(req.nutritionistProfileId!, req.body);
      return res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to update payout method.') });
    }
  }
);

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
