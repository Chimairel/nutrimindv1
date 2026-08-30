import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types';
import { lookupIngredient } from '@/lib/fnri';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();

// Secure router under authentication
router.use(authenticate);

/**
 * Route: GET /api/fnri/lookup
 * Query: name (The ingredient name search term, e.g. "rice")
 * Description: Executes the 4-step clinical lookup chain to return nutritional statistics.
 */
router.get('/lookup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required string query parameter "name".',
      });
    }

    console.log(`[FNRI Route] Invoking lookup for search term: "${name}"`);
    const result = await lookupIngredient(name);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[FNRI Route] Lookup query execution failed:', error);
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to resolve ingredient query details.'),
    });
  }
});

export default router;
