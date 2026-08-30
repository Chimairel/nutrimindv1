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
import {
  getRegistrationFieldErrors,
  type RegistrationField,
  type RegistrationFieldErrors,
} from '@/validation/auth.schemas';

export default function RegisterPage() {
  const { login } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const clearFieldError = (field: RegistrationField) => {
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
    const validation = getRegistrationFieldErrors({ firstName, lastName, email, password, confirmPassword });
    setFieldErrors(validation.errors);
    if (!validation.data) {
      setError('Please correct the highlighted fields before creating your account.');
      return;
    }

    setIsLoading(true);
    try {
      const name = `${validation.data.firstName} ${validation.data.lastName}`;
      const response = await api.post('/auth/register', {
        name,
        email: validation.data.email,
        password: validation.data.password,
      });
      if (response.data?.success) {
        if (response.data.data.verificationEmailSent === false) {
          sessionStorage.setItem('nutrimind_verification_delivery_pending', 'true');
        }
        await login(response.data.data.accessToken);
      } else {
        setError(response.data.error || 'Failed to complete registration.');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'An error occurred during account creation. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create your profile"
      title="Start with what makes you, you"
      description="Your health context becomes the foundation for every recommendation that follows."
      heroTitle={<>Nutrition built for<br /><span className="text-brand-accent">real Filipino life.</span></>}
      heroDescription="Create a profile that connects familiar food, personal goals, clinical context, and a visible nutritionist-review process."
      wide
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-brand-green transition hover:text-brand-cyan">Sign in</Link>
        </>
      }
    >
      <GoogleSignInButton label="signup_with" />

      <div className="my-5 flex items-center gap-4">
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input id="firstName" name="firstName" label="First name" type="text" placeholder="Juan" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearFieldError('firstName'); }} disabled={isLoading} autoComplete="given-name" maxLength={80} error={fieldErrors.firstName} />
          <Input id="lastName" name="lastName" label="Last name" type="text" placeholder="Dela Cruz" value={lastName} onChange={(event) => { setLastName(event.target.value); clearFieldError('lastName'); }} disabled={isLoading} autoComplete="family-name" maxLength={80} error={fieldErrors.lastName} />
        </div>
        <Input id="email" name="email" label="Email address" type="email" placeholder="name@example.com" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }} disabled={isLoading} autoComplete="email" maxLength={254} error={fieldErrors.email} />
        <PasswordInput id="password" name="password" label="Password" placeholder="8+ characters, uppercase, and number" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }} disabled={isLoading} autoComplete="new-password" maxLength={128} error={fieldErrors.password} helperText="Use at least 8 characters with one uppercase letter and one number. Spaces are allowed in passphrases." />
        <PasswordInput id="confirmPassword" name="confirmPassword" label="Confirm password" placeholder="Re-enter password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearFieldError('confirmPassword'); }} disabled={isLoading} autoComplete="new-password" maxLength={128} error={fieldErrors.confirmPassword || (passwordsMismatch ? 'Passwords do not match.' : undefined)} />
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
