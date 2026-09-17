'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { MealPlanStatus } from '@/types';

export interface MealVerificationBadgeProps {
  status?: MealPlanStatus | string;
  hasVerifier?: boolean;
  className?: string;
}

export default function MealVerificationBadge({
  status,
  hasVerifier = false,
  className = '',
}: MealVerificationBadgeProps) {
  const isVerified = status === 'APPROVED' || hasVerifier;
  const isRejected = status === 'REJECTED';

  if (isVerified) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-black/75 px-2.5 py-1 font-mono text-[9px] font-bold text-emerald-300 shadow-md backdrop-blur-md select-none ${className}`}
        aria-label="Clinically verified meal"
      >
        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0 stroke-[2.5]" />
        <span>Verified</span>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-black/75 px-2.5 py-1 font-mono text-[9px] font-bold text-rose-300 shadow-md backdrop-blur-md select-none ${className}`}
        aria-label="Meal flagged or rejected"
      >
        <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0 stroke-[2.5]" />
        <span>Rejected</span>
      </div>
    );
  }

  // Default: Awaiting Review / Not yet verified
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-black/75 px-2.5 py-1 font-mono text-[9px] font-bold text-amber-300 shadow-md backdrop-blur-md select-none ${className}`}
      aria-label="Awaiting clinical review"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      <span>Awaiting Review</span>
    </div>
  );
}
