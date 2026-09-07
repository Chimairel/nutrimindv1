'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import AuthFormPrelude from '@/components/auth/AuthFormPrelude';
import AuthShell from '@/components/auth/AuthShell';
import { getLoginFieldErrors, type LoginField, type LoginFieldErrors } from '@/validation/auth.schemas';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validation = getLoginFieldErrors({ email, password });
    setFieldErrors(validation.errors);
    if (!validation.data) {
      setError('Please correct the highlighted fields before signing in.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', validation.data);
      if (response.data?.success) {
        await login(response.data.data.accessToken);
      } else {
        setError(response.data.error || 'Failed to authenticate.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to connect to the backend server. Please verify your connection.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Enter your workspace"
      description="Continue to your personalized plan, review queue, or platform control center."
      heroTitle={
        <>
          Your nutrition.
          <br />
          <span className="text-brand-accent">One connected view.</span>
        </>
      }
      heroDescription="Return to a workspace where weekly meals, daily progress, and transparent review states move together."
      footer={
        <>
          New to NutriMind?{' '}
          <Link href="/register" className="font-bold text-brand-green transition hover:text-brand-cyan">
            Create an account
          </Link>
        </>
      }
    >
      <AuthFormPrelude googleLabel="signin_with" error={error} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError('email');
          }}
          disabled={isLoading}
          autoComplete="email"
          maxLength={254}
          error={fieldErrors.email}
        />
        <PasswordInput
          id="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError('password');
          }}
          disabled={isLoading}
          autoComplete="current-password"
          maxLength={128}
          error={fieldErrors.password}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand-muted transition hover:text-brand-green"
          >
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full" isLoading={isLoading}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
