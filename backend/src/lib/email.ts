import nodemailer from 'nodemailer';

/**
 * Email service using Nodemailer + Gmail SMTP.
 * 
 * REQUIRED .env variables:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your.email@gmail.com
 *   SMTP_PASS=your-16-char-app-password
 *   EMAIL_FROM=your.email@gmail.com
 */

// Lazy-initialized transporter (ensures env vars are loaded before creation)
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

const getFromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@nutrimind.app';
const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Sends a 6-digit OTP verification email to the user's inbox.
 */
export async function sendVerificationEmail(to: string, otp: string, userName: string): Promise<void> {
  const subject = `🧠 NutriMind — Verify Your Email Address`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d0d; color: #e0e0e0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🧠</span>
        <h1 style="color: #52B788; font-size: 24px; margin: 8px 0 0;">NutriMind</h1>
        <p style="color: #888; font-size: 13px;">AI-Powered Nutrition Planning</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6;">Hi <strong>${userName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6;">
        Welcome to NutriMind! Please verify your email address by entering the code below:
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #1a1a2e; border: 2px solid #52B788; border-radius: 12px; padding: 16px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #52B788;">
          ${otp}
        </div>
      </div>
      
      <p style="font-size: 13px; color: #888; text-align: center;">
        This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
      </p>
      
      <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
      <p style="font-size: 11px; color: #555; text-align: center;">
        If you didn't create a NutriMind account, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"NutriMind" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Verification OTP sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send verification email to ${to}:`, error.message);
    throw new Error('Failed to send verification email. Please check SMTP configuration.');
  }
}

/**
 * Sends a password reset email with a reset link containing the token.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  userName: string
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  const subject = `🔐 NutriMind — Password Reset Request`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d0d; color: #e0e0e0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🔐</span>
        <h1 style="color: #52B788; font-size: 24px; margin: 8px 0 0;">Password Reset</h1>
        <p style="color: #888; font-size: 13px;">NutriMind Account Security</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6;">Hi <strong>${userName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block; background: #52B788; color: #0d0d0d; font-weight: bold; font-size: 16px; padding: 14px 48px; border-radius: 12px; text-decoration: none;">
          Reset Password
        </a>
      </div>
      
      <p style="font-size: 13px; color: #888; text-align: center;">
        This link expires in <strong>15 minutes</strong>.
      </p>
      <p style="font-size: 12px; color: #666; text-align: center;">
        If the button doesn't work, copy this link: <br/>
        <a href="${resetLink}" style="color: #52B788; word-break: break-all;">${resetLink}</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
      <p style="font-size: 11px; color: #555; text-align: center;">
        If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
      </p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"NutriMind" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Password reset email sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send password reset email to ${to}:`, error.message);
    throw new Error('Failed to send password reset email. Please check SMTP configuration.');
  }
}

/** Sends an approved nutritionist applicant an expiring account-activation link. */
export async function sendNutritionistInvitationEmail(
  to: string,
  invitationToken: string,
  applicantName: string
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const invitationLink = `${frontendUrl}/nutritionist-invitation?token=${encodeURIComponent(invitationToken)}`;
  const subject = 'NutriMind — Your nutritionist application was approved';
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #07100d; color: #e8f3ec; border-radius: 16px;">
      <h1 style="color: #b8f45f; font-size: 24px; margin: 0 0 20px;">Welcome to NutriMind</h1>
      <p style="font-size: 15px; line-height: 1.7;">Hi <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.7;">Your professional application and verification call have been approved. Create your private password to activate your nutritionist workspace.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationLink}" style="display: inline-block; background: #b8f45f; color: #07100d; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none;">Activate nutritionist account</a>
      </div>
      <p style="font-size: 13px; color: #9aaba2;">This private invitation expires in 72 hours. If it expires, contact NutriMind so an administrator can issue a new one.</p>
      <p style="font-size: 11px; color: #718079; word-break: break-all;">${invitationLink}</p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"NutriMind" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist invitation sent to ${to}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send nutritionist invitation to ${to}:`, error.message);
    throw new Error('Failed to send nutritionist invitation. Please check SMTP configuration.');
  }
}

/**
 * Verify that the SMTP transporter is properly configured.
 * Call this on server start to catch configuration issues early.
 */
export async function verifyEmailTransporter(): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ [Email] SMTP_USER or SMTP_PASS not configured. Email sending will fail.');
    return false;
  }
  try {
    await getTransporter().verify();
    console.log('✅ [Email] SMTP transporter verified and ready.');
    return true;
  } catch (error: any) {
    console.warn(`⚠️ [Email] SMTP transporter verification failed: ${error.message}`);
    return false;
  }
}
