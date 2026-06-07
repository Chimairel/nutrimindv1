'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import axios from 'axios';

/**
 * Forgot Password Page — user enters email to receive a password reset link.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12 relative overflow-hidden select-none">
      <div className="absolute top-[30%] left-[50%] translate-x-[-50%] h-[350px] w-[350px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Card className="w-full max-w-md p-8 relative glass-panel shadow-2xl border-brand-border/80">
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="text-5xl">🔐</span>
          <h2 className="text-2xl font-extrabold tracking-wider text-brand-green font-display">
            {success ? 'CHECK YOUR EMAIL' : 'FORGOT PASSWORD'}
          </h2>
        </div>

        {success ? (
          <div className="text-center">
            <div className="mb-6 p-4 rounded-xl bg-brand-green/10 border border-brand-green/25 text-brand-green text-sm font-semibold">
              ✅ If an account with that email exists, we&apos;ve sent a password reset link. Check your inbox (and spam folder).
            </div>
            <Link href="/login" className="text-brand-green hover:underline font-bold text-sm">
              ← Back to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-brand-muted text-center mb-6 px-4">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                id="forgot-email"
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 mt-2 text-sm font-bold tracking-wide"
                isLoading={isLoading}
              >
                Send Reset Link
              </Button>
            </form>

            <div className="mt-8 text-center text-xs text-brand-muted">
              <Link href="/login" className="text-brand-green hover:underline font-bold transition-all">
                ← Back to Login
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
