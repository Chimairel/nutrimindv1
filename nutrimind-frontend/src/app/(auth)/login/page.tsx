'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

import axios from 'axios';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all credentials fields.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data && response.data.success) {
        const { accessToken } = response.data.data;
        // Invoke AuthContext login to save token and route by role
        login(accessToken);
      } else {
        setError(response.data.error || 'Failed to authenticate.');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error || 
          'Unable to connect to the backend server. Please verify your connection.'
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
      {/* Decorative backdrop glowing blob */}
      <div className="absolute top-[30%] left-[50%] translate-x-[-50%] h-[350px] w-[350px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      <Card className="w-full max-w-md p-8 relative glass-panel shadow-2xl border-brand-border/80">
        {/* Branding header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <span className="text-4xl">🧠</span>
          <h2 className="text-2xl font-extrabold tracking-wider text-brand-green font-display">
            WELCOME TO NUTRIMIND
          </h2>
          <p className="text-sm text-brand-muted px-4">
            AI-powered meal planning validated against official Philippine food standards.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 animate-bounce">
            <span>⚠️</span>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 mt-2 text-sm font-bold tracking-wide"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-brand-muted hover:text-brand-green text-xs transition-all">
            Forgot your password?
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-brand-muted">
          <span>New to NutriMind? </span>
          <Link href="/register" className="text-brand-green hover:underline font-bold transition-all">
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  );
}
