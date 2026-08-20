export declare class AuthService {
    /**
     * Registers a brand-new user into the system.
     * Creates user with emailVerified=false, generates OTP, and sends verification email.
     */
    static register(name: string, email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            emailVerified: boolean;
            onboardingDone: boolean;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Authenticates a user via Google OAuth.
     * Verifies the Google ID token, creates or finds the user, and returns JWT tokens.
     * Google-authenticated users have emailVerified=true automatically.
     */
    static googleAuth(idToken: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            emailVerified: boolean;
            onboardingDone: boolean;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Verifies the user's email using the 6-digit OTP.
     */
    static verifyEmail(userId: string, otp: string): Promise<{
        emailVerified: boolean;
        message: string;
    }>;
    /**
     * Resends a new verification OTP to the user's email.
     */
    static resendVerification(userId: string): Promise<{
        message: string;
    }>;
    /**
     * Validates credentials and logs in the user.
     */
    static login(email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            emailVerified: boolean;
            onboardingDone: boolean;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Initiates password reset by sending a reset link email.
     * Always returns success message to prevent email enumeration attacks.
     */
    static forgotPassword(email: string): Promise<{
        message: string;
    }>;
    /**
     * Resets the user's password using a valid reset token.
     */
    static resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    /**
     * Refreshes an expired access token using a valid refresh token.
     */
    static refreshToken(token: string): Promise<{
        accessToken: string;
    }>;
    /**
     * Logs out the user by deleting all their sessions from the database.
     */
    static logout(userId: string): Promise<{
        message: string;
    }>;
}
export default AuthService;
//# sourceMappingURL=auth.service.d.ts.map