'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export interface UnauthorizedStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export interface UnauthorizedStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: UnauthorizedStateAction | null;
  secondaryAction?: UnauthorizedStateAction | null;
  variant?: 'card' | 'page';
  className?: string;
  imageAlt?: string;
  imageSize?: number;
}

export default function UnauthorizedState({
  title = 'Nutrition Report Pending',
  description = 'Please review and acknowledge your personalized nutrition report before accessing this feature.',
  eyebrow,
  action = {
    label: 'View Nutrition Report',
    href: '/profile/nutrition-report',
  },
  secondaryAction,
  variant = 'card',
  className = '',
  imageAlt = 'Access Restricted',
  imageSize = 380,
}: UnauthorizedStateProps) {
  const containerClass =
    variant === 'page'
      ? 'flex min-h-[75vh] w-full items-center justify-center px-4 py-8'
      : 'w-full py-8 sm:py-12 flex items-center justify-center';

  return (
    <div className={containerClass}>
      <div
        className={`flex w-full max-w-5xl flex-col items-center justify-center gap-8 sm:gap-12 md:flex-row md:items-center md:justify-center ${className}`}
        aria-label={typeof title === 'string' ? title : 'Access Restricted'}
      >
        {/* Left: Floating Graphic */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            className="relative flex items-center justify-center transition-transform hover:scale-105 duration-500 ease-out w-64 h-64 sm:w-80 sm:h-80 md:w-[360px] md:h-[360px] lg:w-[400px] lg:h-[400px]"
            style={imageSize !== 380 ? { width: imageSize, height: imageSize } : undefined}
          >
            <Image
              src="/logo/unauthorized.svg"
              alt={imageAlt}
              width={imageSize}
              height={imageSize}
              priority
              className="h-full w-full object-contain floating-glow-graphic"
            />
          </div>
        </div>

        {/* Right: Text & Actions */}
        <div className="flex max-w-xl flex-col items-center text-center md:items-start md:text-left floating-glow-text">
          {eyebrow && (
            <span className="mb-3.5 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 font-mono text-xs font-extrabold uppercase tracking-wider text-amber-500">
              {eyebrow}
            </span>
          )}

          <h2 className="mb-3 font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-brand-text">
            {title}
          </h2>

          <p className="mb-6 text-sm sm:text-base leading-relaxed text-brand-muted">
            {description}
          </p>

          {(action || secondaryAction) && (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full sm:w-auto">
              {action && (
                action.href ? (
                  <Link href={action.href} className="w-full sm:w-auto">
                    <Button variant="primary" className={`w-full sm:min-w-[180px] ${action.className || ''}`}>
                      {action.label}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="primary"
                    onClick={action.onClick}
                    className={`w-full sm:w-auto sm:min-w-[180px] ${action.className || ''}`}
                  >
                    {action.label}
                  </Button>
                )
              )}

              {secondaryAction && (
                secondaryAction.href ? (
                  <Link href={secondaryAction.href} className="w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      className={`w-full sm:w-auto sm:min-w-[140px] ${secondaryAction.className || ''}`}
                    >
                      {secondaryAction.label}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={secondaryAction.onClick}
                    className={`w-full sm:w-auto sm:min-w-[140px] ${secondaryAction.className || ''}`}
                  >
                    {secondaryAction.label}
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
