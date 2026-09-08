import { Router, type Response } from 'express';
import { AdminDataService } from '@/services/admin-data.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { validateZodBody, validateZodRequest } from '@/middleware/validateZod';
import type { AuthenticatedRequest } from '@/types';
import {
  adminDataListQuerySchema,
  createFoodAliasSchema,
  createReferenceDataReleaseSchema,
  createReferenceDataSourceSchema,
  identifierParamsSchema,
  importConsumptionCsvSchema,
  mapConsumptionStatSchema,
  updateReferenceDataSourceSchema,
} from '@/validation/admin-data.schemas';
import { emptyBodySchema } from '@/validation/onboarding.schemas';

const router = Router();

function failure(res: Response, error: unknown, fallback: string, status = 400) {
  return res.status(status).json({ success: false, error: sanitizeErrorMessage(error, fallback) });
}

router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ success: true, data: await AdminDataService.getWorkspace() });
  } catch (error: unknown) {
    return failure(res, error, 'Failed to retrieve reference data operations.', 500);
  }
});

router.get(
  '/foods',
  validateZodRequest({ query: adminDataListQuerySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, limit, search } = req.query as unknown as { page: number; limit: number; search?: string };
      return res.json({ success: true, data: await AdminDataService.listFoods(page, limit, search) });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to retrieve the FNRI catalogue.', 500);
    }
  }
);

router.get(
  '/releases/:id/stats',
  validateZodRequest({ params: identifierParamsSchema, query: adminDataListQuerySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, limit, search } = req.query as unknown as { page: number; limit: number; search?: string };
      return res.json({
        success: true,
        data: await AdminDataService.listReleaseStats(req.params.id, page, limit, search),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to retrieve consumption statistics.', 500);
    }
  }
);

router.post(
  '/sources',
  validateZodBody(createReferenceDataSourceSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res
        .status(201)
        .json({ success: true, data: await AdminDataService.createSource(req.user!.userId, req.body) });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to create the reference data source.');
    }
  }
);

router.patch(
  '/sources/:id',
  validateZodRequest({ params: identifierParamsSchema, body: updateReferenceDataSourceSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: await AdminDataService.updateSource(req.user!.userId, req.params.id, req.body),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to update the reference data source.');
    }
  }
);

router.post(
  '/releases',
  validateZodBody(createReferenceDataReleaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res
        .status(201)
        .json({ success: true, data: await AdminDataService.createRelease(req.user!.userId, req.body) });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to create the reference data release.');
    }
  }
);

router.post(
  '/releases/:id/consumption-import',
  validateZodRequest({ params: identifierParamsSchema, body: importConsumptionCsvSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: await AdminDataService.importConsumptionCsv(req.user!.userId, req.params.id, req.body.csvText),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to import the consumption dataset.');
    }
  }
);

router.patch(
  '/consumption-stats/:id/mapping',
  validateZodRequest({ params: identifierParamsSchema, body: mapConsumptionStatSchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: await AdminDataService.mapConsumptionStat(req.user!.userId, req.params.id, req.body.foodItemId),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to update the FNRI mapping.');
    }
  }
);

router.post(
  '/releases/:id/stage',
  validateZodRequest({ params: identifierParamsSchema, body: emptyBodySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({ success: true, data: await AdminDataService.stageRelease(req.user!.userId, req.params.id) });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to stage the reference data release.');
    }
  }
);

router.post(
  '/releases/:id/publish',
  validateZodRequest({ params: identifierParamsSchema, body: emptyBodySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: await AdminDataService.activateRelease(req.user!.userId, req.params.id, 'PUBLISH'),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to publish the reference data release.');
    }
  }
);

router.post(
  '/releases/:id/rollback',
  validateZodRequest({ params: identifierParamsSchema, body: emptyBodySchema }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: await AdminDataService.activateRelease(req.user!.userId, req.params.id, 'ROLLBACK'),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to restore the reference data release.');
    }
  }
);

router.post(
  '/food-aliases',
  validateZodBody(createFoodAliasSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(201).json({
        success: true,
        data: await AdminDataService.createVerifiedAlias(req.user!.userId, req.body),
      });
    } catch (error: unknown) {
      return failure(res, error, 'Failed to create the verified FNRI alias.');
    }
  }
);

export default router;
