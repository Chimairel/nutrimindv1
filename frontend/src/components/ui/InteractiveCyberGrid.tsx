'use client';

import React from 'react';

export interface InteractiveCyberGridProps {
  cols?: number;
  rows?: number;
  accentIndices?: number[];
  variant?: 'adaptive' | 'dark' | 'light';
  withMask?: boolean;
  className?: string;
}

export default function InteractiveCyberGrid({
  cols = 12,
  rows = 6,
  accentIndices = [],
  variant = 'adaptive',
  withMask = true,
  className = '',
}: InteractiveCyberGridProps) {
  const totalTiles = cols * rows;

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-0 overflow-hidden ${
        withMask
          ? '[mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]'
          : ''
      } ${className}`}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: totalTiles }).map((_, index) => {
          const isAccent = accentIndices.includes(index);

          let tileClasses = 'border transition-colors duration-500 hover:duration-0 ';
          if (variant === 'dark') {
            tileClasses += isAccent
              ? 'border-[#b8f45f]/40 bg-[#00b159]/25 hover:bg-[#b8f45f]/30'
              : 'border-white/[0.06] hover:border-[#b8f45f]/40 hover:bg-[#b8f45f]/20';
          } else if (variant === 'light') {
            tileClasses += isAccent
              ? 'border-emerald-600/30 bg-emerald-600/15 hover:bg-emerald-600/25'
              : 'border-slate-900/[0.06] hover:border-emerald-600/40 hover:bg-emerald-600/15';
          } else {
            // Adaptive (light / dark)
            tileClasses += isAccent
              ? 'border-emerald-600/30 bg-emerald-600/15 hover:bg-emerald-600/25 dark:border-[#b8f45f]/40 dark:bg-[#00b159]/25 dark:hover:bg-[#b8f45f]/30'
              : 'border-slate-900/[0.06] hover:border-emerald-600/40 hover:bg-emerald-600/15 dark:border-white/[0.06] dark:hover:border-[#b8f45f]/40 dark:hover:bg-[#b8f45f]/20';
          }

          return (
            <div
              key={index}
              data-grid-tile={index}
              className={tileClasses}
            />
          );
        })}
      </div>
    </div>
  );
}
