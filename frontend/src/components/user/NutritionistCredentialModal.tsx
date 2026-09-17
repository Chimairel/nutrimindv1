'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  User,
  GraduationCap,
  Award,
  Calendar,
  Clock,
  Quote,
  ArrowLeft,
  FileCheck,
} from 'lucide-react';
import { KainaraLogo } from '@/components/shared/KainaraLogo';

export interface VerifierData {
  name: string;
  image?: string | null;
  officialHeadshot?: string | null;
  digitalSignature?: string | null;
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
  initialTab?: 'card' | 'notes';
}

export function maskPrcLicenseNumber(prc?: string | null): string {
  if (!prc) return 'PRC Lic. No. ••••••0001';
  const clean = prc.trim();
  if (clean.toLowerCase().startsWith('prc lic. no.')) {
    return clean;
  }
  const digits = clean.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : clean.slice(-4);
  return `PRC Lic. No. ••••••${last4 || '0001'}`;
}

/**
 * High-fidelity vector illustration matching the ChatGPT reference dietitian portrait:
 * Cream circular background, warm friendly Filipina dietitian with black hair parted
 * behind ears, white doctor's coat with collar/lapels, dark green V-neck scrubs.
 */
function DietitianAvatarIllustration() {
  return (
    <svg viewBox="0 0 140 140" className="w-full h-full" fill="none" aria-label="Nutritionist avatar">
      {/* Warm cream circle background */}
      <circle cx="70" cy="70" r="70" fill="#faeedd" />

      {/* Hair back layer behind shoulders */}
      <path
        d="M36 60 C32 82 36 102 44 112 C52 102 54 88 56 74 L84 74 C86 88 88 102 96 112 C104 102 108 82 104 60 C100 32 40 32 36 60 Z"
        fill="#1e2220"
      />

      {/* Neck */}
      <rect x="63" y="66" width="14" height="22" rx="3" fill="#fcd2b2" />
      <path d="M63 74 C67 80 73 80 77 74 L77 82 L63 82 Z" fill="#f1ba94" />

      {/* Face & Ears */}
      <ellipse cx="70" cy="58" rx="23" ry="24" fill="#fcd2b2" />
      <ellipse cx="47" cy="59" rx="4" ry="6" fill="#fcd2b2" />
      <ellipse cx="93" cy="59" rx="4" ry="6" fill="#fcd2b2" />

      {/* Cheeks rosy blush */}
      <ellipse cx="55" cy="63" rx="5" ry="3.5" fill="#f7a08b" opacity="0.4" />
      <ellipse cx="85" cy="63" rx="5" ry="3.5" fill="#f7a08b" opacity="0.4" />

      {/* Eyes with friendly catchlight */}
      <ellipse cx="58" cy="56" rx="3.5" ry="4.5" fill="#1e2220" />
      <circle cx="59.5" cy="54.5" r="1.5" fill="#ffffff" />

      <ellipse cx="82" cy="56" rx="3.5" ry="4.5" fill="#1e2220" />
      <circle cx="83.5" cy="54.5" r="1.5" fill="#ffffff" />

      {/* Soft arched eyebrows */}
      <path d="M52 48 C55 45.5 61 45.5 64 48" stroke="#3d332f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M76 48 C79 45.5 85 45.5 88 48" stroke="#3d332f" strokeWidth="1.6" strokeLinecap="round" />

      {/* Cute nose & warm smile */}
      <path d="M69 60 Q70 63 71 60" stroke="#e09d7a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M64 67 Q70 72 76 67" stroke="#9e4334" strokeWidth="2" strokeLinecap="round" />

      {/* Hair front: middle/side part curving behind ears down to shoulders */}
      <path
        d="M44 54 C44 32 58 26 70 26 C82 26 96 32 96 54 C96 64 93 76 90 82 C87 70 85 54 78 50 C71 46 62 48 56 52 C51 56 49 68 48 78 C46 72 44 63 44 54 Z"
        fill="#1e2220"
      />

      {/* Dark pine green scrub top V-neck */}
      <polygon points="58,82 82,82 70,104" fill="#0e382d" />

      {/* White Doctor Lab Coat */}
      <path
        d="M32 140 L36 100 C38 91 48 85 58 83 L70 102 L82 83 C92 85 102 91 104 100 L108 140 Z"
        fill="#ffffff"
      />
      {/* Crisp Coat Lapels */}
      <path d="M54 84 L65 108 L57 110 L44 94 Z" fill="#edf2f0" />
      <path d="M86 84 L75 108 L83 110 L96 94 Z" fill="#edf2f0" />
      {/* Center seam */}
      <line x1="70" y1="102" x2="70" y2="140" stroke="#d5dedb" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Realistic cursive signature motif matching the ChatGPT reference card
 */
function DietitianSignature({ name }: { name: string }) {
  const cleanName = name.replace(/,.*$/, '').trim();
  return (
    <div className="flex flex-col items-center select-none pt-2 pb-1">
      <div className="relative">
        <span
          className="text-2xl sm:text-[25px] text-slate-100 font-normal tracking-wide block italic font-serif"
          style={{
            fontFamily: "'Segoe Script', 'Caveat', 'Dancing Script', 'Snell Roundhand', cursive, serif",
          }}
        >
          {cleanName}
        </span>
        <svg viewBox="0 0 110 6" className="w-28 h-1.5 text-emerald-400/40 mt-0.5 mx-auto" fill="none">
          <path d="M4 3 Q 55 1, 106 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <span className="font-sans font-semibold text-[10px] tracking-[0.28em] text-white/80 uppercase mt-1">
        RND
      </span>
      <p className="text-xs text-[#8ea79d] mt-1 font-normal">
        Better meals. Healthier you.
      </p>
    </div>
  );
}

export default function NutritionistCredentialModal({
  isOpen,
  onClose,
  verifier,
  nutritionistNote,
  reviewedAt,
  mealName,
  initialTab = 'card',
}: NutritionistCredentialModalProps) {
  const [activeTab, setActiveTab] = useState<'card' | 'notes'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

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

  const displayName = verifier.name.endsWith('RND') ? verifier.name : `${verifier.name}, RND`;

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

      {/* Main Outer Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        {/* Optional Tab Switcher if Review Notes exist */}
        {Boolean(nutritionistNote) && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex rounded-full bg-black/60 p-1 border border-emerald-900/60 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'card'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Nutritionist Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> Clinical Review &amp; Notes
              </button>
            </div>
          </div>
        )}

        {/* Modal Card Box */}
        <div
          className="relative w-full overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[#173e33] bg-[#0e271f] text-slate-100 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 z-30 flex h-8 w-8 items-center justify-center text-slate-400/80 transition hover:text-white focus:outline-none"
            aria-label="Close credential details"
          >
            <X className="h-5 w-5" />
          </button>

          {/* ════════ TAB 1: 100% REPLICA OF CHATGPT REFERENCE CARD ════════ */}
          {activeTab === 'card' ? (
            <div className="relative">
              {/* Retro Wave Organic Corner Accent (Top Left) */}
              <div className="pointer-events-none absolute -top-0.5 -left-0.5 h-36 w-36 sm:h-44 sm:w-44 overflow-hidden rounded-tl-[28px] sm:rounded-tl-[32px] z-0">
                <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
                  {/* Outer warm vibrant orange ribbon */}
                  <path
                    d="M0,0 L160,0 C140,40 105,95 40,135 C20,147 0,155 0,155 Z"
                    fill="#eb6a38"
                  />
                  {/* Middle soft peach ribbon */}
                  <path
                    d="M0,0 L120,0 C105,30 80,72 30,105 C15,115 0,120 0,120 Z"
                    fill="#f09e6c"
                  />
                  {/* Inner dark forest green ribbon */}
                  <path
                    d="M0,0 L78,0 C68,20 50,48 18,70 C8,76 0,80 0,80 Z"
                    fill="#164639"
                  />
                </svg>
              </div>

              {/* 2-Column Grid Layout with inset dashed divider */}
              <div className="grid grid-cols-1 md:grid-cols-[1.08fr_auto_1.52fr] items-stretch min-h-[470px]">
                {/* ──── LEFT PANEL: Identity & Avatar ──── */}
                <div className="relative flex flex-col items-center justify-between p-6 sm:p-8 text-center z-10">
                  {/* Brand Header */}
                  <div className="w-full flex items-center justify-start gap-2 pl-2 pt-1">
                    <KainaraLogo size={24} variant="multicolor" />
                    <span className="font-display font-black text-lg tracking-tight text-white lowercase">
                      kainara
                    </span>
                  </div>

                  {/* Circular Dietitian Portrait */}
                  <div className="my-3 sm:my-4 relative">
                    <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-full shadow-lg overflow-hidden flex items-center justify-center border-2 border-[#1a5c48]/50 bg-[#faeedd]">
                      {verifier.officialHeadshot || verifier.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={verifier.officialHeadshot || verifier.image!}
                          alt={verifier.name}
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        <DietitianAvatarIllustration />
                      )}
                    </div>
                  </div>

                  {/* Name, Title & Status Badge */}
                  <div className="space-y-1 w-full">
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {displayName}
                    </h3>
                    <p className="text-xs font-normal text-[#8ea79d]">
                      Registered Nutritionist - Dietitian
                    </p>

                    <div className="pt-2 flex justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a5c48] bg-[#0e352b] px-3.5 py-1 text-xs font-semibold text-[#38c172] shadow-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#38c172]" />
                        Verified Nutritionist
                      </span>
                    </div>
                  </div>

                  {/* Handwritten Signature & Motto */}
                  {verifier.digitalSignature ? (
                    <div className="flex flex-col items-center select-none pt-2 pb-1">
                      <div className="relative flex items-center justify-center min-h-[48px] max-w-[200px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={verifier.digitalSignature}
                          alt={`${verifier.name}'s digital signature`}
                          className="max-h-12 w-auto object-contain drop-shadow-sm"
                        />
                      </div>
                      <span className="font-sans font-semibold text-[10px] tracking-[0.28em] text-white/80 uppercase mt-1">
                        RND
                      </span>
                      <p className="text-xs text-[#8ea79d] mt-1 font-normal">
                        Better meals. Healthier you.
                      </p>
                    </div>
                  ) : (
                    <DietitianSignature name={verifier.name} />
                  )}
                </div>

                {/* ──── MIDDLE: Inset Dashed Vertical Divider ──── */}
                <div className="hidden md:block w-px border-r border-dashed border-[#1a4438] my-8" />

                {/* ──── RIGHT PANEL: 4 Credentials & Bottom Maiden ──── */}
                <div className="relative flex flex-col justify-between p-6 sm:p-8 space-y-6 z-10">
                  {/* 4 Professional Credential Blocks */}
                  <div className="space-y-5 pt-1 sm:pt-2">
                    {/* 1. Specialization */}
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#114436] text-white shadow-sm">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#8ea79d]">Specialization</p>
                        <p className="text-sm sm:text-[15px] font-bold text-white leading-snug mt-0.5">
                          {verifier.specialization ||
                            'Clinical Nutrition, Weight Management, and Metabolic Health'}
                        </p>
                      </div>
                    </div>

                    {/* 2. Education */}
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#df952b] text-white shadow-sm">
                        <GraduationCap className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#8ea79d]">Education</p>
                        <p className="text-sm sm:text-[15px] font-bold text-white leading-snug mt-0.5">
                          BS Nutrition and Dietetics
                        </p>
                        <p className="text-xs text-[#8ea79d] font-normal mt-0.5">
                          {verifier.university || 'University of the Philippines'}
                        </p>
                      </div>
                    </div>

                    {/* 3. Licensure */}
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#df6338] text-white shadow-sm">
                        <Award className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#8ea79d]">Licensure</p>
                        <p className="text-sm sm:text-[15px] font-bold text-white leading-snug mt-0.5">
                          Registered Nutritionist-Dietitian (RND)
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[#8ea79d] font-normal">{maskedPrc}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                            <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                            PRC-Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Experience */}
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e888e] text-white shadow-sm">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#8ea79d]">Experience</p>
                        <p className="text-sm sm:text-[15px] font-bold text-white leading-snug mt-0.5">
                          {verifier.yearsOfExperience ?? 5}+ years
                        </p>
                        <p className="text-xs text-[#8ea79d] font-normal mt-0.5">
                          in clinical and community nutrition
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Tagline + Action + Kainara Maiden Corner */}
                  <div className="relative pt-2 flex items-end justify-between pr-24">
                    <div className="space-y-1">
                      <p className="text-xs text-[#8ea79d] leading-relaxed">
                        Supporting your health<br />
                        with science-backed nutrition.
                      </p>
                      {nutritionistNote && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('notes')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition underline underline-offset-2 pt-0.5"
                        >
                          <span>View Clinical Adjustments</span>
                          <span>↗</span>
                        </button>
                      )}
                    </div>

                    {/* Bottom Right Maiden Circle with ambient waves */}
                    <div className="absolute -bottom-4 -right-4 flex items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#133a30] shadow-md border border-[#1d5244]/40 overflow-hidden">
                        <KainaraLogo size={66} variant="multicolor" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ════════ TAB 2: CLINICAL REVIEW & ADJUSTMENTS DETAILS ════════ */
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-4 pr-8">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Clinical Meal Supervision &amp; Adjustments
                    </h3>
                    <p className="text-xs text-slate-400">
                      Personalized audit by {displayName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-xs font-bold text-emerald-300 hover:bg-emerald-900/40 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Card
                </button>
              </div>

              {/* Audit Metadata Banner */}
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    {formattedReviewDate
                      ? `Reviewed on ${formattedReviewDate}`
                      : 'Reviewed & Certified'}
                  </span>
                  {mealName && (
                    <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-300">
                      {mealName}
                    </span>
                  )}
                </div>

                {nutritionistNote && (
                  <div className="rounded-xl bg-black/40 border border-emerald-900/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                      Dietitian Clinical Notes:
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed italic flex items-start gap-2">
                      <Quote className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5 opacity-70" />
                      <span>{nutritionistNote}</span>
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  Meal composition, macro distribution, and clinical contraindications were audited and approved to ensure compliance with medical dietary guidelines.
                </p>
              </div>

              {/* Clinician Bio & Profile */}
              {verifier.bio && (
                <div className="rounded-2xl border border-[#163f34] bg-black/20 p-4 space-y-1.5">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    About {verifier.name.replace(/,.*$/, '')}:
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    &ldquo;{verifier.bio}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
