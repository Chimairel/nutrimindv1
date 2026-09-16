'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface OnboardingProgressSliderProps {
  currentStep: number;
  totalSteps?: number;
  className?: string;
}

export const OnboardingProgressSlider: React.FC<OnboardingProgressSliderProps> = ({
  currentStep,
  totalSteps = 6,
  className = '',
}) => {
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const percentage = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className={`w-full flex flex-col gap-2 select-none ${className}`}>
      {/* Top Labels */}
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
        <span className="font-mono text-[11px] text-brand-muted">
          Step {clampedStep} of {totalSteps}
        </span>
        <span className="font-mono text-[11px] text-brand-green">
          {percentage}% Completed
        </span>
      </div>

      {/* Adaptive Slider Track without white dots */}
      <div
        role="progressbar"
        aria-valuenow={clampedStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Onboarding progress: Step ${clampedStep} of ${totalSteps}`}
        className="relative flex h-10 sm:h-11 w-full items-center overflow-hidden rounded-full border border-brand-border/70 bg-[#f1f3f5] shadow-inner transition-colors dark:border-white/10 dark:bg-neutral-900/90"
      >
        {/* Dynamic Multi-stop Gradient Fill */}
        <motion.div
          className="pointer-events-none absolute top-0 left-0 h-full rounded-full"
          style={{
            background: 'linear-gradient(to right, #10b981, #b8f45f, #7759e8)',
          }}
          animate={{
            width: `calc(${percentage}% + ${(1 - percentage / 100) * 44}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />

        {/* Sliding Thumb Indicator */}
        <motion.div
          className="pointer-events-none absolute top-0 z-40 flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-full"
          animate={{
            left: `calc(${percentage}% - ${(percentage / 100) * 44}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.22)] ring-2 ring-black/5 dark:bg-brand-dark dark:ring-white/20"
            style={{
              boxShadow: '0 3px 14px rgba(119, 89, 232, 0.55)',
            }}
          >
            <span className="font-mono text-xs font-black text-brand-black dark:text-white">
              {clampedStep}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingProgressSlider;
