export declare class AuthService {
    /**
     * Registers a brand-new user into the system.
     * Checks for email duplication, hashes credentials, and outputs session tokens.
     */
    static register(name: string, email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            onboardingDone: boolean;
        };
        accessToken: string;
        refreshToken: string;
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
            onboardingDone: boolean;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Refreshes an expired access token using a valid refresh token.
     */
    static refreshToken(token: string): Promise<{
        accessToken: string;
    }>;
}
export default AuthService;
//# sourceMappingURL=auth.service.d.ts.map