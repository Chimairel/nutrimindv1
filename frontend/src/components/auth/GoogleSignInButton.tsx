'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
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
  intent?: 'login' | 'register';
  disabled?: boolean;
  onCredential?: (credential: string) => Promise<void>;
}

type GoogleCredentialResponse = { credential: string };

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise: Promise<void> | null = null;
let initializedClientId: string | null = null;
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => resolve();
    const handleError = () => {
      googleScriptPromise = null;
      reject(new Error('Google Identity Services failed to load.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  });

  return googleScriptPromise;
}

export default function GoogleSignInButton({
  label = 'signin_with',
  intent = 'login',
  disabled = false,
  onCredential,
}: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const credentialActionRef = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<{ href: string; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    credentialActionRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      return; // Google OAuth not configured — hide button silently
    }

    let cancelled = false;
    activeCredentialHandler = handleGoogleCallback;

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return;

        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: GoogleCredentialResponse) => activeCredentialHandler?.(response),
            auto_select: false,
          });
          initializedClientId = clientId;
        }

        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(Math.max(buttonRef.current.clientWidth, 280), 400),
          text: label,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Google sign-in is temporarily unavailable. Please use email instead.');
      });

    return () => {
      cancelled = true;
      if (activeCredentialHandler === handleGoogleCallback) activeCredentialHandler = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (response: GoogleCredentialResponse) => {
    setError(null);
    setRecoveryLink(null);
    setIsLoading(true);
    try {
      if (credentialActionRef.current) {
        await credentialActionRef.current(response.credential);
        return;
      }
      const res = await api.post(`/auth/google/${intent}`, {
        idToken: response.credential,
      });

      if (res.data && res.data.success) {
        const { accessToken } = res.data.data;
        const currentUser = await login(accessToken);
        if (!currentUser)
          setError('Your account was authenticated, but its profile could not be loaded. Please try again.');
      } else {
        setError(res.data.error || 'Google sign-in failed.');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Google authentication failed. Please try again.'));
      const errorCode = getApiErrorCode(err);
      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        setRecoveryLink({ href: '/register', label: 'Create an account with Google' });
      } else if (errorCode === 'ACCOUNT_EXISTS') {
        setRecoveryLink({ href: '/login', label: 'Sign in instead' });
      }
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
        <div className="w-full rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-error-text" />
            <span>{error}</span>
          </div>
          {recoveryLink ? (
            <Link href={recoveryLink.href} className="mt-2 inline-flex font-bold underline underline-offset-2">
              {recoveryLink.label}
            </Link>
          ) : null}
        </div>
      )}
      <div
        className={`relative min-h-[52px] w-full overflow-hidden rounded-2xl border border-brand-border/60 bg-white p-1.5 shadow-sm ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        aria-disabled={disabled}
      >
        {!isReady && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-[#61706b]">
            Loading Google sign-in…
          </span>
        )}
        <div
          ref={buttonRef}
          className={`flex w-full justify-center transition-opacity ${isReady ? 'opacity-100' : 'opacity-0'} ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        />
      </div>
    </div>
  );
}
