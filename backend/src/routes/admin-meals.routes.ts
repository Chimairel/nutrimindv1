import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '@/types';
import { validateZodRequest } from '@/middleware/validateZod';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { AppError } from '@/errors/AppError';
import { adminMealInputSchema, adminMealUpdateSchema } from '@/validation/admin-meal.schemas';
import { AdminMealAuthoringService } from '@/services/admin-meal-authoring.service';

const router = Router();

function failure(res: Response, error: unknown) {
  const status = error instanceof AppError ? error.statusCode : 500;
  return res.status(status).json({
    success: false,
    error: error instanceof AppError ? error.message : sanitizeErrorMessage(error, 'Could not save the meal draft.'),
    errorCode: error instanceof AppError ? error.errorCode : 'INTERNAL_ERROR',
  });
}

router.get('/foods', validateZodRequest({ query: z.object({ search: z.string().trim().min(2).max(100) }).strict() }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({ success: true, data: await AdminMealAuthoringService.searchFnriFoods(req.query.search as string) });
    } catch (error) {
      return failure(res, error);
    }
  });

router.get('/', validateZodRequest({ query: z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict() }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({ success: true, data: await AdminMealAuthoringService.list(Number(req.query.page)) });
    } catch (error) {
      return failure(res, error);
    }
  });

router.post('/', validateZodRequest({ body: adminMealInputSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await AdminMealAuthoringService.create(req.user!.userId, req.body);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return failure(res, error);
    }
  });

router.patch('/:id', validateZodRequest({
  params: z.object({ id: z.string().trim().min(1).max(191) }).strict(),
  body: adminMealUpdateSchema,
}), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await AdminMealAuthoringService.update(req.user!.userId, req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return failure(res, error);
  }
});

export default router;
