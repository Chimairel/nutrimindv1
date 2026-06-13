import { Response } from 'express';

import { AuthenticatedRequest } from '@/types';
import { UserService } from '@/services/user.service';
import { NutritionReportService } from '@/services/nutrition-report.service';

export class UserController {
  /**
   * GET /api/user/profile
   * Returns complete profile details (User + Profile + Conditions + Allergies + NutritionReport status)
   */
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
      }

      const profileDetails = await UserService.getUserProfileDetails(userId);
      if (!profileDetails) {
        return res.status(404).json({ success: false, error: 'User details not found.' });
      }

      return res.status(200).json({
        success: true,
        data: profileDetails,
      });
    } catch (error: any) {
      console.error('[UserController] getProfile error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error resolving profile details.' });
    }
  }

  /**
   * POST /api/user/onboarding/profile
   * Saves UserProfile metrics.
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const profile = await UserService.updateUserProfile(userId, req.body);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      console.error('[UserController] updateProfile error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update user profile statistics.' });
    }
  }

  /**
   * POST /api/user/onboarding/conditions
   * Saves HealthCondition records.
   */
  static async updateConditions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { conditions, otherConditions } = req.body;
      if (!Array.isArray(conditions)) {
        return res.status(400).json({ success: false, error: 'Request body must contain an array of conditions.' });
      }

      const savedConditions = await UserService.updateHealthConditions(userId, conditions);

      // Also save any custom free-text conditions if provided
      if (typeof otherConditions === 'string') {
        await UserService.updateOtherConditions(userId, otherConditions.trim());
      }

      return res.status(200).json({
        success: true,
        data: savedConditions,
      });
    } catch (error: any) {
      console.error('[UserController] updateConditions error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update clinical health conditions.' });
    }
  }

  /**
   * POST /api/user/onboarding/allergies
   * Saves Allergy records.
   */
  static async updateAllergies(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { allergies, otherAllergies } = req.body;
      if (!Array.isArray(allergies)) {
        return res.status(400).json({ success: false, error: 'Request body must contain an array of allergies.' });
      }

      const savedAllergies = await UserService.updateAllergies(userId, allergies);

      // Also save any custom free-text allergies if provided
      if (typeof otherAllergies === 'string') {
        await UserService.updateOtherAllergies(userId, otherAllergies.trim());
      }

      return res.status(200).json({
        success: true,
        data: savedAllergies,
      });
    } catch (error: any) {
      console.error('[UserController] updateAllergies error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update food allergens.' });
    }
  }

  /**
   * POST /api/user/onboarding/tos
   * Sets tosAccepted=true.
   */
  static async acceptTos(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const updatedUser = await UserService.acceptTos(userId);

      return res.status(200).json({
        success: true,
        data: {
          tosAccepted: updatedUser.tosAccepted,
          tosAcceptedAt: updatedUser.tosAcceptedAt,
        },
      });
    } catch (error: any) {
      console.error('[UserController] acceptTos error:', error);
      return res.status(500).json({ success: false, error: 'Failed to sign Terms of Service agreement.' });
    }
  }

  /**
   * POST /api/user/onboarding/complete
   * Sets onboardingDone=true and calculates dailyCalorieTarget.
   */
  static async completeOnboarding(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const result = await UserService.completeOnboarding(userId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[UserController] completeOnboarding error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to complete user onboarding.' });
    }
  }

  /**
   * GET /api/user/nutrition-report
   * Returns current user report.
   */
  static async getNutritionReport(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const report = await NutritionReportService.getReport(userId);
      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('[UserController] getNutritionReport error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve nutrition report.' });
    }
  }

  /**
   * GET /api/user/nutrition-report/pdf
   * Streams the nutrition report as a PDF
   */
  static async downloadNutritionReportPdf(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const report = await NutritionReportService.getReport(userId);
      if (!report) {
        return res.status(404).json({ success: false, error: 'Report not found.' });
      }

      const userDetails = await UserService.getUserProfileDetails(userId);
      if (!userDetails) {
        return res.status(404).json({ success: false, error: 'User details not found.' });
      }

      const React = await import('react');
      const { NutritionReportPDF, streamPdf } = await import('@/lib/pdf');
      const document = React.createElement(NutritionReportPDF, { user: userDetails, report });
      const stream = await streamPdf(document);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=nutrimind-report.pdf');
      stream.pipe(res);
    } catch (error: unknown) {
      console.error('[UserController] downloadNutritionReportPdf error:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
    }
  }

  /**
   * POST /api/user/nutrition-report/generate
   * Generates custom mock report.
   */
  static async generateReport(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const report = await NutritionReportService.generateReport(userId);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('[UserController] generateReport error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to generate nutrition report.' });
    }
  }

  /**
   * POST /api/user/nutrition-report/acknowledge
   * Sets report acknowledgedAt=now.
   */
  static async acknowledgeReport(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const report = await NutritionReportService.acknowledgeReport(userId);

      return res.status(200).json({
        success: true,
        data: {
          acknowledgedAt: report.acknowledgedAt,
        },
      });
    } catch (error: any) {
      console.error('[UserController] acknowledgeReport error:', error);
      return res.status(500).json({ success: false, error: 'Failed to acknowledge nutrition report.' });
    }
  }

  /**
   * GET /api/user/nutritionists
   * Returns a list of verified nutritionists for the user directory.
   */
  static async getNutritionists(req: AuthenticatedRequest, res: Response) {
    try {
      const nutritionists = await UserService.getNutritionistDirectory();
      return res.status(200).json({
        success: true,
        data: nutritionists,
      });
    } catch (error: any) {
      console.error('[UserController] getNutritionists error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve nutritionist directory.' });
    }
  }
}
