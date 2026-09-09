'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import MealImage from '@/components/user/MealImage';
import {
  ArrowLeft,
  Coffee,
  Sun,
  Moon,
  Apple,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  Camera,
  ExternalLink,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import { MealType, MealPlanStatus, PublicVerifier, MealExplanation, PublicMealImage } from '@/types';

interface Ingredient {
  id: string;
  ingredientName: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}

interface MealDetail {
  id: string;
  mealName: string;
  mealType: MealType;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  scheduledDate: string;
  ingredients: Ingredient[];
  mealLogs: MealLog[];
  verifier?: PublicVerifier | null;
  explanation?: MealExplanation;
  image?: PublicMealImage | null;
}

export default function MealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const mealId = params.mealId as string;

  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMealDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/user/meals/${mealId}`);
      if (res.data && res.data.success) {
        setMeal(res.data.data);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to retrieve meal details.'));
    } finally {
      setIsLoading(false);
    }
  }, [mealId]);

  useEffect(() => {
    if (mealId) {
      fetchMealDetails();
    }
  }, [mealId, fetchMealDetails]);

  const handleUpdateStatus = async (newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    if (isUpdating || !meal) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.patch(`/user/meals/${meal.id}/status`, { status: newStatus });
      // Reload details to sync local states
      const res = await api.get(`/user/meals/${meal.id}`);
      if (res.data && res.data.success) {
        setMeal(res.data.data);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update status.'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <PortalLoadingState message="Loading meal details..." />;
  }

  if (error || !meal) {
    return (
      <div className="portal-page max-w-3xl text-left text-brand-text">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-brand-text mb-6 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Dashboard</span>
        </button>
        <Card className="p-6 border-brand-border bg-brand-surface/30">
          <div className="flex items-center gap-2 text-status-error-text mb-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-base font-bold">Error Loading Meal Details</h3>
          </div>
          <p className="text-sm text-brand-muted">{error || 'Meal record not found.'}</p>
        </Card>
      </div>
    );
  }

  // Evaluate past date condition
  const isPastDate = (() => {
    if (!meal.scheduledDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(meal.scheduledDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  })();

  // Check if meal is logged as DONE or SKIPPED
  const isCompleted = meal.mealLogs.some((l) => l.status === 'DONE');
  const isSkipped =
    meal.mealLogs.some((l) => l.status === 'SKIPPED') ||
    (!meal.mealLogs.some(
      (l) => l.status === 'DONE' || l.status === 'SKIPPED' || (l.status === 'PENDING' && l.source !== 'SAFETY_REPLACED')
    ) &&
      isPastDate);
  const isLogged = isCompleted || isSkipped;

  const mealTypeLabels: Record<MealType, { label: string; icon: React.ComponentType<LucideProps> }> = {
    BREAKFAST: { label: 'Breakfast', icon: Coffee },
    LUNCH: { label: 'Lunch', icon: Sun },
    DINNER: { label: 'Dinner', icon: Moon },
    SNACK: { label: 'Snack', icon: Apple },
  };

  const activeLabel = mealTypeLabels[meal.mealType];
  const Icon = activeLabel.icon;

  return (
    <div className="portal-page max-w-3xl select-none text-left text-brand-text animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Back to Dashboard Button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-bold text-brand-muted hover:text-brand-text mb-6 group transition-colors outline-none"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to Dashboard</span>
      </button>

      {/* Main Meal Details Card */}
      <Card className="relative overflow-hidden border-brand-border/70 bg-brand-surface/75 p-6 shadow-card-lg md:p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />

        <MealImage
          image={meal.image}
          mealName={meal.mealName}
          mealType={meal.mealType}
          ingredients={meal.ingredients}
          className="mb-6 h-64 w-full"
          priority
          variant="detail"
          showAttributionLinks
        />

        {/* Header Block */}
        <div className="mb-6 flex items-start gap-3.5 rounded-[24px] bg-[#07100d] p-5 text-white shadow-card">
          <div className="mt-0.5 shrink-0 rounded-2xl bg-brand-accent p-3 text-[#07100d] shadow-neon">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-accent">
              {activeLabel.label} Details
            </span>
            <h1 className="mt-0.5 font-display text-xl font-black leading-tight tracking-tight text-white md:text-2xl">
              {meal.mealName}
            </h1>
            <span className="mt-1 block text-xs font-bold text-white/40">
              {Math.round(meal.calories)} kcal Total Energy
            </span>
          </div>
        </div>

        {/* Macro Budges Section */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="border rounded-2xl p-3 text-center"
            style={{
              backgroundColor: 'var(--macro-protein-bg)',
              borderColor: 'var(--macro-protein-border)',
            }}
          >
            <span
              className="block text-lg font-black font-display leading-none"
              style={{ color: 'var(--macro-protein)' }}
            >
              {Math.round(meal.proteinG)}g
            </span>
            <span
              className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider"
              style={{ color: 'var(--macro-protein)' }}
            >
              Protein
            </span>
          </div>

          <div
            className="border rounded-2xl p-3 text-center"
            style={{
              backgroundColor: 'var(--macro-carbs-bg)',
              borderColor: 'var(--macro-carbs-border)',
            }}
          >
            <span
              className="block text-lg font-black font-display leading-none"
              style={{ color: 'var(--macro-carbs)' }}
            >
              {Math.round(meal.carbsG)}g
            </span>
            <span
              className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider"
              style={{ color: 'var(--macro-carbs)' }}
            >
              Carbs
            </span>
          </div>

          <div
            className="border rounded-2xl p-3 text-center"
            style={{
              backgroundColor: 'var(--macro-fat-bg)',
              borderColor: 'var(--macro-fat-border)',
            }}
          >
            <span className="block text-lg font-black font-display leading-none" style={{ color: 'var(--macro-fat)' }}>
              {Math.round(meal.fatG)}g
            </span>
            <span
              className="block text-[9px] uppercase font-extrabold mt-1 tracking-wider"
              style={{ color: 'var(--macro-fat)' }}
            >
              Fat
            </span>
          </div>
        </div>

        {/* Details and Ingredients */}
        <div className="flex flex-col gap-6 mb-6">
          <div>
            <h3 className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase mb-2">Description</h3>
            <p className="text-xs text-brand-text/95 leading-relaxed font-semibold">
              {meal.description ||
                'This meal is part of your AI generation plan. Check ingredients and follow the instructions to prepare it.'}
            </p>
          </div>

          {meal.explanation && (
            <section
              className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-4"
              aria-label="Why this meal"
            >
              <h3 className="text-xs font-extrabold text-brand-text">Why this meal?</h3>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-brand-muted">
                {meal.explanation.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {meal.explanation.limitation && (
                <p className="mt-3 border-t border-brand-border/60 pt-3 text-[10px] text-brand-muted">
                  {meal.explanation.limitation}
                </p>
              )}
            </section>
          )}

          {meal.verifier && (
            <button
              type="button"
              onClick={() => setIsVerifierOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-3 text-left transition hover:border-brand-green/40"
              aria-label={`View verifier details for ${meal.verifier.name}`}
            >
              <span className="flex items-center gap-2 text-xs font-bold text-brand-text">
                <ShieldCheck className="h-4 w-4 text-brand-green" />
                Verified by{' '}
                <span className="underline decoration-brand-green/40 underline-offset-2">{meal.verifier.name}</span>
              </span>
              <span className="rounded bg-brand-green/15 px-2 py-1 font-mono text-[9px] font-extrabold text-brand-green">
                PRC {meal.verifier.prcLicenseNumber}
              </span>
            </button>
          )}

          {/* YouTube Cooking Tutorial Banner */}
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
              href={`https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(meal.mealName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0"
            >
              Watch Video
            </a>
          </div>

          {meal.ingredients.length > 0 && (
            <div>
              <h3 className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase mb-2">
                Ingredients List
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {meal.ingredients.map((ing) => (
                  <span
                    key={ing.id}
                    className="text-[10px] bg-brand-bgAlt border border-brand-border text-brand-text px-2.5 py-1.5 rounded-lg leading-none font-bold"
                  >
                    {ing.ingredientName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {meal.image && (
            <section
              className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-4"
              aria-label="Image Governance and Attribution"
            >
              <div className="flex items-center gap-2 text-brand-green">
                <Camera className="h-4 w-4 shrink-0" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-text">
                  Image Governance &amp; Attribution
                </h3>
              </div>
              <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-brand-muted">
                {meal.image.kind === 'REPRESENTATIVE' && (
                  <p className="flex items-start gap-1.5 font-medium text-amber-400/90">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    <span>
                      <strong>Representative photograph</strong> · Pictured preparation, garnish, or secondary
                      ingredients may differ from the NutriMind recipe.
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                  {meal.image.attribution.creator && (
                    <span className="font-semibold text-brand-text">Photo by {meal.image.attribution.creator}</span>
                  )}
                  {meal.image.attribution.sourcePageUrl && (
                    <a
                      href={meal.image.attribution.sourcePageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-brand-green underline underline-offset-2 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 focus-visible:ring-offset-black rounded-sm"
                      aria-label="View original image source page in new tab"
                    >
                      <span>Source page</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                  {meal.image.attribution.licenseUrl && (
                    <a
                      href={meal.image.attribution.licenseUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-brand-green underline underline-offset-2 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 focus-visible:ring-offset-black rounded-sm"
                      aria-label="View license details in new tab"
                    >
                      <span>{meal.image.attribution.licenseCode || 'License'}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                {meal.image.attribution.modifications && (
                  <p className="text-[10px] text-brand-muted/80">{meal.image.attribution.modifications}</p>
                )}
                <p className="border-t border-brand-border/60 pt-2 text-[10px] italic text-brand-muted/70">
                  Nutritional and clinical accuracy is determined solely by FNRI-linked recipe data, not by photograph
                  contents.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* AI Estimation Warning */}
        {meal.status === 'PENDING_REVIEW' && (
          <div className="p-4 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-bold leading-relaxed flex items-start gap-2.5 mb-6">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>
              <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed Registered
              Nutritionist-Dietitian. Use with caution.
            </span>
          </div>
        )}

        {/* Actions Button panel */}
        <div className="border-t border-brand-border/60 pt-6 mt-4">
          {!isLogged ? (
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={() => handleUpdateStatus('DONE')}
                disabled={isUpdating}
                className="w-full font-bold py-3 text-xs tracking-wider uppercase shadow-lg shadow-brand-green/10"
              >
                Mark as Eaten
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleUpdateStatus('SKIPPED')}
                disabled={isUpdating}
                className="w-full font-bold text-xs py-3 bg-red-500/10 border border-red-500/25 text-red-500 hover:bg-red-600 hover:text-white uppercase tracking-wider transition-colors"
              >
                Skip Meal
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                {isCompleted && (
                  <Badge
                    variant="verified"
                    showIcon={false}
                    className="text-[10px] font-extrabold py-1 px-3 bg-brand-green/10 text-brand-green border-brand-green/20 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Check className="h-3 w-3" /> Marked as Eaten
                  </Badge>
                )}
                {isSkipped && (
                  <Badge
                    variant="rejected"
                    showIcon={false}
                    className="text-[10px] font-extrabold py-1 px-3 bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1 uppercase tracking-wider"
                  >
                    <X className="h-3 w-3" /> Marked as Skipped
                  </Badge>
                )}
              </div>

              <Button
                variant="secondary"
                onClick={() => handleUpdateStatus('PENDING')}
                disabled={isUpdating}
                className="w-full font-bold py-3 text-xs border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 uppercase tracking-wider"
              >
                Reset Meal Status
              </Button>
            </div>
          )}
        </div>
      </Card>

      {meal.verifier && (
        <Modal
          isOpen={isVerifierOpen}
          onClose={() => setIsVerifierOpen(false)}
          title={meal.verifier.name}
          description="Nutritionist who reviewed and certified this reusable meal."
          size="md"
        >
          <div className="space-y-4 text-left">
            <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4">
              <div className="flex items-center gap-2 text-brand-green">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-display text-sm font-extrabold">Verified nutritionist-dietitian</span>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-brand-muted">PRC license</dt>
                  <dd className="mt-1 font-mono font-bold text-brand-text">{meal.verifier.prcLicenseNumber}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Valid until</dt>
                  <dd className="mt-1 font-bold text-brand-text">
                    {new Date(meal.verifier.prcLicenseExpiry).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Specialization</dt>
                  <dd className="mt-1 font-bold text-brand-text">
                    {meal.verifier.specialization || 'General nutrition'}
                  </dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Experience</dt>
                  <dd className="mt-1 font-bold text-brand-text">{meal.verifier.yearsOfExperience ?? 0} years</dd>
                </div>
              </dl>
            </div>
            {meal.verifier.university && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">Education</p>
                <p className="mt-1 font-semibold text-brand-text">{meal.verifier.university}</p>
              </div>
            )}
            {meal.verifier.bio && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
                  Professional profile
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-muted">{meal.verifier.bio}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
