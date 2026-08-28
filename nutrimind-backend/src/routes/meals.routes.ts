import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { MealsController } from '@/controllers/meals.controller';
import { requireReadyUser } from '@/middleware/userPrerequisites';

const router = Router();

// Apply auth + USER role restrict on all /api/user/meals routes
router.use(authenticate);
router.use(requireRole('USER'));
router.use(requireReadyUser);

/**
 * Route: POST /api/user/meals/generate
 * Description: Generates a 7-day, 21-meal plan.
 */
router.post('/generate', MealsController.generateMealPlan);

/**
 * Route: POST /api/user/meals/rollover
 * Description: Promotes an expired starter bridge into the current full cycle.
 */
router.post('/rollover', MealsController.ensureCurrentPlanRollover);

/**
 * Route: GET /api/user/meals/current
 * Description: Returns current active meal plan items.
 */
router.get('/current', MealsController.getCurrentPlan);

/**
 * Route: GET /api/user/meals/history
 * Description: Returns all historic meal plans.
 */
router.get('/history', MealsController.getPlanHistory);

/**
 * Route: POST /api/user/meals/log-outside
 * Description: Performs AI validation checks and logs outside meals.
 */
router.post('/log-outside', MealsController.logOutsideMeal);

/**
 * Route: PATCH /api/user/meals/:id/status
 * Description: Checks off scheduled meals as DONE or SKIPPED.
 */
router.patch('/:id/status', MealsController.updateMealStatus);

/**
 * Route: GET /api/user/meals/compatible-library
 * Description: Retrieves all compatible approved library meals for the logged-in user.
 */
router.get('/compatible-library', MealsController.getCompatibleLibrary);

/**
 * Route: GET /api/user/meals/:id
 * Description: Retrieves details of a specific meal plan item.
 */
router.get('/:id', MealsController.getMealDetails);

/**
 * Route: GET /api/user/meals/:id/swap-options
 * Description: Retrieves swap options for a given meal plan slot.
 */
router.get('/:id/swap-options', MealsController.getSwapOptions);

/**
 * Route: GET /api/user/meals/:id/swap-preview
 * Description: Generates swap calorie warnings.
 */
router.get('/:id/swap-preview', MealsController.getSwapPreview);

/**
 * Route: POST /api/user/meals/:id/swap
 * Description: Executes a meal plan slot swap.
 */
router.post('/:id/swap', MealsController.executeSwap);

export default router;
