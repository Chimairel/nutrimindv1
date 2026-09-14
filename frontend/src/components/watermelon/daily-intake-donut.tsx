'use client';

import React from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';

export interface DailyIntakeDonutProps {
  consumed: number;
  target: number;
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
  className = '',
  size = 140,
}) => {
  const safeTarget = Math.max(1, target);
  const percent = Math.round((consumed / safeTarget) * 100);
  const isOverLimit = consumed > safeTarget;

  // SVG Geometry - radius 52, viewBox 140 x 140
  const R = 52;
  const C = 2 * Math.PI * R; // ~326.72

  // Proportion calculations (0 to 1)
  const pConsumed = Math.min(1, Math.max(0, consumed / safeTarget));
  const pRemaining = Math.max(0, 1 - pConsumed);

  // Dynamic gap between consumed and remaining arc segments
  const gap = 14;
  const showGap = pConsumed > 0 && pRemaining > 0;
  const actualGap = showGap ? gap : 0;

  const consumedLength = Math.max(0, pConsumed * C - actualGap);
  const remainingLength = Math.max(0, pRemaining * C - actualGap);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Daily calorie intake: ${percent}%, ${Math.round(consumed)} of ${Math.round(safeTarget)} calories`}
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

        {/* Remaining / Target arc (stroke width 12) */}
        <motion.circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--brand-border)"
          className="dark:stroke-zinc-700"
          strokeWidth="12"
          strokeLinecap={showGap ? 'round' : 'butt'}
          initial={false}
          animate={{
            strokeDasharray: `${remainingLength} ${C}`,
            strokeDashoffset: -(pConsumed * C + actualGap / 2),
          }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        />

        {/* Consumed arc (stroke width 18 - elevated thickness per Watermelon UI Returns Calculator preset) */}
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
            strokeDasharray: `${Math.max(0.1, consumedLength)} ${C}`,
            strokeDashoffset: -(actualGap / 2),
          }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        />
      </svg>

      {/* Center text with NumberFlow rolling percentage */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <AnimatedValue
          value={percent}
          suffix="%"
          className="font-display text-2xl font-black tracking-tight text-brand-text leading-none"
        />
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-muted mt-1 leading-none">
          Intake
        </span>
      </div>
    </div>
  );
};

export default DailyIntakeDonut;
