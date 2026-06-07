"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const jwt_1 = require("@/lib/jwt");
class AuthService {
    /**
     * Registers a brand-new user into the system.
     * Checks for email duplication, hashes credentials, and outputs session tokens.
     */
    static async register(name, email, password) {
        const sanitizedEmail = email.trim().toLowerCase();
        // Check if the user already exists
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email: sanitizedEmail },
        });
        if (existingUser) {
            throw new Error('An account with this email address already exists.');
        }
        // Hash the password with 12 salt rounds for strong security
        const salt = await bcryptjs_1.default.genSalt(12);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Create User record in the database
        const user = await prisma_1.default.user.create({
            data: {
                name: name.trim(),
                email: sanitizedEmail,
                passwordHash,
                role: 'USER', // Default role for standard onboarding users
            },
        });
        // Create the session payload
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        // Generate tokens
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                onboardingDone: user.onboardingDone,
            },
            accessToken,
            refreshToken,
        };
    }
    /**
     * Validates credentials and logs in the user.
     */
    static async login(email, password) {
        const sanitizedEmail = email.trim().toLowerCase();
        // Search for user
        const user = await prisma_1.default.user.findUnique({
            where: { email: sanitizedEmail },
        });
        if (!user) {
            throw new Error('Invalid email or password credentials.');
        }
        // Verify hashed password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password credentials.');
        }
        // Create token payloads
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        // Generate tokens
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                onboardingDone: user.onboardingDone,
            },
            accessToken,
            refreshToken,
        };
    }
    /**
     * Refreshes an expired access token using a valid refresh token.
     */
    static async refreshToken(token) {
        // Verify refresh token (throws if invalid or expired)
        const decoded = (0, jwt_1.verifyRefreshToken)(token);
        // Fetch user to confirm they still exist and check for role updates
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) {
            throw new Error('User session not found.');
        }
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        // Issue a fresh access token
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        return {
            accessToken,
        };
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
//# sourceMappingURL=auth.service.js.map