'use client';

import React from 'react';
import { CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import Progress from '@/components/ui/Progress';
import TextShimmer from '@/components/ui/motion/TextShimmer';
import AnimatedNumber from '@/components/ui/motion/AnimatedNumber';

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
  const phase =
    GENERATION_PHASES.find((item) => normalizedProgress < item.until) ??
    GENERATION_PHASES[GENERATION_PHASES.length - 1];
  const isComplete = normalizedProgress >= 100;

  return (
    <section
      className="flex min-h-[65vh] flex-col items-center justify-center px-4 py-12 text-brand-text"
      aria-live="polite"
      aria-busy={!isComplete}
    >
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center text-center">
        {/* Animated Icon with Soft Ambient Aura */}
        <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-brand-green/20 blur-xl animate-pulse" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-green/30 bg-brand-green/10 text-brand-green shadow-sm">
            {isComplete ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <Sparkles className="h-7 w-7 animate-pulse text-brand-green" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Eyebrow, Title & Subtitle */}
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
          Personalized plan generation
        </p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-brand-text sm:text-3xl">
          {isComplete ? 'Your meal plan is ready!' : 'Building your weekly meal plan'}
        </h1>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-brand-muted sm:text-sm">
          NutriMind is assembling a safe, practical plan around your nutrition profile.
        </p>

        {/* Centered Progress Bar Section (Free from outer box) */}
        <div className="mt-8 w-full max-w-md">
          <div className="mb-2.5 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-brand-muted">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{getRemainingTimeLabel(normalizedProgress, elapsedSeconds)}</span>
            </div>
            <span className="font-mono text-base font-black tabular-nums text-brand-green">
              <AnimatedNumber value={normalizedProgress} format={(v) => `${Math.round(v)}%`} />
            </span>
          </div>

          <Progress
            value={normalizedProgress}
            max={100}
            className="h-2.5 w-full border-brand-border/60 bg-brand-surface/80 sm:h-3"
            aria-label={`Estimated meal plan generation progress: ${normalizedProgress}%`}
          />
        </div>

        {/* Current Stage Status (Frameless & Centered) */}
        <div className="mt-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-2">
            {!isComplete && (
              <span className="flex items-center gap-1" aria-hidden="true">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-green"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            )}
            <p className="font-display text-sm font-bold text-brand-text">
              {!isComplete ? <TextShimmer>{stageMessage || phase.title}</TextShimmer> : stageMessage || phase.title}
            </p>
          </div>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-brand-muted">
            {phase.detail}
          </p>
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-brand-muted/70">
          Progress is reported by the server. The bar reaches 100% only after the plan is safely stored.
        </p>
      </div>
    </section>
  );
}
