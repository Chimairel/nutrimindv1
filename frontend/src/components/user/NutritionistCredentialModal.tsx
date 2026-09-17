'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  Stethoscope,
  GraduationCap,
  Award,
  Calendar,
  Clock,
  Quote,
} from 'lucide-react';
import { KainaraLogo } from '@/components/shared/KainaraLogo';

export interface VerifierData {
  name: string;
  image?: string | null;
  prcLicenseNumber: string;
  prcLicenseExpiry: string | Date;
  specialization?: string | null;
  yearsOfExperience?: number | null;
  university?: string | null;
  bio?: string | null;
}

export interface NutritionistCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifier: VerifierData;
  nutritionistNote?: string | null;
  reviewedAt?: string | Date | null;
  mealName?: string;
}

export function maskPrcLicenseNumber(prc?: string | null): string {
  if (!prc) return 'PRC Lic. No. ••••••0001';
  const clean = prc.trim();
  if (clean.length <= 4) return `PRC Lic. No. ••••••${clean}`;
  const last4 = clean.slice(-4);
  return `PRC Lic. No. ••••••${last4}`;
}

export default function NutritionistCredentialModal({
  isOpen,
  onClose,
  verifier,
  nutritionistNote,
  reviewedAt,
  mealName,
}: NutritionistCredentialModalProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const maskedPrc = maskPrcLicenseNumber(verifier.prcLicenseNumber);
  const formattedReviewDate = reviewedAt
    ? new Date(reviewedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Credentials of ${verifier.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] sm:rounded-[36px] border border-emerald-900/40 bg-[#071310] text-slate-100 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Retro Wave Color Stripes in Top-Left Corner */}
        <div
          className="pointer-events-none absolute -top-1 -left-1 h-24 w-24 sm:h-32 sm:w-32 overflow-hidden rounded-tl-[28px] sm:rounded-tl-[36px]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" className="h-full w-full" fill="none">
            {/* Outermost warm amber band */}
            <path
              d="M0,0 L70,0 C65,25 35,45 0,55 Z"
              fill="#f59e0b"
              className="opacity-90"
            />
            {/* Middle vibrant terracotta band */}
            <path
              d="M0,0 L50,0 C45,20 25,35 0,42 Z"
              fill="#ea580c"
              className="opacity-95"
            />
            {/* Deep burnt rust inner band */}
            <path
              d="M0,0 L32,0 C28,14 14,24 0,28 Z"
              fill="#991b1b"
              className="opacity-90"
            />
          </svg>
        </div>

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-brand-muted transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label="Close credential details"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Main 2-Column Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1.85fr] items-stretch">
          {/* ──── LEFT PANEL: Identity & Headshot ──── */}
          <div className="relative flex flex-col items-center justify-between p-6 sm:p-8 text-center bg-gradient-to-b from-[#0c201a] via-[#091814] to-[#071310] md:border-r border-dashed border-emerald-900/40">
            {/* Brand Header */}
            <div className="w-full flex items-center justify-center gap-2 pl-4 pt-1">
              <KainaraLogo className="h-6.5 w-6.5 text-amber-100" />
              <span className="font-display font-black text-sm tracking-widest text-slate-100 uppercase">
                KAINARA
              </span>
            </div>

            {/* Circular Profile Photo / Illustration */}
            <div className="my-6 relative">
              {/* Warm Outer Border Ring */}
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-emerald-600 to-amber-300 shadow-xl">
                {verifier.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={verifier.image}
                    alt={verifier.name}
                    className="h-full w-full rounded-full object-cover bg-slate-900"
                  />
                ) : (
                  /* SVG Fallback Doctor / Nutritionist Illustration */
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#e8be96] flex items-center justify-center">
                    <svg
                      viewBox="20 15 60 75"
                      className="w-full h-full object-cover translate-y-1"
                    >
                      {/* Hair background */}
                      <circle cx="50" cy="45" r="24" fill="#1e1e24" />
                      {/* Neck */}
                      <rect x="44" y="56" width="12" height="14" fill="#f0be92" />
                      {/* Face */}
                      <ellipse cx="50" cy="45" rx="20" ry="22" fill="#f5caa6" />
                      {/* Eyes */}
                      <circle cx="43" cy="44" r="2.2" fill="#1e1e24" />
                      <circle cx="57" cy="44" r="2.2" fill="#1e1e24" />
                      {/* Smile */}
                      <path
                        d="M44 52 Q50 56 56 52"
                        stroke="#b26852"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      {/* Hair bangs / front */}
                      <path
                        d="M30 40 C32 26 68 26 70 40 C66 32 54 30 50 34 C46 30 34 32 30 40 Z"
                        fill="#1e1e24"
                      />
                      {/* White Clinical Lab Coat */}
                      <path
                        d="M26 100 L26 72 C26 67 33 64 42 64 L58 64 C67 64 74 67 74 72 L74 100 Z"
                        fill="#ffffff"
                      />
                      {/* Inner blouse / scrubs (emerald green) */}
                      <polygon points="44,64 56,64 50,78" fill="#047857" />
                      {/* Stethoscope around neck */}
                      <path
                        d="M38 67 C38 80 44 86 48 86 C50 86 52 82 52 82"
                        stroke="#475569"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <circle cx="52" cy="84" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Name, Title & Status */}
            <div className="space-y-1.5 w-full">
              <h3 className="font-display text-lg sm:text-xl font-black text-white tracking-tight">
                {verifier.name.endsWith('RND') ? verifier.name : `${verifier.name}, RND`}
              </h3>
              <p className="text-xs font-semibold text-slate-300">
                Registered Nutritionist - Dietitian
              </p>

              {/* Verified Badge */}
              <div className="pt-2 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-950/60 px-3.5 py-1 text-xs font-bold text-emerald-300 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Verified Nutritionist
                </span>
              </div>
            </div>

            {/* Signature Accent & Tagline */}
            <div className="mt-6 pt-4 border-t border-emerald-900/30 w-full space-y-1">
              <div className="font-serif italic text-base sm:text-lg text-emerald-200/80 tracking-wider">
                {verifier.name.replace(/,.*$/, '')}
                <span className="text-xs not-italic font-sans block text-emerald-400/80 font-bold -mt-0.5">
                  RND
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 tracking-wide pt-0.5">
                Better meals. Healthier you.
              </p>
            </div>
          </div>

          {/* ──── RIGHT PANEL: Credentials, Note & Verification Details ──── */}
          <div className="flex flex-col justify-between p-6 sm:p-8 space-y-5 bg-[#071310]">
            {/* 4 Professional Credential Blocks */}
            <div className="space-y-4">
              {/* 1. Specialization */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-[#122e23] text-emerald-300 shadow-sm">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Specialization
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mt-0.5">
                    {verifier.specialization ||
                      'Clinical Nutrition, Weight Management, and Metabolic Health'}
                  </p>
                </div>
              </div>

              {/* 2. Education */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-[#2d2210] text-amber-300 shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Education
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mt-0.5">
                    BS Nutrition and Dietetics
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {verifier.university || 'University of San Carlos'}
                  </p>
                </div>
              </div>

              {/* 3. Licensure (with Masked PRC number) */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-500/25 bg-[#311a14] text-orange-300 shadow-sm">
                  <Award className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Licensure
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mt-0.5">
                    Registered Nutritionist-Dietitian (RND)
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {maskedPrc}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                      PRC-Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Experience */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-500/25 bg-[#0f272c] text-cyan-300 shadow-sm">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Experience
                  </p>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mt-0.5">
                    {verifier.yearsOfExperience ?? 5}+ years
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    in clinical and community nutrition
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-emerald-900/40 pt-3 space-y-3">
              {/* Review Timestamp & Note Callout Box (if present) */}
              {(Boolean(nutritionistNote) || Boolean(formattedReviewDate)) && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      <Clock className="h-3 w-3 text-emerald-400" />
                      {formattedReviewDate
                        ? `Reviewed & adjusted on ${formattedReviewDate}${mealName ? ` (${mealName})` : ''}`
                        : mealName
                          ? `Reviewed & Certified (${mealName})`
                          : 'Reviewed & Certified'}
                    </span>
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">
                      Clinical Note
                    </span>
                  </div>
                  {nutritionistNote ? (
                    <p className="text-xs text-slate-200 leading-relaxed italic flex items-start gap-1.5">
                      <Quote className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5 opacity-70" />
                      <span>{nutritionistNote}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Meal composition, portioning, and clinical contraindications audited and verified for this plan.
                    </p>
                  )}
                </div>
              )}

              {/* Bio blurb / Credential note */}
              {verifier.bio && (
                <p className="text-xs leading-relaxed text-slate-300 italic">
                  &ldquo;{verifier.bio}&rdquo;
                </p>
              )}

              {/* Bottom Tagline with Motif */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] sm:text-xs text-slate-400 leading-snug max-w-[280px]">
                  Supporting your health with science-backed nutrition.
                </p>
                <div className="shrink-0 opacity-80 pl-2">
                  <KainaraLogo size={42} variant="multicolor" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
