"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = __importDefault(require("@/controllers/auth.controller"));
const validate_1 = __importDefault(require("@/middleware/validate"));
const auth_1 = __importDefault(require("@/middleware/auth"));
const rateLimiter_1 = require("@/middleware/rateLimiter");
const router = (0, express_1.Router)();
// NOTE: authLimiter is applied only to brute-force-vulnerable routes (login, register, forgot-password)
// NOT to verify-email, resend, refresh, or logout (those require auth tokens and aren't brute-force targets)
/**
 * Route: POST /api/auth/register
 * Description: Registers a new user with email verification OTP.
 */
router.post('/register', rateLimiter_1.authLimiter, [
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required.'),
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long.')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number.'),
    validate_1.default,
], auth_controller_1.default.register);
/**
 * Route: POST /api/auth/login
 * Description: Logs in an existing user.
 */
router.post('/login', rateLimiter_1.authLimiter, [
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address.'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required.'),
    validate_1.default,
], auth_controller_1.default.login);
/**
 * Route: POST /api/auth/google
 * Description: Authenticates using a Google ID token (OAuth).
 */
router.post('/google', rateLimiter_1.authLimiter, auth_controller_1.default.googleAuth);
/**
 * Route: POST /api/auth/verify-email
 * Description: Verifies user's email with 6-digit OTP. Requires auth token.
 */
router.post('/verify-email', auth_1.default, [
    (0, express_validator_1.body)('otp')
        .trim()
        .isLength({ min: 6, max: 6 })
        .withMessage('Verification code must be exactly 6 digits.')
        .isNumeric()
        .withMessage('Verification code must contain only numbers.'),
    validate_1.default,
], auth_controller_1.default.verifyEmail);
/**
 * Route: POST /api/auth/resend-verification
 * Description: Resends a new OTP to the user's email. Requires auth token.
 */
router.post('/resend-verification', auth_1.default, auth_controller_1.default.resendVerification);
/**
 * Route: POST /api/auth/forgot-password
 * Description: Sends password reset email. Public endpoint.
 */
router.post('/forgot-password', rateLimiter_1.authLimiter, [
    (0, express_validator_1.body)('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address.'),
    validate_1.default,
], auth_controller_1.default.forgotPassword);
/**
 * Route: POST /api/auth/reset-password
 * Description: Resets password with a valid token. Public endpoint.
 */
router.post('/reset-password', [
    (0, express_validator_1.body)('token')
        .notEmpty()
        .withMessage('Reset token is required.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long.')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number.'),
    validate_1.default,
], auth_controller_1.default.resetPassword);
/**
 * Route: POST /api/auth/refresh
 * Description: Refreshes an expired access token using a valid refresh token.
 */
router.post('/refresh', auth_controller_1.default.refresh);
/**
 * Route: POST /api/auth/logout
 * Description: Logs out and clears server-side session. Requires auth token.
 */
router.post('/logout', auth_1.default, auth_controller_1.default.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map