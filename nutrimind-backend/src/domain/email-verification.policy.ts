export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
export const EMAIL_VERIFICATION_LOCK_MS = 15 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function getRemainingResendSeconds(lastSentAt: Date | null, now = new Date()): number {
  if (!lastSentAt) return 0;
  const remainingMs = EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - (now.getTime() - lastSentAt.getTime());
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function isVerificationLocked(lockedUntil: Date | null, now = new Date()): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

export function canResendVerification(lastSentAt: Date | null, now = new Date()): boolean {
  return getRemainingResendSeconds(lastSentAt, now) === 0;
}

export function getVerificationFailureState(currentFailedAttempts: number, now = new Date()) {
  const failedAttempts = currentFailedAttempts + 1;
  return {
    failedAttempts,
    lockedUntil: failedAttempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS
      ? new Date(now.getTime() + EMAIL_VERIFICATION_LOCK_MS)
      : null,
  };
}
