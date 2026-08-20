'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import AuthShell from '@/components/auth/AuthShell';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Email Verification Page — 6-digit OTP input with auto-submit and resend cooldown.
 */
export default function VerifyEmailPage() {
  const { refreshSession } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/verify-email', { otp: code });
      if (response.data?.success) {
        setSuccess('Email verified successfully! Redirecting...');
        // Try to refresh session — if it fails (e.g. rate limit), still redirect
        try {
          await refreshSession();
        } catch {
          // Session will be refreshed on next page load via AuthContext
          console.warn('[VerifyEmail] refreshSession failed, redirecting anyway.');
        }
        // Always redirect after successful verification — don't stay stuck
        setTimeout(() => {
          window.location.href = '/onboarding/stats';
        }, 1500);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Verification failed. Please try again.');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [refreshSession]);

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    const fullOtp = otp.join('');
    if (fullOtp.length === 6 && otp.every((d) => d !== '')) {
      handleVerify(fullOtp);
    }
  }, [otp, handleVerify]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take last char only
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await api.post('/auth/resend-verification');
      setSuccess('A new code has been sent to your email.');
      setResendCooldown(60);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to resend code.');
    }
  };


  return (
    <AuthShell
      eyebrow="Identity checkpoint"
      title="Verify your email"
      description="Enter the 6-digit code sent to your inbox to continue into onboarding."
      heroTitle={<>One quick check.<br /><span className="text-brand-accent">Then we personalize.</span></>}
      heroDescription="Verification protects your account before health preferences, meal plans, and progress data are connected to it."
    >
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/[0.07] p-4 text-sm font-semibold text-brand-green">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-tight">{success}</span>
          </div>
        )}

        <div className="mb-8 flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              id={`otp-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="h-14 w-11 rounded-2xl border border-brand-border/80 bg-brand-surface/80 text-center font-mono text-xl font-bold text-brand-text outline-none transition-all duration-200 focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10 disabled:opacity-50 sm:w-12"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {isLoading && (
          <div className="mb-4 text-center">
            <span className="animate-pulse text-sm text-brand-muted">Verifying...</span>
          </div>
        )}

        <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/45 p-4 text-center">
          <p className="mb-2 text-xs text-brand-muted">Didn&apos;t receive the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isLoading}
            className="cursor-pointer text-sm font-bold text-brand-green transition hover:text-brand-cyan disabled:cursor-not-allowed disabled:text-brand-muted"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
    </AuthShell>
  );
}
