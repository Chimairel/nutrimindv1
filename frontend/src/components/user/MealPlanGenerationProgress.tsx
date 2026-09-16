'use client';

import React from 'react';
import { Check, Clock3 } from 'lucide-react';
import { motion } from 'motion/react';
import KainaraLogo from '@/components/shared/KainaraLogo';
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
        {/* Animated KAINARA Logo with Soft Ambient Pulsing Glow Aura */}
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-brand-green/25 blur-2xl animate-pulse"
            aria-hidden="true"
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/30 bg-gradient-to-b from-brand-green/15 to-brand-green/5 text-brand-green shadow-lg backdrop-blur-sm">
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                filter: [
                  'drop-shadow(0 0 8px rgba(184, 244, 95, 0.35))',
                  'drop-shadow(0 0 18px rgba(184, 244, 95, 0.65))',
                  'drop-shadow(0 0 8px rgba(184, 244, 95, 0.35))',
                ],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="flex items-center justify-center"
            >
              <KainaraLogo className="h-10 w-10" ariaLabel="KAINARA logo" />
            </motion.div>
            {isComplete && (
              <div
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-brand-black shadow-md ring-2 ring-brand-surface"
                title="Complete"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
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
          KAINARA is assembling a safe, practical plan around your nutrition profile.
        </p>

        {/* Centered Progress Slider Section (Watermelon Adaptive Slider style without dots) */}
        <div className="mt-8 w-full max-w-md">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-brand-muted">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{getRemainingTimeLabel(normalizedProgress, elapsedSeconds)}</span>
            </div>
            <span className="font-mono text-base font-black tabular-nums text-brand-green">
              <AnimatedNumber value={normalizedProgress} format={(v) => `${Math.round(v)}%`} />
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={normalizedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Estimated meal plan generation progress: ${normalizedProgress}%`}
            className="group relative flex h-12 w-full items-center overflow-hidden rounded-full border border-brand-border/70 bg-[#f1f3f5] shadow-inner transition-colors dark:border-white/10 dark:bg-neutral-900/90"
          >
            {/* Dynamic Multi-stop Gradient Fill */}
            <motion.div
              className="pointer-events-none absolute top-0 left-0 h-full rounded-full"
              style={{
                background: 'linear-gradient(to right, #10b981, #b8f45f, #7759e8)',
              }}
              animate={{
                width:
                  normalizedProgress === 0
                    ? '0%'
                    : `calc(${normalizedProgress}% + ${(1 - normalizedProgress / 100) * 48}px)`,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            />

            {/* Sliding Thumb Indicator (Without white dots) */}
            <motion.div
              className="pointer-events-none absolute top-0 z-40 flex h-12 w-12 items-center justify-center rounded-full"
              animate={{
                left: `calc(${normalizedProgress}% - ${(normalizedProgress / 100) * 48}px)`,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.22)] ring-2 ring-black/5 dark:bg-brand-dark dark:ring-white/20"
                style={{
                  boxShadow: '0 3px 14px rgba(119, 89, 232, 0.55)',
                }}
              >
                {isComplete ? (
                  <Check className="h-4 w-4 text-brand-green" strokeWidth={3} aria-hidden="true" />
                ) : (
                  <span className="font-mono text-[11px] font-black tabular-nums text-brand-black dark:text-white">
                    {normalizedProgress}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
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
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-brand-muted">{phase.detail}</p>
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-brand-muted/70">
          Progress is reported by the server. The bar reaches 100% only after the plan is safely stored.
        </p>
      </div>
    </section>
  );
}
