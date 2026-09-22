import { Response } from 'express';
import React from 'react';
import { AuthenticatedRequest } from '@/types';
import { GroceryService } from '@/services/grocery.service';
import { UpcomingPlanPreparationService } from '@/services/upcoming-plan-preparation.service';

export class GroceryController {
  /**
   * Generates a new grocery list based on the active 7-day meal plan.
   */
  static async generate(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      }

      const groceryList = await GroceryService.generateGroceryList(userId);
      return res.status(200).json({
        success: true,
        message: 'Grocery list generated successfully.',
        data: groceryList,
      });
    } catch (err: any) {
      console.error('[GroceryController] Generation failed:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to generate grocery list.',
      });
    }
  }

  /**
   * Fetches the user's current grocery list.
   */
  static async getCurrent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      }

      UpcomingPlanPreparationService.triggerNonBlocking(userId);
      const groceryList = await GroceryService.getGroceryList(userId);
      return res.status(200).json({
        success: true,
        data: groceryList,
      });
    } catch (err: any) {
      console.error('[GroceryController] Fetch failed:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve grocery list.',
      });
    }
  }

  /** Fetches current and next-cycle grocery projections with server-owned action gates. */
  static async getWorkspace(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      UpcomingPlanPreparationService.triggerNonBlocking(userId);
      return res.status(200).json({ success: true, data: await GroceryService.getGroceryWorkspace(userId) });
    } catch (error) {
      console.error('[GroceryController] Workspace fetch failed:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve grocery workspace.' });
    }
  }

  /**
   * Toggles the checked status of a grocery item.
   */
  static async toggleItem(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const itemId = req.params.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      }
      if (!itemId) {
        return res.status(400).json({ success: false, error: 'Missing grocery item ID parameter.' });
      }

      const updatedItem = await GroceryService.toggleGroceryItem(userId, itemId);
      return res.status(200).json({
        success: true,
        message: 'Grocery item status updated successfully.',
        data: updatedItem,
      });
    } catch (err: any) {
      console.error('[GroceryController] Toggle failed:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to update item status.',
      });
    }
  }

  static async togglePantry(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      const item = await GroceryService.togglePantryStaple(userId, req.params.id);
      return res.status(200).json({ success: true, data: item });
    } catch (error: unknown) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pantry status.',
      });
    }
  }

  /**
   * GET /api/user/grocery/pdf
   * Streams the grocery list as a PDF
   */
  static async downloadGroceryPdf(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized user.' });
      }

      const cycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId : undefined;
      const projection = cycleId
        ? await GroceryService.getCycleProjection(userId, cycleId)
        : (await GroceryService.getGroceryWorkspace(userId)).current;
      const groceryList = projection?.groceryList;
      if (!projection || !projection.actionability.canExportPdf) {
        return res.status(409).json({
          success: false,
          error: projection?.actionability.message || 'No exportable grocery list is available.',
        });
      }
      if (!groceryList || !groceryList.groceryItems || groceryList.groceryItems.length === 0) {
        return res.status(404).json({ success: false, error: 'No active grocery list found.' });
      }

      const { GroceryListPDF, streamPdf } = await import('@/lib/pdf');
      const document = React.createElement(GroceryListPDF, {
        groceryList,
        incomplete: projection.actionability.isIncomplete,
        unresolvedSlotCount: projection.coverage.unresolvedSlotCount,
      });
      const stream = await streamPdf(document);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=nutrimind-grocery-list.pdf');
      stream.pipe(res);
    } catch (error: any) {
      console.error('[GroceryController] downloadGroceryPdf error:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate grocery list PDF.' });
    }
  }
}
