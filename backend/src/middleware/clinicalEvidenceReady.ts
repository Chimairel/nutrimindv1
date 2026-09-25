import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';
import { AppError } from '@/errors/AppError';

export default async function requireClinicalEvidenceReady(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await ClinicalEvidenceService.assertReadyForMealPlanning(req.user!.userId);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, errorCode: error.errorCode, details: error.details });
    }
    return next(error);
  }
}
