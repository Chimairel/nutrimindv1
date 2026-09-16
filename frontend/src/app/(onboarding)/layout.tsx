'use client';

import React from 'react';
import RouteGuard from '@/components/shared/RouteGuard';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <ThemeToggle size="md" />
      </div>
      {children}
    </RouteGuard>
  );
}
