'use client';

import React from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';

export interface DailyIntakeDonutProps {
  consumed: number;
  target: number;
  provisional?: number;
  className?: string;
  size?: number;
}

export const AnimatedValue: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, prefix, suffix, className = '' }) => {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      transformTiming={{
        easing: 'ease-out',
        duration: 500,
      }}
      className={className}
    />
  );
};

export const DailyIntakeDonut: React.FC<DailyIntakeDonutProps> = ({
  consumed,
  target,
  provisional = 0,
  className = '',
  size = 140,
}) => {
  const safeTarget = Math.max(1, target);
  const percent = Math.round((consumed / safeTarget) * 100);
  const isOverLimit = consumed > safeTarget;

  // Breakdown: Estimated (outside meals) vs Verified (planned meals)
  const estimatedCalories = Math.min(consumed, Math.max(0, provisional));
  const verifiedCalories = Math.max(0, consumed - estimatedCalories);

  // SVG Geometry - radius 52, viewBox 140 x 140
  const R = 52;
  const C = 2 * Math.PI * R; // ~326.72

  // Total denominator (target, or total consumed if target exceeded)
  const denom = Math.max(safeTarget, consumed);
  const pVerified = verifiedCalories / denom;
  const pEstimated = estimatedCalories / denom;
  const pRemaining = Math.max(0, (safeTarget - consumed) / denom);

  const hasVerified = pVerified > 0;
  const hasEstimated = pEstimated > 0;
  const hasRemaining = pRemaining > 0;
  const activeSegments = (hasVerified ? 1 : 0) + (hasEstimated ? 1 : 0) + (hasRemaining ? 1 : 0);

  // Dynamic gap between segments
  const gap = activeSegments > 1 ? 12 : 0;

  const verifiedLength = hasVerified ? Math.max(0.1, pVerified * C - gap) : 0;
  const estimatedLength = hasEstimated ? Math.max(0.1, pEstimated * C - gap) : 0;
  const remainingLength = hasRemaining ? Math.max(0.1, pRemaining * C - gap) : 0;

  // Offsets along perimeter (starting from top, 0 clockwise)
  const verifiedOffset = -(gap / 2);
  const estimatedOffset = -(pVerified * C + gap / 2);
  const remainingOffset = -((pVerified + pEstimated) * C + gap / 2);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Daily calorie intake: ${percent}%, ${Math.round(consumed)} of ${Math.round(safeTarget)} calories${
        estimatedCalories > 0 ? ` (includes ${Math.round(estimatedCalories)} estimated calories)` : ''
      }`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        className="-rotate-90 overflow-visible"
        aria-hidden="true"
      >
        {/* Track backdrop circle */}
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--brand-border)"
          className="opacity-45 dark:opacity-30"
          strokeWidth="12"
        />

        {/* 1. Remaining / Target arc (stroke width 12) */}
        {hasRemaining && (
          <motion.circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke="var(--brand-border)"
            className="dark:stroke-zinc-700"
            strokeWidth="12"
            strokeLinecap={activeSegments > 1 ? 'round' : 'butt'}
            initial={false}
            animate={{
              strokeDasharray: `${remainingLength} ${C}`,
              strokeDashoffset: remainingOffset,
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          />
        )}

        {/* 2. Estimated / Outside Meals arc (Amber #f59e0b, stroke width 18) */}
        {hasEstimated && (
          <motion.circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={isOverLimit && !hasVerified ? '#ef4444' : '#f59e0b'}
            strokeWidth="18"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: `${estimatedLength} ${C}`,
              strokeDashoffset: estimatedOffset,
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          />
        )}

        {/* 3. Verified / Planned Meals arc (Emerald / Lime, stroke width 18) */}
        {hasVerified && (
          <motion.circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={isOverLimit ? '#ef4444' : 'var(--brand-green)'}
            strokeWidth="18"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: `${verifiedLength} ${C}`,
              strokeDashoffset: verifiedOffset,
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          />
        )}
      </svg>

      {/* Center text with NumberFlow rolling percentage */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <AnimatedValue
          value={percent}
          suffix="%"
          className={`font-display font-black tracking-tight leading-none ${
            size >= 140 ? 'text-3xl' : 'text-2xl'
          } ${isOverLimit ? 'text-status-error-text' : 'text-brand-text'}`}
        />
        <div className={`flex items-center ${size >= 140 ? 'gap-1.5 mt-1.5' : 'gap-1 mt-1'}`}>
          {hasEstimated && (
            <span
              className={`${size >= 140 ? 'h-2 w-2' : 'h-1.5 w-1.5'} rounded-full bg-amber-500 shrink-0`}
              title="Includes estimated outside meals"
            />
          )}
          <span
            className={`${
              size >= 140 ? 'text-[10px]' : 'text-[9px]'
            } font-extrabold uppercase tracking-widest text-brand-muted leading-none`}
          >
            {hasEstimated ? 'Intake*' : 'Intake'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DailyIntakeDonut;
