import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare class AuthController {
    /**
     * POST /api/auth/register
     * Registers a new user and sends verification email.
     */
    static register(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/login
     * Authenticates credentials and returns tokens.
     */
    static login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/google
     * Authenticates via Google ID token.
     */
    static googleAuth(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/verify-email
     * Verifies email with 6-digit OTP. Requires authentication.
     */
    static verifyEmail(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/resend-verification
     * Resends OTP to user's email. Requires authentication.
     */
    static resendVerification(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/forgot-password
     * Sends password reset email. Public endpoint.
     */
    static forgotPassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/reset-password
     * Resets password using a valid reset token. Public endpoint.
     */
    static resetPassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/refresh
     * Refreshes access token using a valid refresh token.
     */
    static refresh(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/logout
     * Clears server-side sessions. Requires authentication.
     */
    static logout(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export default AuthController;
//# sourceMappingURL=auth.controller.d.ts.map