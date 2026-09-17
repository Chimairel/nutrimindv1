import nodemailer from 'nodemailer';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

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
type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

let _transporter: MailTransporter | null = null;

function getTransporter(): MailTransporter {
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

const getFromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@kainara.ph';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export type CapturedMail = {
  type:
    | 'EMAIL_VERIFICATION'
    | 'PASSWORD_RESET'
    | 'NUTRITIONIST_INVITATION'
    | 'NUTRITIONIST_CALL_SCHEDULED'
    | 'NUTRITIONIST_APPLICATION_SUBMITTED'
    | 'NUTRITIONIST_APPLICATION_REJECTED';
  to: string;
  token?: string;
  metadata?: Record<string, unknown>;
};

async function captureTestMail(message: CapturedMail): Promise<boolean> {
  const capturePath = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH?.trim();
  if (!capturePath) return false;
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('The test mail capture boundary requires NODE_ENV=test.');
  }
  if (!path.isAbsolute(capturePath)) {
    throw new Error('The test mail capture path must be absolute.');
  }

  await mkdir(path.dirname(capturePath), { recursive: true });
  await appendFile(capturePath, `${JSON.stringify({ ...message, capturedAt: new Date().toISOString() })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return true;
}

interface EmailLayoutOptions {
  title: string;
  kicker?: string;
  recipientName?: string;
  contentHtml: string;
  ctaButton?: {
    label: string;
    url: string;
  };
  footerNote?: string;
}

/**
 * Renders a consistent, mobile-responsive HTML email in KAINARA's signature obsidian/emerald/lime theme.
 */
function renderKainaraEmailLayout(options: EmailLayoutOptions): string {
  const { title, kicker = 'Clinical Nutrition Intelligence', recipientName, contentHtml, ctaButton, footerNote } = options;
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050a08; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e4ebe7;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #050a08; min-height: 100vh; padding: 36px 14px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 540px; margin: 0 auto;">
          <!-- Header Branding -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 14px; background: rgba(184, 244, 95, 0.12); border: 1px solid rgba(184, 244, 95, 0.28); text-align: center; font-size: 22px;">
                      🌱
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: 2.5px; color: #b8f45f; text-transform: uppercase; display: block;">
                      KAINARA
                    </span>
                    <span style="font-size: 10px; font-weight: 700; letter-spacing: 1.8px; color: #698275; text-transform: uppercase; display: block; margin-top: 3px;">
                      ${escapeHtml(kicker)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0d1712; border: 1px solid #1a2f24; border-radius: 24px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45); overflow: hidden;">
                <tr>
                  <td style="padding: 34px 28px;">
                    ${
                      title
                        ? `<h1 style="font-size: 21px; font-weight: 800; color: #f1f7f4; margin: 0 0 16px; line-height: 1.25; letter-spacing: -0.02em;">${escapeHtml(
                            title
                          )}</h1>`
                        : ''
                    }
                    ${
                      recipientName
                        ? `<p style="font-size: 15px; line-height: 1.6; color: #b6c7be; margin: 0 0 16px;">Hi <strong style="color: #ffffff;">${escapeHtml(
                            recipientName
                          )}</strong>,</p>`
                        : ''
                    }
                    
                    <div style="font-size: 14px; line-height: 1.68; color: #cbd5e1;">
                      ${contentHtml}
                    </div>

                    ${
                      ctaButton
                        ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 10px;">
                            <tr>
                              <td align="center">
                                <a href="${ctaButton.url}" target="_blank" style="display: inline-block; background-color: #b8f45f; color: #07100d; font-size: 14px; font-weight: 800; letter-spacing: 0.2px; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(184, 244, 95, 0.25);">
                                  ${escapeHtml(ctaButton.label)}
                                </a>
                              </td>
                            </tr>
                          </table>`
                        : ''
                    }

                    ${
                      footerNote
                        ? `<div style="font-size: 12px; line-height: 1.6; color: #728a7d; margin: 24px 0 0; padding-top: 18px; border-top: 1px solid #16261d;">${footerNote}</div>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Legal & Disclaimer -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 16px;">
              <p style="font-size: 11px; line-height: 1.6; color: #4e6357; margin: 0; text-align: center;">
                © ${currentYear} KAINARA. All rights reserved.<br />
                AI-Assisted Clinical Nutrition &amp; Dietary System · Republic of the Philippines<br />
                <span style="color: #3b4e43;">This is an automated operational notification regarding your account or application.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a 6-digit OTP verification email to the user's inbox.
 */
export async function sendVerificationEmail(to: string, otp: string, userName: string): Promise<void> {
  if (await captureTestMail({ type: 'EMAIL_VERIFICATION', to, token: otp })) return;
  const subject = `KAINARA — Verify Your Email Address`;
  const contentHtml = `
    <p style="margin: 0 0 16px;">Welcome to KAINARA! Please verify your email address by entering the confirmation code below:</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <div style="background-color: #07100d; border: 2px solid #b8f45f; border-radius: 14px; padding: 16px 28px; display: inline-block; letter-spacing: 10px; font-size: 32px; font-weight: 900; color: #b8f45f; font-family: 'Consolas', 'Courier New', monospace; box-shadow: 0 0 24px rgba(184, 244, 95, 0.12);">
            ${escapeHtml(otp)}
          </div>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #8ba395; text-align: center; margin: 0;">
      This security code expires in <strong style="color: #f1f7f4;">15 minutes</strong>. Do not share this code with anyone.
    </p>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Verify Your Email Address',
    kicker: 'Account Verification',
    recipientName: userName,
    contentHtml,
    footerNote: 'If you did not create a KAINARA account, you can safely disregard this email.',
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
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
export async function sendPasswordResetEmail(to: string, resetToken: string, userName: string): Promise<void> {
  if (await captureTestMail({ type: 'PASSWORD_RESET', to, token: resetToken })) return;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  const subject = `KAINARA — Password Reset Request`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">We received a request to reset the password for your KAINARA account. Click the button below to choose a new password:</p>
  `;

  const footerNote = `
    This password reset link expires in <strong style="color: #f1f7f4;">15 minutes</strong>.<br />
    If the button above does not work, copy and paste this URL into your browser:<br />
    <span style="color: #52b788; word-break: break-all;">${escapeHtml(resetLink)}</span><br /><br />
    If you did not request a password reset, your account remains secure and you can safely ignore this email.
  `;

  const html = renderKainaraEmailLayout({
    title: 'Reset Your Password',
    kicker: 'Account Security',
    recipientName: userName,
    contentHtml,
    ctaButton: {
      label: 'Reset Password',
      url: resetLink,
    },
    footerNote,
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
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
  if (await captureTestMail({ type: 'NUTRITIONIST_INVITATION', to, token: invitationToken })) return;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const invitationLink = `${frontendUrl}/nutritionist-invitation?token=${encodeURIComponent(invitationToken)}`;
  const subject = 'KAINARA — Welcome to the Professional Review Team (Account Activation)';

  const contentHtml = `
    <p style="margin: 0 0 16px;">Congratulations! Following your manual PRC credential review and 1-on-1 verification call, your application to join the KAINARA Professional Review Team has been <strong style="color: #b8f45f;">approved</strong>.</p>
    <p style="margin: 0 0 16px;">Please click the button below to create your password and activate your registered nutritionist-dietitian portal workspace:</p>
  `;

  const footerNote = `
    This private activation link expires in <strong style="color: #f1f7f4;">72 hours</strong>.<br />
    If it expires, please contact KAINARA administration so a new invitation can be issued.<br />
    Direct link: <span style="color: #52b788; word-break: break-all;">${escapeHtml(invitationLink)}</span>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Your Application Was Approved',
    kicker: 'Professional Review Team',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Activate Nutritionist Workspace',
      url: invitationLink,
    },
    footerNote,
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
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

export interface NutritionistCallScheduledEmailParams {
  to: string;
  applicantName: string;
  referenceCode: string;
  scheduledCallAt: string | Date;
  meetingUrl: string;
}

/**
 * Sends the applicant an email when the administrator schedules their 1-on-1 verification call.
 */
export async function sendNutritionistCallScheduledEmail(
  params: NutritionistCallScheduledEmailParams
): Promise<void> {
  const { to, applicantName, referenceCode, scheduledCallAt, meetingUrl } = params;
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_CALL_SCHEDULED',
      to,
      metadata: { referenceCode, meetingUrl, scheduledCallAt: new Date(scheduledCallAt).toISOString() },
    })
  ) {
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const callDate = new Date(scheduledCallAt);
  const formattedDate = callDate.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const subject = `KAINARA — 1-on-1 Verification Call Scheduled [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">An administrator has reviewed your professional credentials and confirmed your online identity verification call.</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #07100d; border: 1px solid #1f382a; border-radius: 16px; margin: 20px 0; padding: 20px;">
      <tr>
        <td>
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #698275;">Confirmed Schedule</p>
          <p style="margin: 0 0 16px; font-size: 16px; font-weight: 800; color: #b8f45f;">📅 ${escapeHtml(
            formattedDate
          )}</p>
          
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #698275;">Application Reference</p>
          <p style="margin: 0; font-size: 14px; font-family: monospace; font-weight: 700; color: #f1f7f4;">${escapeHtml(
            referenceCode
          )}</p>
        </td>
      </tr>
    </table>

    <h3 style="font-size: 14px; font-weight: 800; color: #f1f7f4; margin: 20px 0 10px;">📋 Call Preparation Checklist:</h3>
    <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 13px; line-height: 1.7; color: #b6c7be;">
      <li><strong style="color: #ffffff;">Physical PRC ID Card:</strong> Have your original, unexpired PRC license card on hand to show to the camera.</li>
      <li><strong style="color: #ffffff;">Device &amp; Video Setup:</strong> Ensure your webcam and microphone are working in advance.</li>
      <li><strong style="color: #ffffff;">Punctuality:</strong> Please join the video meeting room 5 minutes before the scheduled time.</li>
    </ul>
  `;

  const footerNote = `
    Direct meeting link: <a href="${meetingUrl}" style="color: #52b788; word-break: break-all;">${escapeHtml(meetingUrl)}</a><br /><br />
    You can also track your real-time application timeline at the <a href="${frontendUrl}/nutritionist-apply" style="color: #b8f45f; text-decoration: none; font-weight: 700;">KAINARA Application Portal</a> using reference code <strong style="color: #ffffff;">${escapeHtml(referenceCode)}</strong>.
  `;

  const html = renderKainaraEmailLayout({
    title: '1-on-1 Verification Call Scheduled',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Join Video Call',
      url: meetingUrl,
    },
    footerNote,
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist call scheduled email sent to ${to} for call at ${formattedDate}`);
  } catch (error: any) {
    console.error(`[Email] Failed to send call scheduled email to ${to}:`, error.message);
    throw new Error('Failed to send call scheduled email. Please check SMTP configuration.');
  }
}

/**
 * Sends a confirmation email to the applicant immediately upon submitting their application.
 */
export async function sendNutritionistApplicationSubmittedEmail(
  to: string,
  applicantName: string,
  referenceCode: string
): Promise<void> {
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_APPLICATION_SUBMITTED',
      to,
      metadata: { referenceCode },
    })
  ) {
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `KAINARA — Application Received [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">Thank you for applying to join the KAINARA Professional Review Team. Your application has been successfully received and logged into our review queue.</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #07100d; border: 1px solid #1f382a; border-radius: 16px; margin: 20px 0; padding: 20px;">
      <tr>
        <td align="center">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #698275;">Your Tracking Reference Code</p>
          <p style="margin: 0; font-size: 22px; font-family: 'Consolas', 'Courier New', monospace; font-weight: 900; color: #b8f45f; letter-spacing: 2.5px;">${escapeHtml(
            referenceCode
          )}</p>
        </td>
      </tr>
    </table>

    <h3 style="font-size: 14px; font-weight: 800; color: #f1f7f4; margin: 20px 0 10px;">Review Timeline &amp; Next Steps:</h3>
    <ol style="margin: 0 0 20px; padding-left: 20px; font-size: 13px; line-height: 1.7; color: #b6c7be;">
      <li><strong style="color: #ffffff;">Credential Review:</strong> Our administrative team manually verifies your PRC license number and background.</li>
      <li><strong style="color: #ffffff;">1-on-1 Verification Call:</strong> An administrator will review your availability slots and email you a confirmed video meeting link.</li>
      <li><strong style="color: #ffffff;">Workspace Activation:</strong> After the call, you will receive an official invitation link to activate your workspace.</li>
    </ol>
  `;

  const footerNote = `
    Save this email for your records. You can check your application progress anytime on the <a href="${frontendUrl}/nutritionist-apply" style="color: #b8f45f; text-decoration: none; font-weight: 700;">KAINARA Application Portal</a> using your reference code.
  `;

  const html = renderKainaraEmailLayout({
    title: 'Application Received',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'Track Application Status',
      url: `${frontendUrl}/nutritionist-apply`,
    },
    footerNote,
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist application received email sent to ${to} (ref: ${referenceCode})`);
  } catch (error: any) {
    console.error(`[Email] Failed to send application received email to ${to}:`, error.message);
    throw new Error('Failed to send application received email. Please check SMTP configuration.');
  }
}

/**
 * Sends a notification email if an application cannot be approved.
 */
export async function sendNutritionistApplicationRejectedEmail(
  to: string,
  applicantName: string,
  referenceCode: string,
  reason: string
): Promise<void> {
  if (
    await captureTestMail({
      type: 'NUTRITIONIST_APPLICATION_REJECTED',
      to,
      metadata: { referenceCode, reason },
    })
  ) {
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `KAINARA — Nutritionist Application Status Update [${referenceCode}]`;

  const contentHtml = `
    <p style="margin: 0 0 16px;">Thank you for your interest in joining the KAINARA Professional Review Team. An administrator has completed the review of your application (Ref: <strong style="color: #f1f7f4; font-family: monospace;">${escapeHtml(
      referenceCode
    )}</strong>).</p>
    <p style="margin: 0 0 16px;">At this time, we are unable to advance your application for the following reason:</p>
    <div style="background-color: #07100d; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin: 20px 0; color: #f87171; font-size: 13px; line-height: 1.6;">
      ${escapeHtml(reason)}
    </div>
    <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
      If your credentials have recently been renewed or if you wish to provide additional documentation, you may submit an updated application with current PRC registration.
    </p>
  `;

  const html = renderKainaraEmailLayout({
    title: 'Application Status Update',
    kicker: 'Nutritionist Application',
    recipientName: applicantName,
    contentHtml,
    ctaButton: {
      label: 'View Application Details',
      url: `${frontendUrl}/nutritionist-apply`,
    },
    footerNote: 'If you have questions regarding this decision, contact KAINARA administration.',
  });

  try {
    await getTransporter().sendMail({
      from: `"KAINARA" <${getFromAddress()}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Nutritionist application rejected email sent to ${to} (ref: ${referenceCode})`);
  } catch (error: any) {
    console.error(`[Email] Failed to send application rejected email to ${to}:`, error.message);
    throw new Error('Failed to send application rejected email. Please check SMTP configuration.');
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

