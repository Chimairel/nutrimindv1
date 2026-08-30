import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

import { AuthenticatedRequest } from '@/types';
import { UserService } from '@/services/user.service';
import { NutritionReportService } from '@/services/nutrition-report.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { COMMON_ALLERGIES, COMMON_CONDITIONS } from '@/services/health-validation.service';
import { sanitizeRestrictionDisplayValue } from '@/domain/restriction-evaluation.policy';

function normalizeCustomEntries(rawValue: string, curatedValues: readonly string[]): string {
  const normalized = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => curatedValues.find((item) => item.toLowerCase() === value.toLowerCase()) ?? value)
    .map(sanitizeRestrictionDisplayValue);

  return [...new Map(normalized.map((value) => [value.toLowerCase(), value])).values()].join(', ');
}

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

      // Normalize known spelling/case mechanically. Unknown values are retained
      // as conservative custom restrictions and are never sent to an AI service.
      const normalizedOtherConditions = typeof otherConditions === 'string'
        ? normalizeCustomEntries(otherConditions, COMMON_CONDITIONS)
        : '';

      const savedConditions = await UserService.updateHealthConditionsWithCustom(
        userId,
        conditions,
        normalizedOtherConditions
      );

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

      const normalizedOtherAllergies = typeof otherAllergies === 'string'
        ? normalizeCustomEntries(otherAllergies, COMMON_ALLERGIES)
        : '';

      const savedAllergies = await UserService.updateAllergiesWithCustom(
        userId,
        allergies,
        normalizedOtherAllergies
      );

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

      const { termsVersion, privacyVersion } = req.body;
      const updatedUser = await UserService.acceptTos(userId, termsVersion, privacyVersion);

      return res.status(200).json({
        success: true,
        data: {
          tosAccepted: updatedUser.tosAccepted,
          tosAcceptedAt: updatedUser.tosAcceptedAt,
          acceptedTermsVersion: updatedUser.acceptedTermsVersion,
          acceptedPrivacyVersion: updatedUser.acceptedPrivacyVersion,
          healthDataConsentedAt: updatedUser.healthDataConsentedAt,
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
      const isIncomplete = error instanceof Error && error.message.startsWith('Onboarding is incomplete.');
      return res.status(isIncomplete ? 409 : 500).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to complete user onboarding.'),
        ...(isIncomplete ? { errorCode: 'ONBOARDING_INCOMPLETE' } : {}),
      });
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
   * Generates the user's persisted nutrition report.
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
      return res.status(500).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to generate nutrition report.') });
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
