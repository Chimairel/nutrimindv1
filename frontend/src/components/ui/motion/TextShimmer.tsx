'use client';

/**
 * Adapted from Motion Primitives (https://motion-primitives.com/docs/text-shimmer)
 * Upstream repository: https://github.com/ibelick/motion-primitives
 * Upstream license: MIT
 *
 * Material modifications:
 * - Uses React 19 and official `motion/react` imports
 * - Fully opaque text endpoints (from-brand-text via-brand-accent to-brand-text) for clinical legibility
 * - Strict prefers-reduced-motion fallback rendering static text
 */

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface TextShimmerProps {
  children: string;
  className?: string;
  duration?: number;
}

export function TextShimmer({ children, className = '', duration = 2 }: TextShimmerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={`inline-block bg-[length:250%_100%] bg-clip-text text-transparent bg-gradient-to-r from-brand-text via-brand-accent to-brand-text ${className}`}
      initial={{ backgroundPosition: '100% 0' }}
      animate={{ backgroundPosition: '0% 0' }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
    >
      {children}
    </motion.span>
  );
}

export default TextShimmer;
