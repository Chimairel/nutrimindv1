'use client';

import React from 'react';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';

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
    <AnnouncementBanner
      ariaLabel="Clinical review announcement"
      title="Your plan is in clinical review."
      badge={countBadge}
      message={message}
      className={className}
    />
  );
}
