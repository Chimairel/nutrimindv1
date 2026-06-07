import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { MealsController } from '@/controllers/meals.controller';

const router = Router();

// Apply auth + USER role restrict on all /api/user/meals routes
router.use(authenticate);
router.use(requireRole('USER'));

/**
 * Route: POST /api/user/meals/generate
 * Description: Generates a 7-day, 21-meal plan.
 */
router.post('/generate', MealsController.generateMealPlan);

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

export default router;
