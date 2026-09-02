import { Router, Request, Response } from 'express';
import { validateZodBody } from '@/middleware/validateZod';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import NutritionistApplicationService from '@/services/nutritionist-application.service';
import {
  applicationStatusLookupSchema,
  nutritionistApplicationSchema,
  nutritionistInvitationAcceptanceSchema,
} from '@/validation/nutritionist-application.schemas';
import { applicationStatusLimiter, professionalApplicationLimiter } from '@/middleware/rateLimiter';

const router = Router();

router.post('/', professionalApplicationLimiter, validateZodBody(nutritionistApplicationSchema), async (req: Request, res: Response) => {
  try {
    const data = await NutritionistApplicationService.submit(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to submit nutritionist application.') });
  }
});

router.post('/status', applicationStatusLimiter, validateZodBody(applicationStatusLookupSchema), async (req: Request, res: Response) => {
  try {
    const data = await NutritionistApplicationService.getPublicStatus(req.body.referenceCode, req.body.email);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(404).json({ success: false, error: sanitizeErrorMessage(error, 'Application not found.') });
  }
});

router.post('/activate', validateZodBody(nutritionistInvitationAcceptanceSchema), async (req: Request, res: Response) => {
  try {
    const data = await NutritionistApplicationService.acceptInvitation(req.body.token, req.body.password);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to activate nutritionist account.') });
  }
});

export default router;
