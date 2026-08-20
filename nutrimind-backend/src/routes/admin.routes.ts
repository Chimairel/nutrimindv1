import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { AdminService } from '@/services/admin.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();

// Apply auth + ADMIN role restriction
router.use(authenticate);
router.use(requireRole('ADMIN'));

/**
 * GET /api/admin/analytics
 * Returns platform-wide aggregate statistics.
 */
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await AdminService.getAnalytics();
    return res.status(200).json({ success: true, data: analytics });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve analytics.') });
  }
});

/**
 * GET /api/admin/users?page=1&limit=20&search=keyword
 * Returns paginated user list with optional search.
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await AdminService.getUsers(page, limit, search);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve users.') });
  }
});

/**
 * GET /api/admin/nutritionists
 * Returns all nutritionist profiles (pending first).
 */
router.get('/nutritionists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nutritionists = await AdminService.getNutritionists();
    return res.status(200).json({ success: true, data: nutritionists });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionists.') });
  }
});

/**
 * PATCH /api/admin/nutritionists/:id/verify
 * Verifies a nutritionist profile.
 */
router.patch('/nutritionists/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AdminService.verifyNutritionist(req.user!.userId, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to verify nutritionist.') });
  }
});

export default router;
