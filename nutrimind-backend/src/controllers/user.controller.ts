import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

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

      // Convert number fields to floats/ints if they are passed as strings
      const data = { ...req.body };
      if (data.age) data.age = parseInt(data.age);
      if (data.heightCm) data.heightCm = parseFloat(data.heightCm);
      if (data.weightKg) data.weightKg = parseFloat(data.weightKg);
      if (data.targetWeightKg) data.targetWeightKg = parseFloat(data.targetWeightKg);

      const profile = await UserService.updateUserProfile(userId, data);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.onboardingDone) {
        await UserService.completeOnboarding(userId);
      }

      const profileDetails = await UserService.getUserProfileDetails(userId);

      return res.status(200).json({
        success: true,
        data: profileDetails,
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

      // Validate otherConditions free text
      if (typeof otherConditions === 'string' && otherConditions.trim()) {
        const rawConditions = otherConditions.split(',').map((c: string) => c.trim()).filter(Boolean);
        const { COMMON_CONDITIONS, HealthValidationService } = await import('@/services/health-validation.service');
        const normalizedList: string[] = [];

        for (const rawCond of rawConditions) {
          const exactMatch = COMMON_CONDITIONS.find(
            (c) => c.toLowerCase() === rawCond.toLowerCase()
          );

          if (exactMatch) {
            normalizedList.push(exactMatch);
          } else {
            try {
              const normalized = await HealthValidationService.normalizeHealthInput(rawCond, 'condition');
              if (normalized === 'INVALID') {
                return res.status(400).json({
                  success: false,
                  error: `We couldn't recognize "${rawCond}" as a health condition. Please check your spelling, or describe it differently.`,
                  errorCode: 'UNRECOGNIZED_INPUT',
                });
              }
              normalizedList.push(normalized);
            } catch (err: any) {
              console.error('[UserController] Normalization service error:', err);
              return res.status(503).json({
                success: false,
                error: 'The health validation service is temporarily unavailable. Please try again in a few moments.',
                errorCode: 'VALIDATION_SERVICE_UNAVAILABLE',
              });
            }
          }
        }

        await UserService.updateOtherConditions(userId, normalizedList.join(', '));
      } else {
        await UserService.updateOtherConditions(userId, '');
      }

      await UserService.runSafetyRecheck(userId);

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

      // Validate otherAllergies free text
      if (typeof otherAllergies === 'string' && otherAllergies.trim()) {
        const rawAllergies = otherAllergies.split(',').map((a: string) => a.trim()).filter(Boolean);
        const { COMMON_ALLERGIES, HealthValidationService } = await import('@/services/health-validation.service');
        const normalizedList: string[] = [];

        for (const rawAller of rawAllergies) {
          const exactMatch = COMMON_ALLERGIES.find(
            (a) => a.toLowerCase() === rawAller.toLowerCase()
          );

          if (exactMatch) {
            normalizedList.push(exactMatch);
          } else {
            try {
              const normalized = await HealthValidationService.normalizeHealthInput(rawAller, 'allergy');
              if (normalized === 'INVALID') {
                return res.status(400).json({
                  success: false,
                  error: `We couldn't recognize "${rawAller}" as a food allergen. Please check your spelling, or describe it differently.`,
                  errorCode: 'UNRECOGNIZED_INPUT',
                });
              }
              normalizedList.push(normalized);
            } catch (err: any) {
              console.error('[UserController] Normalization service error:', err);
              return res.status(503).json({
                success: false,
                error: 'The allergy validation service is temporarily unavailable. Please try again in a few moments.',
                errorCode: 'VALIDATION_SERVICE_UNAVAILABLE',
              });
            }
          }
        }

        await UserService.updateOtherAllergies(userId, normalizedList.join(', '));
      } else {
        await UserService.updateOtherAllergies(userId, '');
      }

      await UserService.runSafetyRecheck(userId);

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
   * PUT /api/user/profile/settings
   * Updates core account credentials (name, email) and optionally password.
   */
  static async updateAccountSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { name, email, currentPassword, newPassword } = req.body;

      // Fetch user to check password and email uniqueness
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const updateData: any = {};

      if (name && typeof name === 'string') {
        updateData.name = name.trim();
      }

      if (email && typeof email === 'string') {
        const sanitizedEmail = email.trim().toLowerCase();
        if (sanitizedEmail !== user.email) {
          // Check uniqueness
          const existingUser = await prisma.user.findUnique({
            where: { email: sanitizedEmail },
          });
          if (existingUser) {
            return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
          }
          updateData.email = sanitizedEmail;
        }
      }

      // Handle password change if requested
      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'Both current password and new password are required to change your password.' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
          return res.status(400).json({ success: false, error: 'Incorrect current password.' });
        }

        // Validate new password strength: length >= 8, >= 1 uppercase, >= 1 number
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
          return res.status(400).json({
            success: false,
            error: 'New password must be at least 8 characters long, contain at least one uppercase letter, and at least one number.',
          });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(12);
        updateData.passwordHash = await bcrypt.hash(newPassword, salt);
      }

      // Save changes
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          onboardingDone: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Account settings updated successfully.',
        data: updatedUser,
      });
    } catch (error: any) {
      console.error('[UserController] updateAccountSettings error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update account settings.' });
    }
  }

  /**
   * PUT /api/user/profile/avatar
   * Updates User's avatar seed (stored in image field)
   */
  static async updateAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
      }

      const { image } = req.body;
      if (typeof image !== 'string') {
        return res.status(400).json({ success: false, error: 'image seed is required.' });
      }

      const updatedUser = await UserService.updateUserImage(userId, image);

      return res.status(200).json({
        success: true,
        data: {
          image: updatedUser.image,
        },
      });
    } catch (error: any) {
      console.error('[UserController] updateAvatar error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update user avatar.' });
    }
  }

  /**
   * GET /api/user/onboarding/suggestions
   * Returns curated lists of common clinical conditions and food allergens for autocompleting.
   */
  static async getSuggestions(req: AuthenticatedRequest, res: Response) {
    try {
      const { COMMON_CONDITIONS, COMMON_ALLERGIES } = await import('@/services/health-validation.service');
      return res.status(200).json({
        success: true,
        data: {
          conditions: COMMON_CONDITIONS,
          allergies: COMMON_ALLERGIES,
        },
      });
    } catch (error: any) {
      console.error('[UserController] getSuggestions error:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve autocomplete suggestions.' });
    }
  }
}
