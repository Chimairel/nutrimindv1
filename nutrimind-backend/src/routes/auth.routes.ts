import { Router } from 'express';
import { body } from 'express-validator';
import AuthController from '@/controllers/auth.controller';
import validate from '@/middleware/validate';
import authenticate from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiter';

const router = Router();

// NOTE: authLimiter is applied only to brute-force-vulnerable routes (login, register, forgot-password)
// NOT to verify-email, resend, refresh, or logout (those require auth tokens and aren't brute-force targets)

/**
 * Route: POST /api/auth/register
 * Description: Registers a new user with email verification OTP.
 */
router.post(
  '/register',
  authLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required.'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.'),
    validate,
  ],
  AuthController.register
);

/**
 * Route: POST /api/auth/login
 * Description: Logs in an existing user.
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address.'),
    body('password')
      .notEmpty()
      .withMessage('Password is required.'),
    validate,
  ],
  AuthController.login
);

/**
 * Route: POST /api/auth/google
 * Description: Authenticates using a Google ID token (OAuth).
 */
router.post(
  '/google',
  authLimiter,
  AuthController.googleAuth
);

/**
 * Route: POST /api/auth/verify-email
 * Description: Verifies user's email with 6-digit OTP. Requires auth token.
 */
router.post(
  '/verify-email',
  authenticate,
  [
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be exactly 6 digits.')
      .isNumeric()
      .withMessage('Verification code must contain only numbers.'),
    validate,
  ],
  AuthController.verifyEmail
);

/**
 * Route: POST /api/auth/resend-verification
 * Description: Resends a new OTP to the user's email. Requires auth token.
 */
router.post('/resend-verification', authenticate, AuthController.resendVerification);

/**
 * Route: POST /api/auth/forgot-password
 * Description: Sends password reset email. Public endpoint.
 */
router.post(
  '/forgot-password',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address.'),
    validate,
  ],
  AuthController.forgotPassword
);

/**
 * Route: POST /api/auth/reset-password
 * Description: Resets password with a valid token. Public endpoint.
 */
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.'),
    validate,
  ],
  AuthController.resetPassword
);

/**
 * Route: POST /api/auth/refresh
 * Description: Refreshes an expired access token using a valid refresh token.
 */
router.post('/refresh', AuthController.refresh);

/**
 * Route: POST /api/auth/logout
 * Description: Logs out and clears server-side session. Requires auth token.
 */
router.post('/logout', authenticate, AuthController.logout);

export default router;
