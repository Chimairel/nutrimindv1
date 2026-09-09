'use client';

/**
 * Adapted from Motion Primitives (https://motion-primitives.com/docs/animated-number)
 * Upstream repository: https://github.com/ibelick/motion-primitives
 * Upstream license: MIT
 *
 * Material modifications:
 * - Uses official `motion/react` imports and strictly monotonic tween instead of spring physics
 * - Clamped clinical safety boundaries: strictly no overshoot, no negative intermediate numbers, no transient inflated values
 * - Accessible screen-reader presentation: stable authoritative text in visually hidden element + aria-hidden display
 * - Strict prefers-reduced-motion immediate settle
 * - Prevents spurious re-animation on window focus, route remounts, or unchanged cached revalidations
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export interface AnimatedNumberProps {
  value: number;
  format?: (val: number) => string;
  duration?: number; // duration in milliseconds, default 350ms
  className?: string;
  ariaLabel?: string;
  initial?: number;
}

export function AnimatedNumber({
  value,
  format,
  duration = 350,
  className = '',
  ariaLabel,
  initial,
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const startVal = initial !== undefined ? initial : value;
  const [displayValue, setDisplayValue] = useState<number>(shouldReduceMotion ? value : startVal);
  const currentRef = useRef<number>(displayValue);
  const prevTargetRef = useRef<number>(value);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If reduced motion is preferred, immediately settle to the target
    if (shouldReduceMotion) {
      currentRef.current = value;
      prevTargetRef.current = value;
      setDisplayValue(value);
      return;
    }

    // Do not animate if the target value has not changed (e.g. window focus, unchanged cache)
    if (prevTargetRef.current === value && currentRef.current === value) {
      return;
    }

    const start = currentRef.current;
    const target = value;
    prevTargetRef.current = target;

    if (start === target) {
      return;
    }

    const startTime = performance.now();
    const animDuration = Math.max(50, duration);

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / animDuration);

      // Strictly monotonic cubic ease-out: p = 1 - (1 - t)^3
      // Derivative dp/dt = 3*(1-t)^2 >= 0, guaranteeing strict monotonicity
      const ease = 1 - Math.pow(1 - progress, 3);
      let interpolated = start + (target - start) * ease;

      // Enforce strict monotonic bounds: no overshoot, no values below start or above target
      if (target >= start) {
        interpolated = Math.min(target, Math.max(start, interpolated));
      } else {
        interpolated = Math.max(target, Math.min(start, interpolated));
      }

      // Safeguard against negative intermediate values if endpoints are non-negative
      if (start >= 0 && target >= 0 && interpolated < 0) {
        interpolated = 0;
      }

      currentRef.current = interpolated;
      setDisplayValue(interpolated);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setDisplayValue(target);
      }
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, shouldReduceMotion]);

  const authoritativeText = format ? format(value) : value.toLocaleString();
  const displayString = format ? format(displayValue) : Math.round(displayValue).toLocaleString();

  return (
    <span className={`inline-block ${className}`} aria-label={ariaLabel ?? authoritativeText}>
      {/* Authoritative static value for screen readers */}
      <span className="sr-only">{ariaLabel ?? authoritativeText}</span>
      {/* Visual animated representation hidden from screen reader frame announcements */}
      <span aria-hidden="true">{displayString}</span>
    </span>
  );
}

export default AnimatedNumber;
