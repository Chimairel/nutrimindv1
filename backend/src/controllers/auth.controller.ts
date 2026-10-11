import { databaseAvailabilityFailure } from '@/lib/database-availability';
import { sendApiError } from '@/lib/http-response';
import { Request, Response } from 'express';
import AuthService, { GoogleAuthFlowError } from '@/services/auth.service';
import { accountCreationLimiter } from '@/middleware/rateLimiter';
import { AuthenticatedRequest } from '@/types';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

/** Shared cookie options for the HttpOnly refresh token. */
const REFRESH_COOKIE_NAME = 'nutrimind_refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/** Run the shared registration budget only once a verified identity needs a new account. */
function admitGoogleAccountCreation(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    const onFinish = () => reject(new Error('Account creation request was stopped.'));
    res.once('finish', onFinish);
    Promise.resolve(
      accountCreationLimiter(req, res, (error) => {
        res.removeListener('finish', onFinish);
        if (error) reject(error);
        else resolve();
      })
    ).catch((error) => {
      res.removeListener('finish', onFinish);
      reject(error);
    });
  });
}

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new user and sends verification email.
   */
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;

      const result = await AuthService.register(name, email, password);

      // Set refresh token as HttpOnly cookie, send only accessToken in body
      setRefreshCookie(res, result.refreshToken);

      return res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          verificationEmailSent: result.verificationEmailSent,
        },
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to complete registration.'),
      });
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates credentials and returns tokens.
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      // Set refresh token as HttpOnly cookie, send only accessToken in body
      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      const unavailable = databaseAvailabilityFailure(error);
      if (unavailable) return sendApiError(res, 503, unavailable.message, unavailable.errorCode);
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to authenticate session.'),
      });
    }
  }

  private static async handleGoogleAuth(req: Request, res: Response, intent: 'LOGIN' | 'REGISTER' | 'CONTINUE') {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Google ID token is required.',
        });
      }

      const result =
        intent === 'CONTINUE'
          ? await AuthService.googleContinue(idToken, () => admitGoogleAccountCreation(req, res))
          : intent === 'REGISTER'
            ? await AuthService.googleRegister(idToken)
            : await AuthService.googleLogin(idToken);

      // Set refresh token as HttpOnly cookie, send only accessToken in body
      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      if (res.headersSent) return;
      if (error instanceof GoogleAuthFlowError) {
        return res.status(error.status).json({
          success: false,
          errorCode: error.code,
          error: error.message,
        });
      }
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Google authentication failed.'),
      });
    }
  }

  /** Unified Google continuation; only new accounts consume the creation budget. */
  static async googleContinue(req: Request, res: Response) {
    return AuthController.handleGoogleAuth(req, res, 'CONTINUE');
  }

  /** Authenticates an existing KAINARA account with Google. */
  static async googleLogin(req: Request, res: Response) {
    return AuthController.handleGoogleAuth(req, res, 'LOGIN');
  }

  /** Creates a new KAINARA account from a verified Google identity. */
  static async googleRegister(req: Request, res: Response) {
    return AuthController.handleGoogleAuth(req, res, 'REGISTER');
  }

  /**
   * POST /api/auth/verify-email
   * Verifies email with 6-digit OTP. Requires authentication.
   */
  static async verifyEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const { otp } = req.body;
      if (!otp || typeof otp !== 'string') {
        return res.status(400).json({ success: false, error: 'A 6-digit verification code is required.' });
      }

      const result = await AuthService.verifyEmail(userId, otp.trim());

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Email verification failed.'),
      });
    }
  }

  /**
   * POST /api/auth/resend-verification
   * Resends OTP to user's email. Requires authentication.
   */
  static async resendVerification(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const result = await AuthService.resendVerification(userId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Failed to resend verification code.'),
      });
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Sends password reset email. Public endpoint.
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, error: 'Email address is required.' });
      }

      const result = await AuthService.forgotPassword(email);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (_error: any) {
      return res.status(500).json({
        success: false,
        error: 'An error occurred processing your request.',
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Resets password using a valid reset token. Public endpoint.
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
      }

      const result = await AuthService.resetPassword(token, password);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Password reset failed.'),
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Refreshes access token using a valid refresh token.
   */
  static async refresh(req: Request, res: Response) {
    try {
      // Read refresh token from HttpOnly cookie first, fall back to body for backwards compat
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required.',
        });
      }

      const result = await AuthService.refreshToken(refreshToken);
      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        success: true,
        data: { accessToken: result.accessToken },
      });
    } catch (error: any) {
      // Database outages are not evidence that the refresh session is invalid.
      const unavailable = databaseAvailabilityFailure(error);
      if (unavailable) return sendApiError(res, 503, unavailable.message, unavailable.errorCode);
      if (error instanceof Error && error.name.startsWith('PrismaClient')) {
        return sendApiError(
          res,
          503,
          'Session refresh is temporarily unavailable. Please try again.',
          'SESSION_REFRESH_UNAVAILABLE'
        );
      }
      // Clear the cookie only when the refresh session is rejected.
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        error: sanitizeErrorMessage(error, 'Invalid or expired session refresh.'),
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Clears the current refresh session and browser cookie even if access expired.
   */
  static async logout(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      if (refreshToken) {
        await AuthService.logoutWithRefreshToken(refreshToken);
      }

      clearRefreshCookie(res);

      return res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully.' },
      });
    } catch (_error: any) {
      clearRefreshCookie(res);
      return res.status(503).json({
        success: false,
        error: 'Could not revoke the session right now. Please try again.',
      });
    }
  }
}

export default AuthController;
