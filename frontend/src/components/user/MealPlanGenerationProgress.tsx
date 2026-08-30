'use client';

import React from 'react';
import { CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import Progress from '@/components/ui/Progress';

interface MealPlanGenerationProgressProps {
  progress: number;
  elapsedSeconds: number;
  stageMessage?: string | null;
}

const GENERATION_PHASES = [
  {
    until: 14,
    title: 'Preparing your nutrition profile',
    detail: 'Organizing your goals, preferences, and health considerations.',
  },
  {
    until: 32,
    title: 'Reviewing trusted meal options',
    detail: 'Screening available recipes against your dietary requirements.',
  },
  {
    until: 50,
    title: 'Balancing your weekly nutrition targets',
    detail: 'Distributing calories and macros across each day and meal slot.',
  },
  {
    until: 70,
    title: 'Designing practical meal combinations',
    detail: 'Creating suitable options for the meal slots that still need a match.',
  },
  {
    until: 86,
    title: 'Validating ingredients and estimates',
    detail: 'Cross-checking nutrition values and your recorded restrictions.',
  },
  {
    until: 100,
    title: 'Preparing your plan for review',
    detail: 'Completing the schedule and organizing the final meal plan.',
  },
  {
    until: 101,
    title: 'Your meal plan is ready',
    detail: 'Opening your newly prepared weekly plan now.',
  },
];

const getRemainingTimeLabel = (progress: number, elapsedSeconds: number) => {
  if (progress >= 100) return 'Complete';

  const remainingSeconds = Math.max(0, 90 - elapsedSeconds);
  if (remainingSeconds === 0) return 'Finishing shortly';

  const roundedSeconds = Math.max(5, Math.ceil(remainingSeconds / 5) * 5);
  if (roundedSeconds >= 60) {
    const minutes = Math.floor(roundedSeconds / 60);
    const seconds = roundedSeconds % 60;
    return `About ${minutes} min${seconds ? ` ${seconds} sec` : ''} remaining`;
  }

  return `About ${roundedSeconds} sec remaining`;
};

export default function MealPlanGenerationProgress({
  progress,
  elapsedSeconds,
  stageMessage,
}: MealPlanGenerationProgressProps) {
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const phase = GENERATION_PHASES.find((item) => normalizedProgress < item.until)
    ?? GENERATION_PHASES[GENERATION_PHASES.length - 1];
  const isComplete = normalizedProgress >= 100;

  return (
    <section
      className="flex min-h-[65vh] items-center justify-center px-4 py-10 text-brand-text"
      aria-live="polite"
      aria-busy={!isComplete}
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-brand-border bg-brand-surface p-6 shadow-card-lg md:p-8">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-brand-green via-brand-cyan to-brand-accent" aria-hidden="true" />

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-green-light text-brand-green">
            {isComplete ? (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Sparkles className="h-6 w-6 animate-pulse" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-green">
              Personalized plan generation
            </p>
            <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-brand-text">
              Building your weekly meal plan
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">
              NutriMind is assembling a safe, practical plan around your nutrition profile.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted">
                Estimated progress
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-brand-muted">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{getRemainingTimeLabel(normalizedProgress, elapsedSeconds)}</span>
              </div>
            </div>
            <span className="font-mono text-2xl font-black tabular-nums text-brand-green">
              {normalizedProgress}%
            </span>
          </div>

          <Progress
            value={normalizedProgress}
            max={100}
            className="h-3 border-brand-border bg-brand-bgAlt"
            aria-label={`Estimated meal plan generation progress: ${normalizedProgress}%`}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-bgAlt p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1.5 flex shrink-0 items-center gap-1" aria-hidden="true">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <div>
              <p className="font-display text-sm font-extrabold text-brand-text">
                {stageMessage || phase.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                {phase.detail}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-brand-muted">
          Progress is reported by the server. The bar reaches 100% only after the plan is safely stored.
        </p>
      </div>
    </section>
  );
}
