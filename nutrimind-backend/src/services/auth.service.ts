import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { JWTPayload } from '@/types';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { OAuth2Client } from 'google-auth-library';

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generates a cryptographically secure random hex token for password resets.
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class AuthService {
  /**
   * Registers a brand-new user into the system.
   * Creates user with emailVerified=false, generates OTP, and sends verification email.
   */
  static async register(name: string, email: string, password: string) {
    const sanitizedEmail = email.trim().toLowerCase();

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      throw new Error('An account with this email address already exists.');
    }

    // Hash the password with 12 salt rounds for strong security
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate email verification OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create User record in the database
    const user = await prisma.user.create({
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
      await sendVerificationEmail(sanitizedEmail, otp, name.trim());
    } catch (emailErr) {
      console.error('[AuthService] Email send failed, but registration continues:', emailErr);
    }

    // Create the session payload
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate tokens (user gets tokens immediately but must verify email to proceed)
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

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
  static async googleAuth(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth is not configured on the server.');
    }

    const client = new OAuth2Client(clientId);

    // Verify the Google ID token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
    } catch {
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
    let user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (user) {
      // Existing user — just log them in
      // If they registered with email/password before, upgrade their emailVerified to true
      if (!user.emailVerified) {
        await prisma.user.update({
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
        await prisma.user.update({
          where: { id: user.id },
          data: { image: picture },
        });
      }
    } else {
      // New user — create account with emailVerified=true (Google already verified)
      // Generate a random password hash (they can only login via Google)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = await prisma.user.create({
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
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

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
  static async verifyEmail(userId: string, otp: string) {
    const user = await prisma.user.findUnique({
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
    const isValid = await bcrypt.compare(otp, user.emailVerificationToken);
    if (!isValid) {
      throw new Error('Invalid verification code. Please check and try again.');
    }

    // Mark email as verified and clear token fields
    await prisma.user.update({
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
  static async resendVerification(userId: string) {
    const user = await prisma.user.findUnique({
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
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: otpHash,
        emailVerificationExpiry: otpExpiry,
      },
    });

    await sendVerificationEmail(user.email, otp, user.name);

    return { message: 'A new verification code has been sent to your email.' };
  }

  /**
   * Validates credentials and logs in the user.
   */
  static async login(email: string, password: string) {
    const sanitizedEmail = email.trim().toLowerCase();

    // Search for user
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      throw new Error('Invalid email or password credentials.');
    }

    // Verify hashed password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password credentials.');
    }

    // Create token payloads
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate tokens
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

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
  static async forgotPassword(email: string) {
    const sanitizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: resetExpiry,
      },
    });

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);
    } catch (emailErr) {
      console.error('[AuthService] Password reset email failed:', emailErr);
    }

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  /**
   * Resets the user's password using a valid reset token.
   */
  static async resetPassword(token: string, newPassword: string) {
    // Find all users with non-null reset tokens (there should be very few)
    const usersWithResetTokens = await prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiry: { gte: new Date() }, // Only non-expired tokens
      },
    });

    // Compare the provided token against each stored hash
    let matchedUser = null;
    for (const user of usersWithResetTokens) {
      if (user.passwordResetToken) {
        const isMatch = await bcrypt.compare(token, user.passwordResetToken);
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
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
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
  static async refreshToken(token: string) {
    // Verify refresh token (throws if invalid or expired)
    const decoded = verifyRefreshToken(token);

    // Fetch user to confirm they still exist and check for role updates
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new Error('User session not found.');
    }

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Issue a fresh access token
    const accessToken = signAccessToken(payload);

    return {
      accessToken,
    };
  }

  /**
   * Logs out the user by deleting all their sessions from the database.
   */
  static async logout(userId: string) {
    await prisma.session.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out successfully.' };
  }
}

export default AuthService;
