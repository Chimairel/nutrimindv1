'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import AuthShell from '@/components/auth/AuthShell';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all credentials fields.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.success) {
        await login(response.data.data.accessToken);
      } else {
        setError(response.data.error || 'Failed to authenticate.');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Unable to connect to the backend server. Please verify your connection.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Enter your workspace"
      description="Continue to your personalized plan, review queue, or platform control center."
      heroTitle={<>Your nutrition.<br /><span className="text-brand-accent">One connected view.</span></>}
      heroDescription="Return to a workspace where weekly meals, daily progress, and transparent review states move together."
      footer={
        <>
          New to NutriMind?{' '}
          <Link href="/register" className="font-bold text-brand-green transition hover:text-brand-cyan">Create an account</Link>
        </>
      }
    >
      <GoogleSignInButton label="signin_with" />

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-brand-border/70" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-muted">or use email</span>
        <div className="h-px flex-1 bg-brand-border/70" />
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
          autoComplete="email"
        />
        <PasswordInput
          id="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-semibold text-brand-muted transition hover:text-brand-green">Forgot your password?</Link>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full" isLoading={isLoading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
