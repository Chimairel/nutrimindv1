import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { ProgressController } from '@/controllers/progress.controller';
import { requireReadyUser } from '@/middleware/userPrerequisites';

const router = Router();

// Apply auth + USER role restrict on all /api/user/progress routes
router.use(authenticate);
router.use(requireRole('USER'));
router.use(requireReadyUser);

/**
 * Route: POST /api/user/progress/weight
 * Description: Logs a new weight value, updating profile and recalculating target calories.
 */
router.post('/weight', ProgressController.logWeight);

/**
 * Route: GET /api/user/progress/history
 * Description: Fetches historical weight logs and daily nutritional adherence scores.
 */
router.get('/history', ProgressController.getHistory);

export default router;
