import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types';
import { lookupIngredient } from '@/lib/fnri';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { validateZodRequest } from '@/middleware/validateZod';
import { fnriLookupQuerySchema } from '@/validation/user-action.schemas';
import { logger } from '@/lib/logger';

const router = Router();

// Secure router under authentication
router.use(authenticate);

/**
 * Route: GET /api/fnri/lookup
 * Query: name (The ingredient name search term, e.g. "rice")
 * Description: Executes the 4-step clinical lookup chain to return nutritional statistics.
 */
router.get(
  '/lookup',
  validateZodRequest({ query: fnriLookupQuerySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = req.query.name as string;

      logger.debug('fnri_lookup_started', { requestId: res.locals.requestId, queryLength: name.length });
      const result = await lookupIngredient(name);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('fnri_lookup_failed', { requestId: res.locals.requestId });
      return res.status(500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to resolve ingredient query details.'),
      });
    }
  }
);

export default router;
