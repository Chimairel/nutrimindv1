'use client';

import React, { useEffect, useState } from 'react';

export interface InteractiveCyberGridProps {
  cols?: number;
  rows?: number;
  accentIndices?: number[];
  variant?: 'adaptive' | 'dark' | 'light';
  withMask?: boolean;
  randomCycle?: boolean;
  cycleInterval?: number;
  className?: string;
}

export default function InteractiveCyberGrid({
  cols = 12,
  rows = 6,
  accentIndices = [],
  variant = 'adaptive',
  withMask = true,
  randomCycle = true,
  cycleInterval = 2500,
  className = '',
}: InteractiveCyberGridProps) {
  const totalTiles = cols * rows;

  // Track active ambient accent tiles
  const [activeAccents, setActiveAccents] = useState<number[]>(() => {
    if (accentIndices && accentIndices.length > 0) {
      return accentIndices;
    }
    return [30, 50].filter((idx) => idx < totalTiles);
  });

  // Periodically fade out one tile and fade in another at a random position
  useEffect(() => {
    if (!randomCycle || totalTiles === 0) return;

    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const interval = setInterval(() => {
      setActiveAccents((prev) => {
        if (prev.length === 0) return prev;

        // Choose one tile slot to cycle
        const slotToReplace = Math.floor(Math.random() * prev.length);

        // Pick a new random tile that isn't already active
        let newTile = Math.floor(Math.random() * totalTiles);
        for (let attempt = 0; attempt < 12 && prev.includes(newTile); attempt++) {
          newTile = Math.floor(Math.random() * totalTiles);
        }

        const next = [...prev];
        next[slotToReplace] = newTile;
        return next;
      });
    }, cycleInterval);

    return () => clearInterval(interval);
  }, [randomCycle, totalTiles, cycleInterval]);

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
          const isAccent = activeAccents.includes(index);

          // Smooth 1000ms transition for ambient fading, instant hover highlight
          let tileClasses = 'border transition-colors duration-1000 ease-in-out hover:duration-0 ';
          if (variant === 'dark') {
            tileClasses += isAccent
              ? 'border-[#b8f45f]/40 bg-[#00b159]/25 hover:bg-[#b8f45f]/35'
              : 'border-white/[0.06] hover:border-[#b8f45f]/40 hover:bg-[#b8f45f]/20';
          } else if (variant === 'light') {
            tileClasses += isAccent
              ? 'border-emerald-600/30 bg-emerald-600/15 hover:bg-emerald-600/25'
              : 'border-slate-900/[0.06] hover:border-emerald-600/40 hover:bg-emerald-600/15';
          } else {
            // Adaptive (light / dark)
            tileClasses += isAccent
              ? 'border-emerald-600/30 bg-emerald-600/15 hover:bg-emerald-600/25 dark:border-[#b8f45f]/40 dark:bg-[#00b159]/25 dark:hover:bg-[#b8f45f]/35'
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
