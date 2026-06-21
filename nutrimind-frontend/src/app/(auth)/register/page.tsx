'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import axios from 'axios';

export default function RegisterPage() {
  const { login } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all registration fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
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

      if (response.data && response.data.success) {
        const { accessToken, refreshToken } = response.data.data;
        login(accessToken, refreshToken);
      } else {
        setError(response.data.error || 'Failed to complete registration.');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ||
          'An error occurred during account creation. Please try again.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-bg select-none">
      {/* ──── LEFT HERO PANEL ──── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a12] via-[#0d2818] to-[#0a1a12]" />

        {/* Decorative glows */}
        <div className="absolute top-[20%] left-[30%] h-[300px] w-[300px] rounded-full bg-brand-green/8 blur-[100px]" />
        <div className="absolute bottom-[15%] right-[20%] h-[200px] w-[200px] rounded-full bg-brand-green/5 blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 px-12 xl:px-16 max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <span className="text-4xl">🧠</span>
            <span className="text-2xl font-extrabold tracking-widest text-brand-green font-display">NUTRIMIND</span>
          </div>

          {/* Tagline */}
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.15] tracking-tight text-white font-display mb-6">
            AI-Powered<br />
            <span className="text-brand-green">Nutrition</span> Tailored<br />
            for Filipinos.
          </h1>

          <p className="text-brand-muted text-sm leading-relaxed mb-10 max-w-md">
            Personalized meal plans built by advanced AI and validated against the
            <strong className="text-brand-text"> FNRI Philippine Food Composition Table</strong>.
            Empowered by licensed nutritionist reviews.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2.5">
            {['FNRI Validated', 'Gemini AI 2.5', 'RND Reviewed', '7-Day Plans'].map((tag) => (
              <span
                key={tag}
                className="px-4 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-[11px] font-bold tracking-wider uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ──── RIGHT FORM PANEL ──── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-8">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <span className="text-3xl">🧠</span>
            <span className="text-xl font-extrabold tracking-widest text-brand-green font-display">NUTRIMIND</span>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-brand-text font-display">
              Create your account
            </h2>
            <p className="text-sm text-brand-muted mt-1.5">
              Start your personalized Filipino nutrition journey.
            </p>
          </div>

          {/* Google Sign-In */}
          <GoogleSignInButton label="signup_with" />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-muted font-semibold uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* First / Last name row */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="firstName"
                label="First Name"
                type="text"
                placeholder="Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
              />
              <Input
                id="lastName"
                label="Last Name"
                type="text"
                placeholder="Dela Cruz"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Input
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
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
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-brand-muted">
            <span>Already have an account? </span>
            <Link href="/login" className="text-brand-green hover:underline font-bold transition-all">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
