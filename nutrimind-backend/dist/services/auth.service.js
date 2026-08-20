"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const jwt_1 = require("@/lib/jwt");
const email_1 = require("@/lib/email");
const google_auth_library_1 = require("google-auth-library");
/**
 * Generates a cryptographically secure 6-digit OTP.
 */
function generateOTP() {
    return crypto_1.default.randomInt(100000, 999999).toString();
}
/**
 * Generates a cryptographically secure random hex token for password resets.
 */
function generateResetToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
class AuthService {
    /**
     * Registers a brand-new user into the system.
     * Creates user with emailVerified=false, generates OTP, and sends verification email.
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
        // Generate email verification OTP
        const otp = generateOTP();
        const otpHash = await bcryptjs_1.default.hash(otp, 10);
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // Create User record in the database
        const user = await prisma_1.default.user.create({
            data: {
                name: name.trim(),
                email: sanitizedEmail,
                passwordHash,
                role: 'USER',
                emailVerified: false,
                emailVerificationToken: otpHash,
                emailVerificationExpiry: otpExpiry,
            },
        });
        // Send verification email (non-blocking — don't crash registration if email fails)
        try {
            await (0, email_1.sendVerificationEmail)(sanitizedEmail, otp, name.trim());
        }
        catch (emailErr) {
            console.error('[AuthService] Email send failed, but registration continues:', emailErr);
        }
        // Create the session payload
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        // Generate tokens (user gets tokens immediately but must verify email to proceed)
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified,
                onboardingDone: user.onboardingDone,
            },
            accessToken,
            refreshToken,
        };
    }
    /**
     * Authenticates a user via Google OAuth.
     * Verifies the Google ID token, creates or finds the user, and returns JWT tokens.
     * Google-authenticated users have emailVerified=true automatically.
     */
    static async googleAuth(idToken) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            throw new Error('Google OAuth is not configured on the server.');
        }
        const client = new google_auth_library_1.OAuth2Client(clientId);
        // Verify the Google ID token
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken,
                audience: clientId,
            });
        }
        catch {
            throw new Error('Invalid Google credential. Please try again.');
        }
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            throw new Error('Unable to retrieve account information from Google.');
        }
        const { email, given_name, family_name, name: googleName, picture } = payload;
        const sanitizedEmail = email.trim().toLowerCase();
        const displayName = [given_name, family_name].filter(Boolean).join(' ') || googleName || 'Google User';
        // Check if user already exists
        let user = await prisma_1.default.user.findUnique({
            where: { email: sanitizedEmail },
        });
        if (user) {
            // Existing user — just log them in
            // If they registered with email/password before, upgrade their emailVerified to true
            if (!user.emailVerified) {
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        emailVerificationToken: null,
                        emailVerificationExpiry: null,
                    },
                });
                user = { ...user, emailVerified: true };
            }
            // Update profile picture if they don't have one
            if (!user.image && picture) {
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: { image: picture },
                });
            }
        }
        else {
            // New user — create account with emailVerified=true (Google already verified)
            // Generate a random password hash (they can only login via Google)
            const randomPassword = crypto_1.default.randomBytes(32).toString('hex');
            const salt = await bcryptjs_1.default.genSalt(12);
            const passwordHash = await bcryptjs_1.default.hash(randomPassword, salt);
            user = await prisma_1.default.user.create({
                data: {
                    name: displayName,
                    email: sanitizedEmail,
                    passwordHash,
                    role: 'USER',
                    emailVerified: true,
                    image: picture || null,
                },
            });
        }
        // Create token payloads
        const jwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = (0, jwt_1.signAccessToken)(jwtPayload);
        const refreshToken = (0, jwt_1.signRefreshToken)(jwtPayload);
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified,
                onboardingDone: user.onboardingDone,
            },
            accessToken,
            refreshToken,
        };
    }
    /**
     * Verifies the user's email using the 6-digit OTP.
     */
    static async verifyEmail(userId, otp) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found.');
        }
        if (user.emailVerified) {
            return { emailVerified: true, message: 'Email is already verified.' };
        }
        if (!user.emailVerificationToken || !user.emailVerificationExpiry) {
            throw new Error('No verification code found. Please request a new one.');
        }
        // Check if OTP has expired
        if (new Date() > user.emailVerificationExpiry) {
            throw new Error('Verification code has expired. Please request a new one.');
        }
        // Compare OTP hash
        const isValid = await bcryptjs_1.default.compare(otp, user.emailVerificationToken);
        if (!isValid) {
            throw new Error('Invalid verification code. Please check and try again.');
        }
        // Mark email as verified and clear token fields
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpiry: null,
            },
        });
        return { emailVerified: true, message: 'Email verified successfully.' };
    }
    /**
     * Resends a new verification OTP to the user's email.
     */
    static async resendVerification(userId) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found.');
        }
        if (user.emailVerified) {
            return { message: 'Email is already verified.' };
        }
        // Generate new OTP
        const otp = generateOTP();
        const otpHash = await bcryptjs_1.default.hash(otp, 10);
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
        await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                emailVerificationToken: otpHash,
                emailVerificationExpiry: otpExpiry,
            },
        });
        await (0, email_1.sendVerificationEmail)(user.email, otp, user.name);
        return { message: 'A new verification code has been sent to your email.' };
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
                emailVerified: user.emailVerified,
                onboardingDone: user.onboardingDone,
            },
            accessToken,
            refreshToken,
        };
    }
    /**
     * Initiates password reset by sending a reset link email.
     * Always returns success message to prevent email enumeration attacks.
     */
    static async forgotPassword(email) {
        const sanitizedEmail = email.trim().toLowerCase();
        const user = await prisma_1.default.user.findUnique({
            where: { email: sanitizedEmail },
        });
        // Always return success to prevent email enumeration
        if (!user) {
            return { message: 'If an account with that email exists, a reset link has been sent.' };
        }
        // Generate reset token
        const resetToken = generateResetToken();
        const resetTokenHash = await bcryptjs_1.default.hash(resetToken, 10);
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetTokenHash,
                passwordResetExpiry: resetExpiry,
            },
        });
        // Send reset email
        try {
            await (0, email_1.sendPasswordResetEmail)(user.email, resetToken, user.name);
        }
        catch (emailErr) {
            console.error('[AuthService] Password reset email failed:', emailErr);
        }
        return { message: 'If an account with that email exists, a reset link has been sent.' };
    }
    /**
     * Resets the user's password using a valid reset token.
     */
    static async resetPassword(token, newPassword) {
        // Find all users with non-null reset tokens (there should be very few)
        const usersWithResetTokens = await prisma_1.default.user.findMany({
            where: {
                passwordResetToken: { not: null },
                passwordResetExpiry: { gte: new Date() }, // Only non-expired tokens
            },
        });
        // Compare the provided token against each stored hash
        let matchedUser = null;
        for (const user of usersWithResetTokens) {
            if (user.passwordResetToken) {
                const isMatch = await bcryptjs_1.default.compare(token, user.passwordResetToken);
                if (isMatch) {
                    matchedUser = user;
                    break;
                }
            }
        }
        if (!matchedUser) {
            throw new Error('Invalid or expired reset link. Please request a new one.');
        }
        // Hash the new password and clear reset fields
        const salt = await bcryptjs_1.default.genSalt(12);
        const passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        await prisma_1.default.user.update({
            where: { id: matchedUser.id },
            data: {
                passwordHash,
                passwordResetToken: null,
                passwordResetExpiry: null,
            },
        });
        return { message: 'Password has been reset successfully. You can now log in.' };
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
    /**
     * Logs out the user by deleting all their sessions from the database.
     */
    static async logout(userId) {
        await prisma_1.default.session.deleteMany({
            where: { userId },
        });
        return { message: 'Logged out successfully.' };
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
//# sourceMappingURL=auth.service.js.map