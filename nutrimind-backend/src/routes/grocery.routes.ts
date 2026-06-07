import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { GroceryController } from '@/controllers/grocery.controller';

const router = Router();

// Restrict all grocery endpoints to authenticated standard USERs
router.use(authenticate);
router.use(requireRole('USER'));

/**
 * Route: POST /api/user/grocery/generate
 * Description: Compiles and creates a grocery list from the active plan.
 */
router.post('/generate', GroceryController.generate);

/**
 * Route: GET /api/user/grocery/current
 * Description: Retrieves the user's active grocery list.
 */
router.get('/current', GroceryController.getCurrent);

/**
 * Route: PATCH /api/user/grocery/items/:id/toggle
 * Description: Toggles checked status of a grocery item.
 */
router.patch('/items/:id/toggle', GroceryController.toggleItem);

export default router;
