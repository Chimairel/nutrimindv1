'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { AlertTriangle } from 'lucide-react';

/**
 * Google Identity Services "Sign in with Google" button.
 * Loads the GIS script, renders the button, and handles the callback.
 */


declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  label?: string;
}

export default function GoogleSignInButton({ label = 'signin_with' }: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      return; // Google OAuth not configured — hide button silently
    }

    // Load the Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
          auto_select: false,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(Math.max(buttonRef.current.clientWidth, 280), 400),
          text: label,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (response: { credential: string }) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.post('/auth/google', {
        idToken: response.credential,
      });

      if (res.data && res.data.success) {
        const { accessToken } = res.data.data;
        await login(accessToken);
      } else {
        setError(res.data.error || 'Google sign-in failed.');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Google authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    return null; // Don't render if Google OAuth not configured
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {error && (
        <div className="w-full p-3 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error-text" />
          <span>{error}</span>
        </div>
      )}
      <div className="w-full overflow-hidden rounded-2xl border border-brand-border/60 bg-white p-1.5 shadow-sm">
        <div
          ref={buttonRef}
          className={`flex w-full justify-center transition-opacity ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        />
      </div>
    </div>
  );
}
