'use client';

import React from 'react';
import { AlertCircle, Check, HeartPulse, Pin, ShieldCheck } from 'lucide-react';

type NutritionistGuidanceCardProps = {
  healthConditions?: string[];
  allergies?: string[];
  isPendingReview?: boolean;
  verifierName?: string | null;
  prcLicenseNumber?: string | null;
};

export function NutritionistGuidanceCard({
  healthConditions = [],
  allergies = [],
  isPendingReview = false,
  verifierName,
  prcLicenseNumber,
}: NutritionistGuidanceCardProps) {
  // Generate condition-aware tips
  const tips: { title: string; desc: string }[] = [];

  const conditionsText = healthConditions.join(' ').toLowerCase();

  if (/hypertension|blood pressure|cardio/.test(conditionsText)) {
    tips.push({
      title: 'Sodium Vigilance',
      desc: 'Season dishes with calamansi, garlic, ginger, and native herbs instead of heavy patis or MSG.',
    });
  }

  if (/diabet|sugar|glucose/.test(conditionsText)) {
    tips.push({
      title: 'Carbohydrate Distribution',
      desc: 'Pair rice portions with high-fiber greens (kangkong, sitaw) to promote steady glycemic response.',
    });
  }

  if (/kidney|renal|ckd/.test(conditionsText)) {
    tips.push({
      title: 'Protein & Potassium Balance',
      desc: 'Stick closely to the portion grammages listed for meats and soak leafy greens when prepping.',
    });
  }

  if (/cholesterol|hyperlipidemia/.test(conditionsText)) {
    tips.push({
      title: 'Lean Prep Methods',
      desc: 'Favor sinigang, nilaga, and grilling over deep frying or reusing cooking oils.',
    });
  }

  if (allergies.length > 0) {
    tips.push({
      title: 'Allergen Safe Filters Active',
      desc: `Excluded ingredients matching: ${allergies.slice(0, 3).join(', ')}.`,
    });
  }

  // Fallback tip if no specific condition triggered
  if (tips.length === 0) {
    tips.push({
      title: 'Culturally Balanced Fuel',
      desc: 'Each meal leverages FNRI Philippine food composition data for accessible, locally sourced nutrition.',
    });
    tips.push({
      title: 'Consistent Hydration',
      desc: 'Aim for 2,500 mL daily to support cellular hydration and metabolic efficiency.',
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-amber-500/25 bg-amber-500/[0.05] p-5 text-left shadow-card dark:bg-amber-500/[0.08]">
      {/* Sticky Note Decorative Header */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2 text-amber-500">
          <Pin className="h-4 w-4 fill-amber-500/20 stroke-[2.5]" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Nutritionist Guidance Note
          </span>
        </div>
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
          Clinical Guidance
        </span>
      </div>

      {/* Tip List */}
      <div className="mt-4 space-y-3">
        {tips.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-text">{tip.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-brand-muted">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Verification or Oversight Footer */}
      <div className="mt-4 pt-3 border-t border-amber-500/20 text-[10px] leading-snug text-brand-muted flex items-start gap-2">
        {verifierName ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green mt-0.5" />
            <span>
              Audited by <strong className="text-brand-text">{verifierName}</strong>
              {prcLicenseNumber ? ` (PRC ${prcLicenseNumber})` : ''}
            </span>
          </>
        ) : isPendingReview ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
            <span>Your meal plan is pending verification by licensed Registered Nutritionist-Dietitians.</span>
          </>
        ) : (
          <>
            <HeartPulse className="h-3.5 w-3.5 shrink-0 text-brand-green mt-0.5" />
            <span>Clinical-grade meal guidelines formulated using FNRI benchmarks and RND protocols.</span>
          </>
        )}
      </div>
    </div>
  );
}
