'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import AuthFormPrelude from '@/components/auth/AuthFormPrelude';
import HydratedForm from '@/components/auth/HydratedForm';
import AuthShell from '@/components/auth/AuthShell';
import { getLoginFieldErrors, type LoginField, type LoginFieldErrors } from '@/validation/auth.schemas';

export default function LoginPage() {
  const { login, user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => setIsReady(true), []);

  useEffect(() => {
    if (!isAuthLoading && user) {
      const destination = !user.emailVerified
        ? '/verify-email'
        : user.role === 'ADMIN'
          ? '/admin/overview'
          : user.role === 'NUTRITIONIST'
            ? '/nutritionist/reviews'
            : !user.onboardingDone
              ? user.onboardingNextPath || '/onboarding/stats'
              : !user.tosAccepted
                ? '/onboarding/tos'
                : !user.reportAcknowledged
                  ? '/nutrition-report'
                  : '/dashboard';
      router.replace(destination);
    }
  }, [user, isAuthLoading, router]);

  if (user) {
    return null;
  }

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
          New to KAINARA?{' '}
          <Link href="/register" className="font-bold text-brand-green transition hover:text-brand-cyan">
            Create an account
          </Link>
        </>
      }
    >
      <AuthFormPrelude googleLabel="signin_with" error={error} compact />

      <HydratedForm onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-4" noValidate>
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
          disabled={!isReady || isLoading}
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
          disabled={!isReady || isLoading}
          autoComplete="current-password"
          maxLength={128}
          error={fieldErrors.password}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[11px] font-semibold text-brand-muted transition hover:text-brand-green sm:text-xs"
          >
            Forgot your password?
          </Link>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-0.5 w-full min-h-11 sm:min-h-12 text-sm"
          isLoading={isLoading}
          disabled={!isReady}
        >
          Sign in
        </Button>
      </HydratedForm>
    </AuthShell>
  );
}
