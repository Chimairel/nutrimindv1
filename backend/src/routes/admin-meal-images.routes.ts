import { Router, type Response } from 'express';
import multer from 'multer';
import type { AuthenticatedRequest } from '@/types';
import { AdminMealImageService } from '@/services/admin-meal-image.service';
import { mealImageMetadataSchema } from '@/validation/meal-image.schemas';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype));
  },
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 18));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : undefined;
    return res.json({ success: true, data: await AdminMealImageService.list(page, limit, search) });
  } catch (error) {
    return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to load meal images.') });
  }
});

router.post('/:id', upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Choose a JPG, PNG, WebP, or AVIF image.' });
    const parsed = mealImageMetadataSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid image metadata.' });
    const data = await AdminMealImageService.assign(req.user!.userId, req.params.id, req.file, parsed.data);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to assign meal image.') });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await AdminMealImageService.unassign(req.user!.userId, req.params.id) });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to unassign meal image.') });
  }
});

export default router;
