import { Request, Response } from 'express';
import AuthService from '@/services/auth.service';
import { AuthenticatedRequest } from '@/types';

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new user and sends verification email.
   */
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;

      const result = await AuthService.register(name, email, password);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to complete registration.',
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

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to authenticate session.',
      });
    }
  }

  /**
   * POST /api/auth/google
   * Authenticates via Google ID token.
   */
  static async googleAuth(req: Request, res: Response) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Google ID token is required.',
        });
      }

      const result = await AuthService.googleAuth(idToken);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Google authentication failed.',
      });
    }
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
        error: error.message || 'Email verification failed.',
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
        error: error.message || 'Failed to resend verification code.',
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
    } catch (error: any) {
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
        error: error.message || 'Password reset failed.',
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Refreshes access token using a valid refresh token.
   */
  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required.',
        });
      }

      const result = await AuthService.refreshToken(refreshToken);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid or expired session refresh.',
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Clears server-side sessions. Requires authentication.
   */
  static async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (userId) {
        await AuthService.logout(userId);
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully.' },
      });
    } catch (error: any) {
      return res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully.' },
      });
    }
  }
}

export default AuthController;
