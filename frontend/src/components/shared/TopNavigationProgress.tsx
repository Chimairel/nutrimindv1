'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setIsVisible(true);
    setProgress(20);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        return prev + Math.max(2, (85 - prev) * 0.15);
      });
    }, 120);
  };

  const completeProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 250);
  };

  const isFirstRender = useRef(true);

  // Complete progress whenever URL pathname or searchParams change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    completeProgress();
    return () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname, searchParams]);

  // Global click interceptor to catch any internal route links
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');

      // Only handle valid internal application routes
      if (!href || href.startsWith('#') || target === '_blank' || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      // Check if external URL
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;

        // If clicking the current page with no param change, ignore
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        // Trigger instantaneous top progress
        startProgress();
      } catch {
        // invalid URL string, ignore
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[99999] h-[2.5px] w-full overflow-hidden bg-transparent"
    >
      <div
        className="relative h-full bg-gradient-to-r from-emerald-500 via-brand-accent to-brand-cyan transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '180ms' : '220ms',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Luminous leading head */}
        <div className="absolute -right-2 top-[-2px] h-[6.5px] w-8 rounded-full bg-white blur-[2px] opacity-80" />
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent to-white/40 shadow-[0_0_12px_#54c7be,0_0_6px_#54c7be]" />
      </div>
    </div>
  );
}
