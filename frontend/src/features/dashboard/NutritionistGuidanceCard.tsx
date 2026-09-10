'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

export function NutritionistGuidanceCard({ isPendingReview = false }: { isPendingReview?: boolean }) {
  return (
    <section
      className="rounded-[24px] border border-brand-border/70 bg-brand-surface/80 p-5 text-left shadow-card"
      aria-label="Meal review and health profile"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-brand-text">
        <ClipboardList className="h-4 w-4 text-brand-green" aria-hidden="true" />
        Meal review & your profile
      </h3>
      {isPendingReview && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-status-pending-bg p-3 text-xs font-semibold text-status-pending-text"
        >
          Some meals are awaiting nutritionist review. Pending meals are previews, not approved meal choices.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-brand-muted">
        Open a meal to see its own review status, available reviewer details, and nutrition sources. FNRI linkage
        describes nutrition provenance; it does not establish clinical verification.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-brand-muted">
        Keep your conditions, allergies, and meal-planning location up to date in Health profile.
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-brand-green">
        <Link href="/health-profile" className="rounded underline underline-offset-4">
          Health profile
        </Link>
        <Link href="/progress" className="rounded underline underline-offset-4">
          View progress
        </Link>
      </div>
    </section>
  );
}
