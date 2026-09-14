'use client';

import React from 'react';

interface ClinicalReviewBannerProps {
  className?: string;
  message?: string;
  pendingCount?: number;
}

export default function ClinicalReviewBanner({
  className = '',
  message = 'Recommendations are in preview while a nutritionist verifies them.',
  pendingCount,
}: ClinicalReviewBannerProps) {
  const countBadge =
    typeof pendingCount === 'number' && pendingCount > 0 ? (
      <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-extrabold text-white">
        {pendingCount} {pendingCount === 1 ? 'meal' : 'meals'} awaiting review
      </span>
    ) : null;

  return (
    <aside
      aria-label="Clinical review announcement"
      className={`w-full rounded-2xl bg-[#8c3b00] px-4 py-2.5 text-center text-xs font-medium text-white shadow-sm sm:text-sm flex flex-wrap items-center justify-center gap-1.5 ${className}`}
    >
      <span className="font-bold">Your plan is in clinical review.</span>
      {countBadge}
      <span className="text-white/90">{message}</span>
    </aside>
  );
}
