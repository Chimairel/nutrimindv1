import { NextFunction, Response } from 'express';
import prisma from '@/lib/prisma';
import { AuthenticatedRequest } from '@/types';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

export async function requireEligibleNutritionist(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication is required.' });
    }

    const profile = await prisma.nutritionistProfile.findUnique({
      where: { userId: req.user.userId },
      select: {
        id: true,
        isVerified: true,
        prcLicenseExpiry: true,
      },
    });

    if (!profile || !isNutritionistEligibleForReview(profile)) {
      return res.status(403).json({
        success: false,
        error: 'An active, verified nutritionist credential is required for this workspace.',
      });
    }

    req.nutritionistProfileId = profile.id;
    next();
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Unable to verify nutritionist eligibility.'),
    });
  }
}

export default requireEligibleNutritionist;
