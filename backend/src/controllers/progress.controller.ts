import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { ProgressService } from '@/services/progress.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import {
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  isSupportedWeightKg,
  normalizeWeightNote,
} from '@/policies/weight-entry.policy';

export class ProgressController {
  /**
   * Logs a new weight log and triggers recalculation of daily calorie targets.
   */
  static async logWeight(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { weightKg, note } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      if (!isSupportedWeightKg(weightKg)) {
        return res.status(400).json({
          success: false,
          error: `Weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`,
        });
      }

      const weightLog = await ProgressService.logWeight(userId, weightKg, normalizeWeightNote(note));
      return res.status(200).json({
        success: true,
        message: 'Weight logged successfully. Your daily calorie target has been dynamically recalculated.',
        data: weightLog,
      });
    } catch (err: any) {
      console.error('[ProgressController] logWeight error:', err);
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(err, 'Failed to record weight entry.'),
      });
    }
  }

  /**
   * Retrieves weight and daily nutrition logs history.
   */
  static async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const history = await ProgressService.getProgressHistory(userId);
      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err: any) {
      console.error('[ProgressController] getHistory error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve progress tracking history.',
      });
    }
  }
}
