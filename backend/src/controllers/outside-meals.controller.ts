import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { MealLogService } from '@/services/meal-log.service';
import { ObservedMealService } from '@/services/observed-meal.service';
import { OutsideMealCaptureService } from '@/services/outside-meal-capture.service';
import { OutsideMealReviewService } from '@/services/outside-meal-review.service';
import { AuthenticatedRequest } from '@/types';
import { Response } from 'express';
import { AppError } from '@/errors/AppError';
import { AiCapacityDeferredError } from '@/services/ai-capacity.service';

export class OutsideMealsController {
  static async logOutsideMeal(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const {
        mealName,
        items,
        mealType,
        useAiEstimate,
        requestKey,
        warningAcknowledged,
        requestRndReview,
        confirmationId,
        notes,
        estimationContext,
        consumedAt,
      } = req.body;

      const result = await MealLogService.logOutsideMeal({
        userId,
        mealName,
        items,
        mealType,
        useAiEstimate,
        requestKey,
        warningAcknowledged,
        requestRndReview,
        confirmationId,
        notes,
        estimationContext,
        consumedAt,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[MealsController] logOutsideMeal error:', error);
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      if (error instanceof AiCapacityDeferredError) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((error.retryAt.getTime() - Date.now()) / 1000))));
      }
      return res.status(status).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to check or log outside meal.'),
        code: error instanceof AppError ? error.errorCode : undefined,
        retryAt: error instanceof AiCapacityDeferredError ? error.retryAt.toISOString() : undefined,
      });
    }
  }

  static async getOutsideSuggestions(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({
        success: true,
        data: await OutsideMealCaptureService.suggestions(req.user!.userId, String(req.query.search)),
      });
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to load food suggestions.') });
    }
  }

  static async editOutsideItem(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealCaptureService.editItem(
        req.user!.userId,
        req.params.id,
        req.params.itemId,
        req.body
      );
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to revise outside meal.') });
    }
  }

  static async voidOutsideLog(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealCaptureService.voidLog(req.user!.userId, req.params.id, req.body.reason);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to void outside meal.') });
    }
  }

  static async requestOutsideItemReview(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealReviewService.requestByUser(req.user!.userId, req.params.id, req.params.itemId);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(error?.statusCode ?? 400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Could not request outside-meal review.'),
        code: error instanceof AppError ? error.errorCode : undefined,
      });
    }
  }

  static async replyToOutsideItemReview(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await OutsideMealReviewService.replyByUser(
        req.user!.userId,
        req.params.id,
        req.params.itemId,
        req.body.message
      );
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not send clarification.') });
    }
  }

  static async consentToObservedMealReuse(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ObservedMealService.consent(req.user!.userId, req.params.id, req.params.itemId, req.body);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not submit this food for reuse.') });
    }
  }

  static async withdrawObservedMealReuse(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await ObservedMealService.withdraw(req.user!.userId, req.params.id);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Could not withdraw reuse permission.') });
    }
  }

  static async attachOutsideImage(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file)
        return res.status(400).json({ success: false, error: 'Choose a JPG, PNG, or WebP image under 2 MB.' });
      const data = await OutsideMealCaptureService.attachImage(req.user!.userId, req.params.id, req.file);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to attach image.') });
    }
  }

  static async getOutsideImage(req: AuthenticatedRequest, res: Response) {
    try {
      const image = await OutsideMealCaptureService.image(req.user!.userId, req.params.id);
      res.setHeader('Content-Type', image.mime);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(image.buffer);
    } catch (error: any) {
      return res
        .status(error?.statusCode ?? 404)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Image unavailable.') });
    }
  }
}
