'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PasswordInput from '@/components/ui/PasswordInput';
import AuthShell from '@/components/auth/AuthShell';

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) return setError('Invalid reset link. Please request a new password reset.');
    if (!password || !confirmPassword) return setError('Please fill in all fields.');
    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (!/[A-Z]/.test(password)) return setError('Password must contain at least one uppercase letter.');
    if (!/[0-9]/.test(password)) return setError('Password must contain at least one number.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to reset password.' : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-left text-sm font-semibold text-status-error-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Invalid or missing reset token. Please request a new password reset.</span>
        </div>
        <Link href="/forgot-password" className="mt-6 inline-flex text-sm font-bold text-brand-green transition hover:text-brand-cyan">Request a new reset link</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green shadow-cyan"><CheckCircle2 className="h-7 w-7" /></div>
        <p className="mt-5 text-sm leading-6 text-brand-muted">Your password was reset successfully. Your nutrition data and account settings were not changed.</p>
        <Link href="/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d] shadow-neon">Go to sign in</Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PasswordInput id="new-password" label="New password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isLoading} autoComplete="new-password" />
        <PasswordInput id="confirm-password" label="Confirm password" placeholder="••••••••" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isLoading} autoComplete="new-password" />
        <p className="text-[11px] leading-5 text-brand-muted">Use at least 8 characters with one uppercase letter and one number.</p>
        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>Reset password</Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Secure reset"
      title="Choose a new password"
      description="Create new credentials for your NutriMind workspace."
      heroTitle={<>Restore access.<br /><span className="text-brand-accent">Keep your momentum.</span></>}
      heroDescription="Your plan history and health context stay connected while your account credentials are securely refreshed."
      footer={<Link href="/login" className="font-bold text-brand-green transition hover:text-brand-cyan">Return to sign in</Link>}
    >
      <Suspense fallback={<div className="py-8 text-center text-sm text-brand-muted">Preparing secure reset...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
