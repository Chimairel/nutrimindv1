'use client';

import React from 'react';
import RouteGuard from '@/components/shared/RouteGuard';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      {children}
    </RouteGuard>
  );
}
