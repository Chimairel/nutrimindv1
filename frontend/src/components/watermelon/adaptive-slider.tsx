'use client';

import React, { useState, useMemo, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface SliderStop {
  value: number;
  label: string;
  sublabel: string;
  description: string;
  isAvailable: boolean;
  icon?: React.ReactNode;
}

export interface AdaptiveSliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  maxAllowed?: number;
  stops?: SliderStop[];
  onChange?: (value: number) => void;
  disabled?: boolean;
  hideDots?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-valuetext'?: string;
  'aria-describedby'?: string;
}

export const AnimatedText = ({ value, className = '' }: { value: string; className?: string }) => {
  return (
    <div className={`flex tracking-tight will-change-transform ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {value.split('').map((char, index) => {
          const displayChar = char === ' ' ? '\u00A0' : char;
          return (
            <motion.span
              key={`${char}-${index}`}
              initial={{ opacity: 0.3, y: -4, scale: 0.95 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 24,
                },
              }}
              exit={{ opacity: 0, y: 4, scale: 0.95, transition: { duration: 0.1 } }}
            >
              {displayChar}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export const AdaptiveSlider: React.FC<AdaptiveSliderProps> = ({
  value,
  defaultValue = 1,
  min = 1,
  max = 5,
  step = 1,
  maxAllowed = 5,
  onChange,
  disabled = false,
  hideDots = false,
  className = '',
  'aria-label': ariaLabel = 'Meal locality strength',
  'aria-valuetext': ariaValueText,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [internalValue, setInternalValue] = useState<number>(defaultValue);
  const currentValue = value ?? internalValue;
  const clampedValue = Math.min(Math.max(currentValue, min), maxAllowed);

  // Calculate percentage (0% to 100%)
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  // NutriMind branded adaptive gradients across stops
  const colorSettings = useMemo(() => {
    if (max === 3) {
      switch (clampedValue) {
        case 1:
          return {
            gradient: 'linear-gradient(to right, #08705b, #10b981)',
            thumbGlow: 'rgba(16, 185, 129, 0.4)',
          };
        case 2:
          return {
            gradient: 'linear-gradient(to right, #08705b, #14b8a6, #b8f45f)',
            thumbGlow: 'rgba(24, 185, 210, 0.45)',
          };
        case 3:
        default:
          return {
            gradient: 'linear-gradient(to right, #10b981, #b8f45f, #7759e8)',
            thumbGlow: 'rgba(184, 244, 95, 0.55)',
          };
      }
    }

    switch (clampedValue) {
      case 1:
        // Stop 1: National — NutriMind Green
        return {
          gradient: 'linear-gradient(to right, #08705b, #10b981)',
          thumbGlow: 'rgba(16, 185, 129, 0.4)',
        };
      case 2:
        // Stop 2: National & Regional blend — Teal / Cyan
        return {
          gradient: 'linear-gradient(to right, #08705b, #14b8a6, #18b9d2)',
          thumbGlow: 'rgba(24, 185, 210, 0.4)',
        };
      case 3:
        // Stop 3: Regional — Cyan to Lime Accent
        return {
          gradient: 'linear-gradient(to right, #08705b, #18b9d2, #b8f45f)',
          thumbGlow: 'rgba(184, 244, 95, 0.5)',
        };
      case 4:
        // Stop 4: Regional & Local blend — Vibrant Lime & Violet
        return {
          gradient: 'linear-gradient(to right, #18b9d2, #b8f45f, #a78bfa)',
          thumbGlow: 'rgba(184, 244, 95, 0.55)',
        };
      case 5:
      default:
        // Stop 5: Local (Province/HUC) — Full Spectrum Glow
        return {
          gradient: 'linear-gradient(to right, #10b981, #b8f45f, #7759e8)',
          thumbGlow: 'rgba(119, 89, 232, 0.55)',
        };
    }
  }, [clampedValue, max]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextVal = Number(e.target.value);
    const finalVal = Math.min(nextVal, maxAllowed);
    setInternalValue(finalVal);
    onChange?.(finalVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let nextVal = clampedValue;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextVal = Math.min(clampedValue + step, maxAllowed);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextVal = Math.max(clampedValue - step, min);
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextVal = min;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextVal = maxAllowed;
    }

    if (nextVal !== clampedValue) {
      setInternalValue(nextVal);
      onChange?.(nextVal);
    }
  };

  const totalStops = max - min + 1;

  return (
    <div className={`relative flex w-full flex-col select-none ${className}`}>
      {/* Track Container */}
      <div className="group relative flex h-12 w-full items-center overflow-hidden rounded-full border border-brand-border/70 bg-[#f1f3f5] transition-colors dark:border-white/10 dark:bg-neutral-900/90">
        {/* 5 Dots along track */}
        {!hideDots && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-5 transition-colors sm:px-6">
            {Array.from({ length: totalStops }).map((_, i) => {
              const stopNum = min + i;
              const isUnlocked = stopNum <= maxAllowed;
              const isFilled = stopNum <= clampedValue;
              return (
                <div
                  key={i}
                  className={`z-30 h-2 w-2 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                      : isUnlocked
                        ? 'bg-brand-border/90 dark:bg-neutral-600'
                        : 'bg-brand-border/40 dark:bg-neutral-800 opacity-40'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Dynamic Gradient Fill */}
        <motion.div
          className="pointer-events-none absolute top-0 left-0 h-full rounded-full"
          style={{ background: colorSettings.gradient }}
          animate={{
            width: `calc(${percentage}% + ${(1 - percentage / 100) * 48}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />

        {/* Accessible Range Input */}
        <input
          role="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={clampedValue}
          disabled={disabled || maxAllowed === min}
          onChange={handleSliderChange}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
          aria-describedby={ariaDescribedBy}
          className="absolute inset-0 z-50 h-12 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />

        {/* Sliding Thumb */}
        <motion.div
          className="pointer-events-none absolute top-0 z-40 flex h-12 w-12 items-center justify-center rounded-full"
          animate={{
            left: `calc(${percentage}% - ${(percentage / 100) * 48}px)`,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.22)] ring-2 ring-black/5 dark:bg-brand-dark dark:ring-white/20"
            style={{
              boxShadow: `0 3px 14px ${colorSettings.thumbGlow}`,
            }}
          >
            <span className="font-mono text-xs font-black text-brand-black dark:text-white">{clampedValue}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdaptiveSlider;
