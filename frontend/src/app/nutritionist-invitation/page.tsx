'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import Button from '@/components/ui/Button';
import PasswordInput from '@/components/ui/PasswordInput';
import api from '@/lib/axios';
import { passwordSchema } from '@/validation/auth.schemas';

function InvitationForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) return setError('This invitation link is invalid or incomplete.');
    const validatedPassword = passwordSchema.safeParse(password);
    if (!validatedPassword.success) return setError(validatedPassword.error.issues[0]?.message || 'Choose a valid password.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setIsLoading(true);
    try {
      await api.post('/nutritionist-applications/activate', { token, password });
      setSuccess(true);
    } catch (caught) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Account activation failed.' : 'Account activation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) return (
    <div className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green"><CheckCircle2 className="h-7 w-7" /></span>
      <h3 className="mt-5 font-display text-xl font-black">Your professional workspace is active</h3>
      <p className="mt-3 text-sm leading-6 text-brand-muted">Sign in with your application email and the password you just created.</p>
      <Link href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-[#07100d]">Continue to sign in</Link>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div role="alert" className="flex gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <PasswordInput id="nutritionist-password" label="Create password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" maxLength={128} disabled={isLoading} helperText="Use at least 8 characters with one uppercase letter and one number." />
      <PasswordInput id="nutritionist-confirm-password" label="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" maxLength={128} disabled={isLoading} error={mismatch ? 'Passwords do not match.' : undefined} />
      <Button type="submit" size="lg" isLoading={isLoading} className="w-full">Activate nutritionist account</Button>
    </form>
  );
}

export default function NutritionistInvitationPage() {
  return (
    <AuthShell
      eyebrow="Approved professional"
      title="Activate your workspace"
      description="Create your private password to finish the invitation issued after credential and call verification."
      heroTitle={<>Professional review.<br /><span className="text-brand-accent">Human judgment.</span></>}
      heroDescription="Your NutriMind nutritionist workspace connects verified professional decisions to a transparent meal-review history."
      footer={<Link href="/nutritionist-apply" className="font-bold text-brand-green">Track your application</Link>}
    >
      <Suspense fallback={<p className="py-8 text-center text-sm text-brand-muted">Checking invitation...</p>}><InvitationForm /></Suspense>
    </AuthShell>
  );
}
