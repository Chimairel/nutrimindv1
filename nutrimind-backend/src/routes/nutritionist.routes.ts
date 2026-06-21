import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';

const router = Router();

// Apply auth + NUTRITIONIST role restriction
router.use(authenticate);
router.use(requireRole('NUTRITIONIST'));

/**
 * GET /api/nutritionist/queue
 * Returns the review queue (assigned first, sorted by confidence flag).
 */
router.get('/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    if (!profile) return res.status(404).json({ success: false, error: 'Nutritionist profile not found.' });

    const queue = await NutritionistService.getReviewQueue(profile.id);
    return res.status(200).json({ success: true, data: queue });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/nutritionist/review/:id
 * Approve or reject a meal plan.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
router.patch('/review/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    if (!profile) return res.status(404).json({ success: false, error: 'Nutritionist profile not found.' });

    const { action, note } = req.body;
    const mealPlanId = req.params.id;

    if (action === 'approve') {
      const result = await NutritionistService.approveMealPlan(profile.id, mealPlanId, note);
      return res.status(200).json({ success: true, data: result });
    } else if (action === 'reject') {
      if (!note) return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
      const result = await NutritionistService.rejectMealPlan(profile.id, mealPlanId, note);
      return res.status(200).json({ success: true, data: result });
    } else {
      return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nutritionist/patients
 * Returns list of assigned patients.
 */
router.get('/patients', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    if (!profile) return res.status(404).json({ success: false, error: 'Nutritionist profile not found.' });

    const patients = await NutritionistService.getPatients(profile.id);
    return res.status(200).json({ success: true, data: patients });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/nutritionist/library/:id
 * Edit library meal details (Only original verifier or admin override).
 */
router.patch('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await NutritionistService.editLibraryMeal(
      req.user!.userId,
      req.user!.role,
      req.params.id,
      req.body
    );
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
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
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/nutritionist/library/:id/flag
 * Flag a meal for re-review (Only allowed if requester is NOT original verifier).
 */
router.post('/library/:id/flag', async (req: AuthenticatedRequest, res: Response) => {
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
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/nutritionist/library/:id/resolve-flag
 * Resolve pending flags (Only original verifier or admin override).
 */
router.patch('/library/:id/resolve-flag', async (req: AuthenticatedRequest, res: Response) => {
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
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nutritionist/approved
 * Returns all meal plans this nutritionist has approved.
 */
router.get('/approved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    if (!profile) return res.status(404).json({ success: false, error: 'Nutritionist profile not found.' });

    const approved = await NutritionistService.getApprovedMeals(profile.id);
    return res.status(200).json({ success: true, data: approved });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
