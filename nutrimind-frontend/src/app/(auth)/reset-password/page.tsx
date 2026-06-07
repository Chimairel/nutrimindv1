'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import axios from 'axios';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to reset password.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold">
          ⚠️ Invalid or missing reset token. Please request a new password reset.
        </div>
        <Link href="/forgot-password" className="text-brand-green hover:underline font-bold text-sm">
          Request New Reset Link
        </Link>
      </div>
    );
  }

  return success ? (
    <div className="text-center">
      <div className="mb-6 p-4 rounded-xl bg-brand-green/10 border border-brand-green/25 text-brand-green text-sm font-semibold">
        ✅ Password has been reset successfully! You can now log in with your new password.
      </div>
      <Link href="/login">
        <Button variant="primary" className="w-full max-w-[200px]">
          Go to Login
        </Button>
      </Link>
    </div>
  ) : (
    <>
      <p className="text-sm text-brand-muted text-center mb-6 px-4">
        Create a new password for your account. Must be at least 8 characters with an uppercase letter and a number.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="new-password"
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />

        <Input
          id="confirm-password"
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 mt-2 text-sm font-bold tracking-wide"
          isLoading={isLoading}
        >
          Reset Password
        </Button>
      </form>
    </>
  );
}

/**
 * Reset Password Page — sets a new password using the token from the email link.
 */
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12 relative overflow-hidden select-none">
      <div className="absolute top-[30%] left-[50%] translate-x-[-50%] h-[350px] w-[350px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Card className="w-full max-w-md p-8 relative glass-panel shadow-2xl border-brand-border/80">
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="text-5xl">🔑</span>
          <h2 className="text-2xl font-extrabold tracking-wider text-brand-green font-display">
            RESET PASSWORD
          </h2>
        </div>

        <Suspense fallback={<div className="text-center text-brand-muted">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  );
}
