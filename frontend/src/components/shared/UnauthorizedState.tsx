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
  imageSize = 220,
}: UnauthorizedStateProps) {
  const containerClass =
    variant === 'page'
      ? 'flex min-h-[70vh] w-full items-center justify-center px-4 py-8'
      : 'w-full my-6 flex items-center justify-center';

  const cardClass = `surface-panel flex w-full max-w-xl flex-col items-center justify-center rounded-[30px] border border-brand-border/70 bg-brand-surface/75 p-6 text-center shadow-card backdrop-blur-md sm:p-10 ${className}`;

  return (
    <div className={containerClass}>
      <section className={cardClass} aria-label={typeof title === 'string' ? title : 'Access Restricted'}>
        {eyebrow && (
          <span className="mb-4 inline-flex items-center rounded-full border border-status-pending-text/30 bg-status-pending-bg/15 px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-status-pending-text">
            {eyebrow}
          </span>
        )}

        <div className="relative mb-6 flex items-center justify-center">
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{ width: imageSize, height: imageSize }}
          >
            <Image
              src="/logo/unauthorized.svg"
              alt={imageAlt}
              width={imageSize}
              height={imageSize}
              priority
              className="h-full w-full object-contain drop-shadow-sm"
            />
          </div>
        </div>

        <h2 className="mb-2.5 font-display text-xl sm:text-2xl font-black tracking-tight text-brand-text">
          {title}
        </h2>

        <p className="mb-8 max-w-md text-xs sm:text-sm leading-relaxed text-brand-muted">
          {description}
        </p>

        {(action || secondaryAction) && (
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
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
      </section>
    </div>
  );
}
