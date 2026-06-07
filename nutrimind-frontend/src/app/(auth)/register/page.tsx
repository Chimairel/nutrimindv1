'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

import axios from 'axios';

export default function RegisterPage() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate request inputs locally first
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all registration fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });

      if (response.data && response.data.success) {
        const { accessToken } = response.data.data;
        // Authenticate the session immediately and push to onboarding stats
        login(accessToken);
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
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12 relative overflow-hidden select-none">
      {/* Background decoration blur */}
      <div className="absolute top-[30%] left-[50%] translate-x-[-50%] h-[350px] w-[350px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Card className="w-full max-w-md p-8 relative glass-panel shadow-2xl border-brand-border/80">
        {/* Branding header */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <span className="text-4xl">🌱</span>
          <h2 className="text-2xl font-extrabold tracking-wider text-brand-green font-display">
            CREATE ACCOUNT
          </h2>
          <p className="text-sm text-brand-muted px-4">
            Join NutriMind today to access personalized, certified Filipino meal plans.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 animate-bounce">
            <span>⚠️</span>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          <Input
            id="name"
            label="Full Name"
            type="text"
            placeholder="Juan Dela Cruz"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />

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
            label="Password (min 6 chars)"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
          />

          <Input
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 mt-3 text-sm font-bold tracking-wide"
            isLoading={isLoading}
          >
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-brand-muted">
          <span>Already registered? </span>
          <Link href="/login" className="text-brand-green hover:underline font-bold transition-all">
            Sign In here
          </Link>
        </div>
      </Card>
    </div>
  );
}
