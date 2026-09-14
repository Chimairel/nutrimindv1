'use client';

import React from 'react';

interface ClinicalReviewBannerProps {
  className?: string;
  message?: string;
}

export default function ClinicalReviewBanner({
  className = '',
  message = 'Recommendations are in preview while a nutritionist verifies them.',
}: ClinicalReviewBannerProps) {
  return (
    <aside
      aria-label="Clinical review announcement"
      className={`w-full rounded-2xl bg-[#8c3b00] px-4 py-2.5 text-center text-xs font-medium text-white shadow-sm sm:text-sm ${className}`}
    >
      <span className="font-bold">Your plan is in clinical review.</span>{' '}
      <span className="text-white/90">{message}</span>
    </aside>
  );
}
