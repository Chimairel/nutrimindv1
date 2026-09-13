'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface SystemErrorPanelProps {
  code?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
  className?: string;
}

function BackgroundGrid() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]">
      <div className="grid h-full w-full grid-cols-12 grid-rows-6">
        {Array.from({ length: 72 }).map((_, index) => {
          // Pre-tint the accent block behind the 404 (row 4, columns 9 & 10) matching the Watermelon UI screenshot
          const isAccentBlock = index === 45 || index === 46;
          return (
            <div
              key={index}
              className={`border transition-colors duration-300 ${
                isAccentBlock
                  ? 'border-[#b8f45f]/40 bg-[#00b159]/25 hover:bg-[#b8f45f]/25'
                  : 'border-white/[0.06] hover:border-[#b8f45f]/30 hover:bg-[#b8f45f]/15'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SystemErrorPanel({
  code = '404',
  title = 'This destination isn’t accessible.',
  description = 'The resource you attempted to open may have been moved, archived, or temporarily disconnected from the network.',
  buttonLabel = 'Return to Dashboard',
  buttonHref = '/dashboard',
  className = '',
}: SystemErrorPanelProps) {
  return (
    <div
      className={`relative w-full max-w-5xl overflow-hidden rounded-[32px] sm:rounded-[40px] border border-white/10 bg-[linear-gradient(180deg,#0d1713_0%,#07100d_60%,#050a08_100%)] p-6 sm:p-10 lg:p-14 shadow-[0_32px_100px_rgba(1,8,5,0.5)] ${className}`}
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-cyan/10 blur-3xl" />

      {/* Interactive Cyber Grid */}
      <BackgroundGrid />

      {/* Main Grid Content */}
      <div className="relative z-10 grid min-h-[420px] grid-cols-1 gap-8 sm:grid-cols-2 sm:items-center">
        {/* Left Side: Error Info */}
        <div className="order-2 flex flex-col items-center text-center sm:order-1 sm:items-start sm:text-start">
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              {title}
            </h1>
            <p className="max-w-sm font-sans text-sm leading-relaxed text-white/65 sm:text-base">
              {description}
            </p>
          </div>

          <div className="mt-6">
            <Link
              href={buttonHref}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-brand-accent px-5 py-3 text-sm font-extrabold text-[#07100d] shadow-neon transition-all duration-200 hover:scale-[1.02] hover:bg-brand-accent/90 hover:shadow-[0_0_36px_rgba(184,244,95,0.4)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d]"
            >
              <span>{buttonLabel}</span>
              <span className="flex items-center justify-center transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </span>
            </Link>
          </div>
        </div>

        {/* Right Side: Big 404 */}
        <div className="pointer-events-none order-1 flex items-center justify-center sm:order-2">
          <span className="select-none font-sans text-[8rem] font-light leading-none tracking-tighter text-white/70 sm:text-[10rem] md:text-[12rem] lg:text-[14rem]">
            {code}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SystemErrorPanel;
