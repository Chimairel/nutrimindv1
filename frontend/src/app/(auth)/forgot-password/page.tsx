'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, MailCheck } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthShell from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Something went wrong. Please try again.' : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={success ? 'Check your inbox' : 'Reset your access'}
      description={success ? 'If the account exists, a secure reset link is on its way.' : 'Enter the email connected to your NutriMind account.'}
      heroTitle={<>A secure route<br /><span className="text-brand-accent">back to your plan.</span></>}
      heroDescription="Account recovery is kept separate from your health profile and does not change your saved nutrition data."
      footer={<Link href="/login" className="font-bold text-brand-green transition hover:text-brand-cyan">Return to sign in</Link>}
    >
      {success ? (
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green shadow-cyan">
            <MailCheck className="h-7 w-7" />
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/[0.07] p-4 text-left text-sm text-brand-text">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
            <span className="leading-6">If an account with that email exists, we&apos;ve sent a password reset link. Check your inbox and spam folder.</span>
          </div>
          <Link href="/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d] shadow-neon">Back to sign in</Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input id="forgot-email" label="Email address" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} autoComplete="email" />
            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>Send reset link</Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
