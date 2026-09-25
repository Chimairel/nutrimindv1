'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { MealType, MealPlanStatus, AIConfidenceFlag, PublicVerifier, MealExplanation, PublicMealImage } from '@/types';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';
import { getManilaDateKey } from '@/lib/manila-date';
import NutritionistCredentialModal, { maskPrcLicenseNumber } from './NutritionistCredentialModal';
import {
  Check,
  X,
  AlertCircle,
  Coffee,
  Sun,
  Moon,
  Apple,
  RefreshCw,
  ShieldCheck,
  ListChecks,
  Clock3,
  CalendarDays,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface Ingredient {
  id: string;
  ingredientName: string;
  category?: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}

interface MealCardProps {
  id: string;
  mealName: string;
  mealType: MealType;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  aiConfidenceFlag: AIConfidenceFlag;
  ingredients?: Ingredient[];
  mealLogs?: MealLog[];
  onStatusToggle?: (mealId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void>;
  onSwapClick?: (mealId: string) => void;
  scheduledDate?: string;
  cycleScope?: 'CURRENT' | 'UPCOMING';
  onCardClick?: () => void;
  verifier?: PublicVerifier | null;
  explanation?: MealExplanation;
  image?: PublicMealImage | null;
  nutritionistNote?: string | null;
  reviewedAt?: string | Date | null;
}

export default function MealCard({
  id,
  mealName,
  mealType,
  description,
  calories,
  proteinG,
  carbsG,
  fatG,
  status,
  ingredients = [],
  mealLogs = [],
  onStatusToggle,
  onSwapClick,
  scheduledDate,
  cycleScope,
  onCardClick,
  verifier,
  explanation,
  image,
  nutritionistNote,
  reviewedAt,
}: MealCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [verifierModalTab, setVerifierModalTab] = useState<'card' | 'notes'>('card');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const layoutId = `meal-card-${id || mealName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Keyboard escape listener and body scroll lock when expanded
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const scheduledDateKey = scheduledDate ? getManilaDateKey(scheduledDate) : getManilaDateKey();
  const todayKey = getManilaDateKey();
  const isPastDate = scheduledDateKey < todayKey;
  const isFutureDate = scheduledDateKey > todayKey || cycleScope === 'UPCOMING';

  // Check if past grace period (> 7 days)
  const isPastGracePeriod = React.useMemo(() => {
    if (!scheduledDate) return false;
    const diffDays = Math.floor(
      (new Date(`${getManilaDateKey()}T00:00:00+08:00`).getTime() -
        new Date(`${getManilaDateKey(scheduledDate)}T00:00:00+08:00`).getTime()) /
        86_400_000
    );
    return diffDays > 7;
  }, [scheduledDate]);

  // Check if meal is logged as DONE or SKIPPED
  const isCompleted = mealLogs.some((l) => l.status === 'DONE');
  const isSkipped = mealLogs.some((l) => l.status === 'SKIPPED');
  const isUnloggedPastMeal = isPastDate && !isCompleted && !isSkipped;
  const isLogged = isCompleted || isSkipped;

  const handleCheckedChange = async (checked: boolean) => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, checked ? 'DONE' : 'PENDING');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Status toggle error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkipMeal = async () => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, 'SKIPPED');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Skip meal error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const mealTypeLabels: Record<MealType, { label: string; icon: React.ComponentType<LucideProps> }> = {
    BREAKFAST: { label: 'Breakfast', icon: Coffee },
    LUNCH: { label: 'Lunch', icon: Sun },
    DINNER: { label: 'Dinner', icon: Moon },
    SNACK: { label: 'Snack', icon: Apple },
  };

  const activeLabel = mealTypeLabels[mealType];
  const Icon = activeLabel.icon;

  return (
    <>
      {/* Simplified Meal Card inside Grid with Expandable Motion */}
      <motion.div
        layoutId={layoutId}
        role="button"
        tabIndex={0}
        aria-label={`Open ${mealName} details`}
        onClick={() => {
          if (onCardClick) {
            onCardClick();
          } else {
            setIsOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (onCardClick) {
              onCardClick();
            } else {
              setIsOpen(true);
            }
          }
        }}
        className="group block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
      >
        <Card
          interactive
          className={`
            border border-brand-border/70 bg-brand-surface h-full transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green/30 hover:shadow-card-hover
            ${isCompleted ? 'border-brand-green/40 shadow-lg shadow-brand-green/5 opacity-80' : ''}
            ${isSkipped ? 'border-red-500/20 opacity-60' : ''}
          `}
          contentClassName="flex h-full flex-col justify-between p-4 sm:p-5"
        >
          {/* Card Top: Image with Verification Badge in upper right corner */}
          <div className="relative mb-3.5 h-36 w-full">
            <motion.div layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
              <MealImage
                image={image}
                mealName={mealName}
                mealType={mealType}
                className="h-full w-full"
                variant="compact"
                ingredients={ingredients}
              />
            </motion.div>
            <MealVerificationBadge
              status={status}
              hasVerifier={Boolean(verifier)}
              className="absolute top-2.5 right-2.5 z-10"
            />
          </div>

          {/* Card Top Row */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-green" />
              <span className="text-[10px] font-extrabold tracking-wider text-brand-muted uppercase">
                {activeLabel.label}
              </span>
            </div>

            {/* Status Indicator Badges */}
            <div className="flex items-center gap-1.5">
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/40 bg-brand-accent/15 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-brand-accent dark:shadow-[0_0_8px_rgba(84,199,190,0.2)]">
                  <Check className="h-2.5 w-2.5 stroke-[3]" /> Eaten
                </span>
              )}
              {isSkipped && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300">
                  <X className="h-2.5 w-2.5 stroke-[2.5]" /> Skipped
                </span>
              )}
              {isUnloggedPastMeal && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  <Clock3 className="h-2.5 w-2.5" /> Unlogged
                </span>
              )}
              {status === 'PENDING_REVIEW' && !isLogged && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[9px] font-medium text-brand-muted">
                  <Clock3 className="h-2.5 w-2.5 text-amber-400/80" /> Preview
                </span>
              )}
            </div>
          </div>

          {/* Card Content */}
          <div className="flex-1 flex flex-col justify-between">
            <h3
              className={`
                text-sm font-extrabold font-display tracking-tight leading-snug mb-1
                ${isCompleted ? 'line-through text-brand-muted' : 'text-brand-text'}
                ${isSkipped ? 'text-brand-muted' : ''}
              `}
            >
              {mealName}
            </h3>

            <div className="mt-3 flex items-center justify-between border-t border-brand-border/40 pt-2.5">
              <span className="text-[11px] font-bold text-brand-muted">
                {Math.round(calories)} kcal · {Math.round(proteinG)}g P · {Math.round(carbsG)}g C · {Math.round(fatG)}g
                F
              </span>
              <span className="text-[11px] font-extrabold text-brand-green group-hover:translate-x-0.5 transition-transform">
                View &rarr;
              </span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Detailed Info Dialog Popup Modal -> Expandable Card Animation Pattern */}
      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Expanded Modal Card */}
                <motion.div
                  layoutId={layoutId}
                  className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-2xl max-h-[92vh] flex flex-col text-left select-none"
                >
                  {/* Floating Close Button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur-md hover:bg-black/90 transition-colors shadow-lg"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Hero Image Container */}
                  <div className="relative h-48 sm:h-64 w-full shrink-0 overflow-hidden">
                    <motion.div layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
                      <MealImage
                        image={image}
                        mealName={mealName}
                        mealType={mealType}
                        className="h-full w-full rounded-none"
                        variant="hero"
                        ingredients={ingredients}
                      />
                    </motion.div>
                    <MealVerificationBadge
                      status={status}
                      hasVerifier={Boolean(verifier)}
                      className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
                    />
                  </div>

                  {/* Modal Body */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4 sm:gap-5"
                  >
                    {/* Header / Meta Row */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Icon className="h-4 w-4 text-brand-green" />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-brand-muted">
                          {activeLabel.label}
                        </span>
                        {scheduledDate && (
                          <>
                            <span className="text-xs text-brand-muted">·</span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
                              <CalendarDays className="h-3 w-3" />
                              {scheduledDate}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black font-display text-brand-text tracking-tight leading-tight">
                        {mealName}
                      </h3>
                      <span className="text-xs font-bold text-brand-muted mt-1 block">
                        {Math.round(calories)} kcal Total Energy
                      </span>
                      {image?.attribution.sourcePageUrl && (
                        <a
                          href={image.attribution.sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-brand-green underline"
                        >
                          View image source
                        </a>
                      )}
                    </div>

                    {/* Macro Badges Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-protein-bg)',
                          borderColor: 'var(--macro-protein-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-protein)' }}
                        >
                          {Math.round(proteinG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-protein)' }}
                        >
                          Protein
                        </span>
                      </div>

                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-carbs-bg)',
                          borderColor: 'var(--macro-carbs-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-carbs)' }}
                        >
                          {Math.round(carbsG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-carbs)' }}
                        >
                          Carbs
                        </span>
                      </div>

                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-fat-bg)',
                          borderColor: 'var(--macro-fat-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-fat)' }}
                        >
                          {Math.round(fatG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-fat)' }}
                        >
                          Fat
                        </span>
                      </div>
                    </div>

                    {/* Description Text */}
                    <p className="text-xs text-brand-muted leading-relaxed">
                      {description ||
                        'This meal is part of your AI generation plan. Check ingredients and follow the instructions to prepare it.'}
                    </p>

                    {explanation && (
                      <section
                        className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-4"
                        aria-label="Why this meal"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-brand-text">
                            <ListChecks className="h-4 w-4 text-brand-green" />
                            Why this meal?
                          </div>
                          {verifier && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-extrabold text-brand-green border border-brand-green/20">
                              <ShieldCheck className="h-3 w-3" /> RND Supervised
                            </span>
                          )}
                        </div>
                        <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-brand-muted">
                          {explanation.bullets.map((bullet) => {
                            const isReviewerBullet = verifier && bullet.toLowerCase().includes('reviewed by');
                            return (
                              <li key={bullet} className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
                                  <span className="break-words">{bullet}</span>
                                </div>
                                {isReviewerBullet && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVerifierModalTab('notes');
                                      setIsOpen(false);
                                      setIsVerifierOpen(true);
                                    }}
                                    className="shrink-0 text-[10px] font-bold text-brand-green hover:underline flex items-center gap-0.5 ml-2 cursor-pointer"
                                  >
                                    View Review &amp; Notes ↗
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        {explanation.limitation && (
                          <p className="mt-3 border-t border-brand-border/60 pt-3 text-[10px] text-brand-muted">
                            {explanation.limitation}
                          </p>
                        )}
                      </section>
                    )}

                    {verifier && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifierModalTab('card');
                          setIsOpen(false);
                          setIsVerifierOpen(true);
                        }}
                        className="group relative flex w-full flex-col gap-2.5 rounded-2xl border border-brand-green/30 bg-gradient-to-br from-brand-green/[0.08] via-brand-green/[0.03] to-transparent p-3.5 text-left transition hover:border-brand-green/60 hover:shadow-sm"
                        aria-label={`View clinical credentials for ${verifier.name}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {verifier.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={verifier.image}
                                alt={verifier.name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-brand-green/30 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-brand-green/15 border-2 border-brand-green/30 flex items-center justify-center text-brand-green font-display font-bold text-xs shrink-0">
                                {verifier.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-display font-extrabold text-xs text-brand-text truncate">
                                  {verifier.name.endsWith('RND') ? verifier.name : `${verifier.name}, RND`}
                                </span>
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-green/15 px-1.5 py-0.5 text-[9px] font-extrabold text-brand-green">
                                  <ShieldCheck className="h-3 w-3" /> PRC-Verified
                                </span>
                              </div>
                              <p className="text-[10px] text-brand-muted truncate">
                                {verifier.specialization || 'Clinical Dietetics & Nutrition'} •{' '}
                                {maskPrcLicenseNumber(verifier.prcLicenseNumber)}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-brand-green group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Credentials ↗
                          </span>
                        </div>

                        {nutritionistNote && (
                          <div className="rounded-xl bg-brand-bgAlt/80 border border-brand-border/60 px-2.5 py-1.5 text-[10px] text-brand-muted italic line-clamp-2">
                            <span className="font-bold not-italic text-brand-text mr-1">RND Note:</span>
                            &ldquo;{nutritionistNote}&rdquo;
                          </div>
                        )}
                      </button>
                    )}

                    {/* YouTube Cooking Tutorial Helper */}
                    <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl shrink-0">📺</span>
                        <div>
                          <h5 className="text-xs font-bold text-brand-text leading-tight">Need cooking help?</h5>
                          <p className="text-[10px] text-brand-muted mt-1 leading-snug">
                            Watch Filipino cooking tutorials for this dish on YouTube.
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(mealName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0 select-none cursor-pointer outline-none"
                      >
                        Watch Video
                      </a>
                    </div>

                    {/* Ingredients list */}
                    {ingredients.length > 0 && (
                      <div>
                        <span className="text-[9px] tracking-wider font-extrabold text-brand-muted uppercase block mb-2">
                          Ingredients List
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ingredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="text-[10px] bg-brand-bgAlt border border-brand-border/60 text-brand-text px-2.5 py-1.5 rounded-lg leading-none font-semibold"
                            >
                              {ing.ingredientName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical Warning Banner (Legal layer 3 & 4) */}
                    {status === 'PENDING_REVIEW' && (
                      <div className="p-3 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-semibold leading-relaxed flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed
                          Registered Nutritionist-Dietitian. Use with caution.
                        </span>
                      </div>
                    )}

                    {/* Action Buttons Panel */}
                    <div className="border-t border-brand-border/60 pt-4 mt-1">
                      {isUnloggedPastMeal && !isPastGracePeriod && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0" />
                          <span>
                            Missed this meal? You can still catch up and record whether you ate or skipped it.
                          </span>
                        </div>
                      )}
                      {isPastGracePeriod && (
                        <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>The 7-day logging grace period for this scheduled meal has passed.</span>
                        </div>
                      )}
                      {isFutureDate && (
                        <p className="mb-3 text-xs text-brand-muted">
                          This meal can be viewed or swapped now. Record it on its scheduled date.
                        </p>
                      )}
                      {!isLogged ? (
                        <div className="flex flex-col gap-3">
                          {/* Primary: Mark as Eaten */}
                          <Button
                            variant="primary"
                            onClick={() => handleCheckedChange(true)}
                            disabled={isUpdating || isPastGracePeriod || isFutureDate}
                            className="w-full font-bold py-2.5 text-xs"
                          >
                            Mark as Eaten
                          </Button>

                          {/* Secondary: Swap and Skip side-by-side */}
                          <div className="flex gap-3">
                            {onSwapClick && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setIsOpen(false);
                                  onSwapClick(id);
                                }}
                                disabled={isPastDate}
                                className="flex-1 font-bold text-xs py-2 h-9 border-brand-border flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isPastDate ? 'Past scheduled meals cannot be swapped.' : undefined}
                              >
                                <RefreshCw className="h-3 w-3 animate-spin-hover" /> Swap Meal
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={handleSkipMeal}
                              disabled={isUpdating || isPastGracePeriod || isFutureDate}
                              className="flex-1 font-bold text-xs py-2 h-9 bg-red-500/10 border border-red-500/25 text-red-500 hover:bg-red-600 hover:text-white"
                            >
                              Skip Meal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* If logged, show Reset Status button */
                        <Button
                          variant="secondary"
                          onClick={() => handleCheckedChange(false)}
                          disabled={isUpdating || isPastGracePeriod || isFutureDate}
                          className="w-full font-bold py-2.5 text-xs border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50"
                        >
                          Reset Meal Status
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {verifier && (
        <NutritionistCredentialModal
          isOpen={isVerifierOpen}
          onClose={() => setIsVerifierOpen(false)}
          verifier={verifier}
          nutritionistNote={nutritionistNote}
          reviewedAt={reviewedAt}
          mealName={mealName}
          initialTab={verifierModalTab}
        />
      )}
    </>
  );
}
