import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import requireEligibleNutritionist from '@/middleware/nutritionistEligibility';
import { certifyMealLibrarySafetySchema } from '@/domain/meal-library-safety-review.schema';
import validateZodBody from '@/middleware/validateZod';
import {
  libraryFlagResolutionSchema,
  libraryMealEditSchema,
  libraryMealFlagSchema,
  nutritionistReviewActionSchema,
} from '@/validation/nutritionist.schemas';

const router = Router();

// Apply auth + NUTRITIONIST role restriction
router.use(authenticate);
router.use(requireRole('NUTRITIONIST'));
router.use(requireEligibleNutritionist);

/**
 * GET /api/nutritionist/queue
 * Returns the review queue (assigned first, sorted by confidence flag).
 */
router.get('/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queue = await NutritionistService.getReviewQueue(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: queue });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve review queue.') });
  }
});

/**
 * GET /api/nutritionist/queue/:id
 * Fetches detailed two-panel review card data, setting/extending the claim lock.
 */
router.get('/queue/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mealPlanId = req.params.id;
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, mealPlanId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    if (sanitizeErrorMessage(error, '').includes('not found')) {
      return res.status(404).json({ success: false, error: sanitizeErrorMessage(error, 'Review card not found.') });
    }
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve review card details.') });
  }
});

/**
 * PATCH /api/nutritionist/review/:id
 * Approve or reject a meal plan.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
router.patch('/review/:id', validateZodBody(nutritionistReviewActionSchema), async (req: AuthenticatedRequest, res: Response) => {
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
    if (msg.includes('already claimed') || msg.includes('already reviewed') || msg.includes('active claim')) {
      return res.status(409).json({ success: false, error: msg });
    }
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/nutritionist/library
 * Browse the MealLibrary with search, filters, and pagination.
 */
router.get('/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, verifiedByMe, page, limit } = req.query;
    const library = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      verifiedByMe: verifiedByMe === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return res.status(200).json({ success: true, data: library });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal library.') });
  }
});

/**
 * POST /api/nutritionist/library/:id/safety-evidence/certify
 * Certify one exact current evidence revision after strict server validation.
 */
router.post('/library/:id/safety-evidence/certify', validateZodBody(certifyMealLibrarySafetySchema), async (req: AuthenticatedRequest, res: Response) => {
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
});

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
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve library meal details.') });
  }
});

/**
 * PATCH /api/nutritionist/library/:id
 * Edit library meal details (Only original verifier or admin override).
 */
router.patch('/library/:id', validateZodBody(libraryMealEditSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await NutritionistService.editLibraryMeal(
      req.user!.userId,
      req.user!.role,
      req.params.id,
      req.body
    );
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to edit library meal.') });
  }
});

/**
 * DELETE /api/nutritionist/library/:id
 * Delete a meal from library (Only original verifier or admin override).
 */
router.delete('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NutritionistService.deleteLibraryMeal(
      req.user!.userId,
      req.user!.role,
      req.params.id
    );
    return res.status(200).json({ success: true, message: 'Meal deleted successfully.' });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to delete library meal.') });
  }
});

/**
 * POST /api/nutritionist/library/:id/flag
 * Flag a meal for re-review (Only allowed if requester is NOT original verifier).
 */
router.post('/library/:id/flag', validateZodBody(libraryMealFlagSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Flag reason is required.' });

    const flag = await NutritionistService.flagLibraryMeal(
      req.user!.userId,
      req.params.id,
      reason
    );
    return res.status(201).json({ success: true, data: flag });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to flag library meal.') });
  }
});

/**
 * PATCH /api/nutritionist/library/:id/resolve-flag
 * Resolve pending flags (Only original verifier or admin override).
 */
router.patch('/library/:id/resolve-flag', validateZodBody(libraryFlagResolutionSchema), async (req: AuthenticatedRequest, res: Response) => {
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
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to resolve library meal flag.') });
  }
});

/**
 * GET /api/nutritionist/approved
 * Returns all meal plans this nutritionist has approved.
 */
router.get('/approved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approved = await NutritionistService.getApprovedMeals(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: approved });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve approved meals.') });
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
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionist profile.') });
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
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to update nutritionist profile.') });
  }
});

export default router;
