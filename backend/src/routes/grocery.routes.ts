import { Router } from 'express';
import { z } from 'zod';
import { GroceryCostService } from '@/services/grocery-cost.service';
import { GroceryService } from '@/services/grocery.service';
import { AuthenticatedRequest } from '@/types';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { GroceryController } from '@/controllers/grocery.controller';
import { requireReadyUser } from '@/middleware/userPrerequisites';
import requireClinicalEvidenceReady from '@/middleware/clinicalEvidenceReady';
import { validateZodRequest } from '@/middleware/validateZod';
import { resourceIdParamsSchema } from '@/validation/user-action.schemas';

const router = Router();

// Restrict all grocery endpoints to authenticated standard USERs
router.use(authenticate);
router.use(requireRole('USER'));
router.use(requireReadyUser);
router.use(requireClinicalEvidenceReady);

/**
 * Route: POST /api/user/grocery/generate
 * Description: Compiles and creates a grocery list from the active plan.
 */
router.post('/generate', GroceryController.generate);

/**
 * Route: GET /api/user/grocery/current
 * Description: Retrieves the user's active grocery list.
 */
router.get('/cost', async (req: AuthenticatedRequest, res) => {
  try {
    return res.json({ success: true, data: await GroceryCostService.estimate(req.user!.userId) });
  } catch {
    return res.status(503).json({ success: false, error: 'Price estimates are unavailable.' });
  }
});
router.get('/current', GroceryController.getCurrent);
router.get('/workspace', validateZodRequest({ query: z.object({}).strict() }), GroceryController.getWorkspace);

/**
 * Route: GET /api/user/grocery/pdf
 * Description: Streams the grocery list as a PDF.
 */
router.get(
  '/pdf',
  validateZodRequest({ query: z.object({ cycleId: z.string().min(1).max(200).optional() }).strict() }),
  GroceryController.downloadGroceryPdf
);

/**
 * Route: PATCH /api/user/grocery/items/:id/toggle
 * Description: Toggles checked status of a grocery item.
 */
router.patch(
  '/items/:id/purchase',
  validateZodRequest({
    params: resourceIdParamsSchema,
    body: z.object({ purchasedQuantity: z.number().finite().min(0).max(1000000) }).strict(),
  }),
  async (req: AuthenticatedRequest, res) => {
    try {
      return res.json({
        success: true,
        data: await GroceryService.recordPurchase(req.user!.userId, req.params.id, req.body.purchasedQuantity),
      });
    } catch (error) {
      return res
        .status(409)
        .json({ success: false, error: error instanceof Error ? error.message : 'Purchase could not be saved.' });
    }
  }
);
router.patch('/items/:id/toggle', validateZodRequest({ params: resourceIdParamsSchema }), GroceryController.toggleItem);
router.patch(
  '/items/:id/pantry',
  validateZodRequest({ params: resourceIdParamsSchema }),
  GroceryController.togglePantry
);

export default router;
