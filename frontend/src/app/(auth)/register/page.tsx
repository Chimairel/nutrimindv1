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

export default function RegisterPage() {
  const { login } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all registration fields.');
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
      const name = `${firstName.trim()} ${lastName.trim()}`;
      const response = await api.post('/auth/register', { name, email, password });
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input id="firstName" label="First name" type="text" placeholder="Juan" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={isLoading} />
          <Input id="lastName" label="Last name" type="text" placeholder="Dela Cruz" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={isLoading} />
        </div>
        <Input id="email" label="Email address" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} autoComplete="email" />
        <PasswordInput id="password" label="Password" placeholder="8+ characters, uppercase, and number" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isLoading} autoComplete="new-password" helperText="Use at least 8 characters with one uppercase letter and one number." />
        <PasswordInput id="confirmPassword" label="Confirm password" placeholder="Re-enter password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isLoading} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
