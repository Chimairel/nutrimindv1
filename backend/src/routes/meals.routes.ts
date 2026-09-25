import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { MealsController } from '@/controllers/meals.controller';
import { requireReadyUser } from '@/middleware/userPrerequisites';
import requireClinicalEvidenceReady from '@/middleware/clinicalEvidenceReady';
import { PlanningReadinessService } from '@/services/planning-readiness.service';
import type { AuthenticatedRequest } from '@/types';
import { validateZodRequest } from '@/middleware/validateZod';
import {
  compatibleLibraryQuerySchema,
  mealGenerationBodySchema,
  mealStatusBodySchema,
  outsideMealBodySchema,
  outsideMealSuggestionsQuerySchema,
  outsideMealItemParamsSchema,
  outsideMealItemEditSchema,
  outsideMealVoidSchema,
  outsideMealReplySchema,
  observedMealConsentSchema,
  resourceIdParamsSchema,
  swapMealBodySchema,
  swapPreviewQuerySchema,
  updateMealLogNotesBodySchema,
} from '@/validation/user-action.schemas';

const router = Router();
const outsideImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

// Apply auth + USER role restrict on all /api/user/meals routes
router.use(authenticate);
router.use(requireRole('USER'));
router.use(requireReadyUser);

router.get('/readiness', async (req, res) => {
  try {
    const data = await PlanningReadinessService.getForUser((req as AuthenticatedRequest).user!.userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[MealsRoutes] Planning readiness failed:', error);
    return res.status(500).json({ success: false, error: 'Could not check planning status.' });
  }
});

/**
 * Route: POST /api/user/meals/generate
 * Description: Generates a 7-day, 21-meal plan.
 */
router.post('/generate', requireClinicalEvidenceReady, validateZodRequest({ body: mealGenerationBodySchema }), MealsController.generateMealPlan);
router.get('/generation-status', MealsController.getGenerationStatus);

/**
 * Route: POST /api/user/meals/rollover
 * Description: Promotes an expired starter bridge into the current full cycle.
 */
router.post('/rollover', requireClinicalEvidenceReady, MealsController.ensureCurrentPlanRollover);

/**
 * Route: GET /api/user/meals/current
 * Description: Returns current active meal plan items.
 */
router.get('/current', requireClinicalEvidenceReady, validateZodRequest({ query: z.object({}).strict() }), MealsController.getCurrentPlan);
router.get('/workspace', requireClinicalEvidenceReady, validateZodRequest({ query: z.object({}).strict() }), MealsController.getPlanWorkspace);

/**
 * Route: GET /api/user/meals/cycles
 * Description: Returns authoritative current and upcoming cycle identities.
 */
router.get('/cycles', requireClinicalEvidenceReady, validateZodRequest({ query: z.object({}).strict() }), MealsController.getPlanCycles);
router.post(
  '/cycles/:cycleId/acknowledge-incomplete',
  requireClinicalEvidenceReady,
  validateZodRequest({ params: z.object({ cycleId: z.string().min(1).max(200) }).strict() }),
  MealsController.acknowledgeIncompleteCycle
);
router.post(
  '/cycles/:cycleId/start-shopping',
  requireClinicalEvidenceReady,
  validateZodRequest({ params: z.object({ cycleId: z.string().min(1).max(200) }).strict() }),
  MealsController.startShopping
);

/**
 * Route: GET /api/user/meals/history
 * Description: Returns all historic meal plans.
 */
router.get('/history', MealsController.getPlanHistory);

/**
 * Route: POST /api/user/meals/log-outside
 * Description: Performs AI validation checks and logs outside meals.
 */
router.post('/log-outside', validateZodRequest({ body: outsideMealBodySchema }), MealsController.logOutsideMeal);
router.get(
  '/outside-suggestions',
  validateZodRequest({ query: outsideMealSuggestionsQuerySchema }),
  MealsController.getOutsideSuggestions
);
router.patch(
  '/logs/:id/items/:itemId',
  validateZodRequest({ params: outsideMealItemParamsSchema, body: outsideMealItemEditSchema }),
  MealsController.editOutsideItem
);
router.post(
  '/logs/:id/void',
  validateZodRequest({ params: resourceIdParamsSchema, body: outsideMealVoidSchema }),
  MealsController.voidOutsideLog
);
router.post(
  '/logs/:id/items/:itemId/request-review',
  validateZodRequest({ params: outsideMealItemParamsSchema }),
  MealsController.requestOutsideItemReview
);
router.post(
  '/logs/:id/items/:itemId/reply',
  validateZodRequest({ params: outsideMealItemParamsSchema, body: outsideMealReplySchema }),
  MealsController.replyToOutsideItemReview
);
router.post(
  '/logs/:id/items/:itemId/observed-consent',
  validateZodRequest({ params: outsideMealItemParamsSchema, body: observedMealConsentSchema }),
  MealsController.consentToObservedMealReuse
);
router.post(
  '/observed-submissions/:id/withdraw',
  validateZodRequest({ params: resourceIdParamsSchema }),
  MealsController.withdrawObservedMealReuse
);
router.post(
  '/logs/:id/image',
  validateZodRequest({ params: resourceIdParamsSchema }),
  outsideImageUpload.single('image'),
  MealsController.attachOutsideImage
);
router.get('/logs/:id/image', validateZodRequest({ params: resourceIdParamsSchema }), MealsController.getOutsideImage);

/**
 * Route: PATCH /api/user/meals/:id/status
 * Description: Checks off scheduled meals as DONE or SKIPPED.
 */
router.patch(
  '/:id/status',
  requireClinicalEvidenceReady,
  validateZodRequest({ params: resourceIdParamsSchema, body: mealStatusBodySchema }),
  MealsController.updateMealStatus
);

/**
 * Route: PATCH /api/user/meals/logs/:id/notes
 * Description: Updates notes on an eaten/logged meal.
 */
router.patch(
  '/logs/:id/notes',
  validateZodRequest({ params: resourceIdParamsSchema, body: updateMealLogNotesBodySchema }),
  MealsController.updateMealLogNotes
);

/**
 * Route: GET /api/user/meals/compatible-library
 * Description: Retrieves all compatible approved library meals for the logged-in user.
 */
router.get(
  '/compatible-library',
  validateZodRequest({ query: compatibleLibraryQuerySchema }),
  MealsController.getCompatibleLibrary
);

router.post(
  '/library/:id/favorite',
  validateZodRequest({ params: resourceIdParamsSchema }),
  MealsController.addLibraryFavorite
);
router.delete(
  '/library/:id/favorite',
  validateZodRequest({ params: resourceIdParamsSchema }),
  MealsController.removeLibraryFavorite
);

/**
 * Route: GET /api/user/meals/:id
 * Description: Retrieves details of a specific meal plan item.
 */
router.get('/:id', requireClinicalEvidenceReady, validateZodRequest({ params: resourceIdParamsSchema }), MealsController.getMealDetails);

/**
 * Route: GET /api/user/meals/:id/swap-options
 * Description: Retrieves swap options for a given meal plan slot.
 */
router.get('/:id/swap-options', requireClinicalEvidenceReady, validateZodRequest({ params: resourceIdParamsSchema }), MealsController.getSwapOptions);

/**
 * Route: GET /api/user/meals/:id/swap-preview
 * Description: Generates swap calorie warnings.
 */
router.get(
  '/:id/swap-preview',
  requireClinicalEvidenceReady,
  validateZodRequest({ params: resourceIdParamsSchema, query: swapPreviewQuerySchema }),
  MealsController.getSwapPreview
);

/**
 * Route: POST /api/user/meals/:id/swap
 * Description: Executes a meal plan slot swap.
 */
router.post(
  '/:id/swap',
  requireClinicalEvidenceReady,
  validateZodRequest({ params: resourceIdParamsSchema, body: swapMealBodySchema }),
  MealsController.executeSwap
);

export default router;
