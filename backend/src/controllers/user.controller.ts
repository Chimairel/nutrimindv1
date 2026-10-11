import { databaseAvailabilityFailure } from '@/lib/database-availability';
import { sendApiError } from '@/lib/http-response';
import { logger } from '@/lib/logger';
import { Response } from 'express';
import { updateAccountSettings } from '@/services/account-settings.service';
import { clearRefreshCookie } from '@/controllers/auth.controller';
import prisma from '@/lib/prisma';

import { AuthenticatedRequest } from '@/types';
import { UserService } from '@/services/user.service';
import { NutritionReportService } from '@/services/nutrition-report.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import { COMMON_ALLERGIES, COMMON_CONDITIONS } from '@/services/health-validation.service';
import { SafetyIntakeService } from '@/services/safety-intake.service';
import { AppError } from '@/errors/AppError';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';

// The declaration and its fail-closed invalidation commit together. A later
// recheck failure must never make the API claim that the declaration was lost.
async function trySafetyRecheck(userId: string): Promise<boolean> {
  try {
    await UserService.runSafetyRecheck(userId);
    return true;
  } catch (error) {
    console.error('[UserController] Safety recheck deferred; pending plans remain blocked.', error);
    return false;
  }
}

export class UserController {
  static async getSafetyCatalogue(_req: AuthenticatedRequest, res: Response) {
    return res.status(200).json({ success: true, data: SafetyIntakeService.getCatalogue() });
  }

  static async previewStructuredSafety(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      const preview = await SafetyIntakeService.previewDomains(userId, req.body.editableDomains, req.body.entries);
      return res.status(200).json({ success: true, data: preview });
    } catch (error: unknown) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Unable to preview structured safety entries.'),
      });
    }
  }

  static async saveStructuredSafety(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
      const saved = await SafetyIntakeService.replaceDomains(userId, req.body.editableDomains, req.body.entries);
      const safetyRecheckRetryNeeded = saved.changed && !(await trySafetyRecheck(userId));
      const nextHealthDetailsPath = await ClinicalEvidenceService.nextOnboardingDetailsPath(
        userId,
        req.body.editableDomains
      );
      return res
        .status(200)
        .json({ success: true, data: { ...saved, safetyRecheckRetryNeeded, nextHealthDetailsPath } });
    } catch (error: unknown) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Unable to save structured safety entries.'),
      });
    }
  }

  /**
   * GET /api/user/profile
   * Returns complete profile details (User + Profile + Conditions + Allergies + NutritionReport status)
   */
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    res.set('Cache-Control', 'private, no-store');
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
      }

      const profileDetails = res.locals.authenticatedProfile ?? (await UserService.getUserProfileDetails(userId));
      if (!profileDetails) {
        return res.status(404).json({ success: false, error: 'User details not found.' });
      }

      return res.status(200).json({
        success: true,
        data: profileDetails,
      });
    } catch (error: any) {
      const unavailable = databaseAvailabilityFailure(error);
      const errorCode = unavailable?.errorCode ?? 'PROFILE_UNAVAILABLE';
      logger.error('account_profile_unavailable', { requestId: res.locals.requestId, errorCode });
      return sendApiError(
        res,
        unavailable ? 503 : 500,
        unavailable?.message ?? 'Internal server error resolving profile details.',
        errorCode
      );
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

      const previousProfile = await prisma.userProfile.findUnique({ where: { userId } });
      const updatedProfile = await UserService.updateUserProfile(userId, req.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const safetyRecheckRetryNeeded = Boolean(
        user?.onboardingDone &&
        previousProfile?.safetyRevision !== updatedProfile.safetyRevision &&
        !(await trySafetyRecheck(userId))
      );

      const profileDetails = await UserService.getUserProfileDetails(userId);

      return res.status(200).json({
        success: true,
        data: { ...profileDetails, safetyRecheckRetryNeeded },
      });
    } catch (error: any) {
      console.error('[UserController] updateProfile error:', error);
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
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

      const savedConditions = await SafetyIntakeService.replaceDomains(
        userId,
        ['CONDITION'],
        [
          ...conditions.map((value: string) => ({
            domain: 'CONDITION' as const,
            value,
            provenance: 'PREDEFINED' as const,
          })),
          ...(typeof otherConditions === 'string' && otherConditions.trim()
            ? [{ domain: 'CONDITION' as const, value: otherConditions, provenance: 'CUSTOM' as const }]
            : []),
        ]
      );

      const safetyRecheckRetryNeeded = savedConditions.changed && !(await trySafetyRecheck(userId));

      return res.status(200).json({
        success: true,
        data: { ...savedConditions, safetyRecheckRetryNeeded },
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

      const savedAllergies = await SafetyIntakeService.replaceDomains(
        userId,
        ['ALLERGY'],
        [
          ...allergies.map((value: string) => ({
            domain: 'ALLERGY' as const,
            value,
            provenance: 'PREDEFINED' as const,
          })),
          ...(typeof otherAllergies === 'string' && otherAllergies.trim()
            ? [{ domain: 'ALLERGY' as const, value: otherAllergies, provenance: 'CUSTOM' as const }]
            : []),
        ]
      );

      const safetyRecheckRetryNeeded = savedAllergies.changed && !(await trySafetyRecheck(userId));

      return res.status(200).json({
        success: true,
        data: { ...savedAllergies, safetyRecheckRetryNeeded },
      });
    } catch (error: any) {
      console.error('[UserController] updateAllergies error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update food allergens.' });
    }
  }

  /**
   * PUT /api/user/profile/safety
   * Saves conditions and allergies together, then performs one safety scan.
   */
  static async updateSafetyProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { conditions, otherConditions, allergies, otherAllergies } = req.body;
      const saved = await SafetyIntakeService.replaceDomains(
        userId,
        ['CONDITION', 'ALLERGY'],
        [
          ...conditions.map((value: string) => ({
            domain: 'CONDITION' as const,
            value,
            provenance: 'PREDEFINED' as const,
          })),
          ...(otherConditions?.trim()
            ? [{ domain: 'CONDITION' as const, value: otherConditions, provenance: 'CUSTOM' as const }]
            : []),
          ...allergies.map((value: string) => ({
            domain: 'ALLERGY' as const,
            value,
            provenance: 'PREDEFINED' as const,
          })),
          ...(otherAllergies?.trim()
            ? [{ domain: 'ALLERGY' as const, value: otherAllergies, provenance: 'CUSTOM' as const }]
            : []),
        ]
      );
      const safetyRecheckRetryNeeded = saved.changed && !(await trySafetyRecheck(userId));

      return res.status(200).json({ success: true, data: { ...saved, safetyRecheckRetryNeeded } });
    } catch (error: unknown) {
      console.error('[UserController] updateSafetyProfile error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update clinical safety settings.' });
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
      if (error instanceof AppError)
        return res
          .status(error.statusCode)
          .json({ success: false, error: error.message, errorCode: error.errorCode, details: error.details });
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

      const rawVersion = req.query.version;
      if (
        rawVersion !== undefined &&
        (typeof rawVersion !== 'string' || !/^[1-9]\d*$/.test(rawVersion) || !Number.isSafeInteger(Number(rawVersion)))
      ) {
        return res.status(400).json({ success: false, error: 'Choose a valid report version before downloading.' });
      }
      const versionQuery = rawVersion === undefined ? undefined : Number(rawVersion);
      const report =
        versionQuery !== undefined
          ? await NutritionReportService.getVersionReport(userId, versionQuery)
          : await NutritionReportService.getReport(userId);

      if (!report) {
        return res.status(404).json({ success: false, error: 'Report not found.' });
      }

      const userDetails = await UserService.getUserProfileDetails(userId);
      if (!userDetails) {
        return res.status(404).json({ success: false, error: 'User details not found.' });
      }

      const React = await import('react');
      if (!versionQuery && (report.isStale || report.profileRevision !== userDetails?.userProfile?.revision))
        return res
          .status(409)
          .json({ success: false, error: 'Update your report before downloading current guidance.' });
      const { NutritionReportPDF, streamPdf } = await import('@/lib/pdf');
      const document = React.createElement(NutritionReportPDF, {
        user: userDetails,
        report,
        archived: versionQuery !== undefined,
      });
      const stream = await streamPdf(document);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=nutrimind-report-v${report.version}.pdf`);
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
      return res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to generate nutrition report.') });
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

      const { report, planningReadiness } = await NutritionReportService.acknowledgeReport(userId, req.body.version);

      return res.status(200).json({
        success: true,
        data: {
          acknowledgedAt: report.acknowledgedAt,
          version: report.version,
          planningReadiness,
        },
      });
    } catch (error: any) {
      console.error('[UserController] acknowledgeReport error:', error);
      return res.status(error instanceof AppError ? error.statusCode : 503).json({
        success: false,
        errorCode: error instanceof AppError ? error.errorCode : undefined,
        error: sanitizeErrorMessage(error, 'Unable to save acknowledgment right now. Please try again.'),
      });
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

      const result = await updateAccountSettings(userId, req.body);
      if (result.passwordChanged) clearRefreshCookie(res);
      return res.status(200).json({
        success: true,
        message: result.passwordChanged
          ? 'Password changed. Sign in again with your new password.'
          : result.emailChanged
            ? 'Account updated. Verify your new email address to continue.'
            : 'Account settings updated successfully.',
        data: {
          ...result.user,
          requiresSignIn: result.passwordChanged,
          verificationEmailSent: result.verificationEmailSent,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AppError)
        return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
      console.error('[UserController] updateAccountSettings error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update account settings.' });
    }
  }

  /**
   * PUT /api/user/profile/avatar
   * Updates User's avatar seed (stored in image field).
   * 'Default' persists the initials choice across subsequent sign-ins.
   */
  static async updateAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing user payload.' });
      }

      const { image } = req.body;
      if (image !== null && typeof image !== 'string') {
        return res.status(400).json({ success: false, error: 'image seed must be a string or null.' });
      }

      let targetImage: string | null = typeof image === 'string' ? image.trim() : null;
      if (!targetImage || targetImage.toLowerCase() === 'default') {
        targetImage = 'Default';
      }

      const updatedUser = await UserService.updateUserImage(userId, targetImage);

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
