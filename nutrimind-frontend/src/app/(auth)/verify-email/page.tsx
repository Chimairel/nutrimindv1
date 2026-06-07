'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';

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
        await refreshSession();
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
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12 relative overflow-hidden select-none">
      {/* Decorative glow */}
      <div className="absolute top-[30%] left-[50%] translate-x-[-50%] h-[350px] w-[350px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Card className="w-full max-w-md p-8 relative glass-panel shadow-2xl border-brand-border/80">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="text-5xl">📧</span>
          <h2 className="text-2xl font-extrabold tracking-wider text-brand-green font-display">
            VERIFY YOUR EMAIL
          </h2>
          <p className="text-sm text-brand-muted px-4">
            We sent a 6-digit verification code to your email. Enter it below to continue.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-brand-green/10 border border-brand-green/25 text-brand-green text-sm font-semibold flex items-center gap-2">
            <span>✅</span>
            <span className="leading-tight">{success}</span>
          </div>
        )}

        {/* OTP Input Grid */}
        <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
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
              className="w-12 h-14 text-center text-2xl font-bold bg-brand-card border-2 border-brand-border rounded-xl text-brand-text focus:border-brand-green focus:outline-none transition-all duration-200 disabled:opacity-50"
              autoFocus={index === 0}
            />
          ))}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center mb-4">
            <span className="text-brand-muted text-sm animate-pulse">Verifying...</span>
          </div>
        )}

        {/* Resend */}
        <div className="text-center">
          <p className="text-xs text-brand-muted mb-2">Didn&apos;t receive the code?</p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || isLoading}
            className="text-brand-green hover:underline text-sm font-bold transition-all disabled:text-brand-muted disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </Card>
    </div>
  );
}
