'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

/**
 * Unauthorized Page — shown when a user tries to access a route
 * their role doesn't have permission for (e.g., USER trying /admin).
 */
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="text-6xl mb-6">🚫</div>

        {/* Heading */}
        <h1 className="text-3xl font-extrabold text-brand-text font-display mb-3">
          Access Denied
        </h1>

        {/* Description */}
        <p className="text-brand-muted text-sm mb-8 leading-relaxed">
          You don&apos;t have permission to access this page. 
          This area is restricted to a different account role.
          If you believe this is a mistake, please contact support.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 items-center">
          <Link href="/login" className="w-full max-w-[200px]">
            <Button variant="primary" className="w-full">
              Go to Login
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-brand-muted hover:text-brand-green text-sm transition-colors cursor-pointer"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
