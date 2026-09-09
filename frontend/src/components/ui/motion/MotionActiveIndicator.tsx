'use client';

import React from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';

export interface MotionActiveIndicatorProps {
  layoutId: string;
  className?: string;
  transition?: Transition;
}

/**
 * Presentational active-item indicator that animates layout changes using motion/react.
 * - Renders only when mounted by caller (purely caller-controlled active state)
 * - Requires a unique layoutId for motion animation grouping
 * - Uses useReducedMotion to immediately snap with duration: 0 when reduced motion is requested
 * - Contains no internal state, clones no children, intercepts no events
 * - aria-hidden and pointer-events-none by design
 */
export function MotionActiveIndicator({ layoutId, className = '', transition }: MotionActiveIndicatorProps) {
  const shouldReduceMotion = useReducedMotion();

  const effectiveTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : (transition ?? { type: 'spring', bounce: 0.15, duration: 0.35 });

  return (
    <motion.div
      layoutId={layoutId}
      className={`absolute inset-0 pointer-events-none ${className}`}
      transition={effectiveTransition}
      aria-hidden="true"
    />
  );
}

export default MotionActiveIndicator;
