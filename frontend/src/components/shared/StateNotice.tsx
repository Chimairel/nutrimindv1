'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button, { ButtonProps } from '@/components/ui/Button';
import { useTheme } from '@/lib/context/ThemeContext';

export type StateNoticeVariant =
  | 'no-meal-plan'
  | 'action-needed'
  | 'access-denied'
  | 'verifying'
  | 'not-found'
  | 'custom';

export type EyebrowVariant = 'amber' | 'emerald' | 'cyan' | 'brand' | 'default';

export interface StateNoticeAction {
  label: string;
  href?: string;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  className?: string;
}

export interface StateNoticeProps {
  variant?: StateNoticeVariant;
  eyebrow?: React.ReactNode;
  eyebrowVariant?: EyebrowVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: StateNoticeAction | null;
  secondaryAction?: StateNoticeAction | null;
  imageSrc?: string;
  imageAlt?: string;
  imageSize?: number;
  layoutVariant?: 'inline' | 'page';
  className?: string;
  containerClassName?: string;
}

interface VariantDefaults {
  getImageSrc: (theme: string) => string;
  imageAlt: string;
  eyebrow?: string;
  eyebrowVariant: EyebrowVariant;
  title: string;
  description: string;
  action?: StateNoticeAction;
}

const VARIANT_CONFIGS: Record<StateNoticeVariant, VariantDefaults> = {
  'no-meal-plan': {
    getImageSrc: (theme) =>
      theme === 'dark' ? '/logo/sleeping-dark.svg' : '/logo/sleeping-light.svg',
    imageAlt: 'Meal plan status',
    eyebrowVariant: 'brand',
    title: "Meal planning isn't available yet",
    description: 'Complete the required account and health steps before your meal plan can be prepared.',
  },
  'action-needed': {
    getImageSrc: () => '/logo/unauthorized.svg',
    imageAlt: 'Access Restricted',
    eyebrow: 'Action Required',
    eyebrowVariant: 'amber',
    title: 'Nutrition Report Pending',
    description:
      'Please review and acknowledge your personalized nutrition report before accessing this feature.',
    action: {
      label: 'View Nutrition Report',
      href: '/profile/nutrition-report',
    },
  },
  'access-denied': {
    getImageSrc: () => '/logo/unauthorized.svg',
    imageAlt: 'Access Restricted',
    eyebrow: 'Access Restricted',
    eyebrowVariant: 'amber',
    title: 'Access Denied',
    description: 'You do not have permission to view this portal.',
    action: {
      label: 'Return to Workspace',
      href: '/dashboard',
    },
  },
  verifying: {
    getImageSrc: () => '/logo/verifying.svg',
    imageAlt: 'Plan Preparation',
    eyebrow: 'Plan Preparation',
    eyebrowVariant: 'cyan',
    title: 'Verification in Progress',
    description: 'Your meal items are currently being processed or reviewed.',
    action: {
      label: 'View Meal Plan',
      href: '/meals',
    },
  },
  'not-found': {
    getImageSrc: () => '/logo/not-found.svg',
    imageAlt: 'Page Not Found',
    eyebrow: '404',
    eyebrowVariant: 'amber',
    title: 'Page Not Found',
    description: 'The page or resource you are looking for does not exist or has been moved.',
    action: {
      label: 'Return Home',
      href: '/dashboard',
    },
  },
  custom: {
    getImageSrc: () => '/logo/unauthorized.svg',
    imageAlt: 'Notice',
    eyebrowVariant: 'default',
    title: '',
    description: '',
  },
};

const EYEBROW_STYLES: Record<EyebrowVariant, string> = {
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  emerald: 'border-brand-green/40 bg-brand-green/10 text-brand-green',
  brand: 'border-brand-green/40 bg-brand-green/10 text-brand-green',
  cyan: 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan',
  default: 'border-brand-border bg-brand-bgAlt/50 text-brand-muted',
};

export default function StateNotice({
  variant = 'no-meal-plan',
  eyebrow,
  eyebrowVariant,
  title,
  description,
  action,
  secondaryAction,
  imageSrc,
  imageAlt,
  imageSize = 380,
  layoutVariant = 'inline',
  className = '',
  containerClassName = '',
}: StateNoticeProps) {
  let activeTheme = 'light';
  try {
    const themeContext = useTheme();
    activeTheme = themeContext?.theme || 'light';
  } catch {
    activeTheme = 'light';
  }

  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS['no-meal-plan'];

  const resolvedImageSrc = imageSrc || config.getImageSrc(activeTheme);
  const resolvedImageAlt = imageAlt ?? config.imageAlt;
  const resolvedEyebrow = eyebrow !== undefined ? eyebrow : config.eyebrow;
  const resolvedEyebrowVariant = eyebrowVariant ?? config.eyebrowVariant;
  const resolvedTitle = title !== undefined ? title : config.title;
  const resolvedDescription = description !== undefined ? description : config.description;

  const resolvedAction = action === null ? null : (action !== undefined ? action : config.action);
  const resolvedSecondaryAction = secondaryAction;

  const containerClass =
    layoutVariant === 'page'
      ? `flex min-h-[75vh] w-full items-center justify-center px-4 py-8 ${containerClassName}`
      : `w-full py-8 sm:py-12 flex items-center justify-center ${containerClassName}`;

  const renderActionButton = (btnAction: StateNoticeAction, defaultVariant: 'primary' | 'secondary') => {
    const btnVariant = btnAction.variant || defaultVariant;
    const buttonElement = (
      <Button
        variant={btnVariant}
        onClick={btnAction.onClick}
        isLoading={btnAction.isLoading}
        disabled={btnAction.disabled}
        className={`w-full sm:w-auto sm:min-w-[180px] ${btnAction.className || ''}`}
      >
        {btnAction.label}
      </Button>
    );

    if (btnAction.href) {
      return (
        <Link href={btnAction.href} className="w-full sm:w-auto">
          {buttonElement}
        </Link>
      );
    }

    return buttonElement;
  };

  return (
    <div className={containerClass}>
      <div
        className={`flex w-full max-w-5xl flex-col items-center justify-center gap-8 sm:gap-12 md:flex-row md:items-center md:justify-center ${className}`}
        aria-label={typeof resolvedTitle === 'string' ? resolvedTitle : 'Notice'}
      >
        {/* Left: Floating Graphic (unboxed, glowing) */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            className="relative flex items-center justify-center transition-transform hover:scale-105 duration-500 ease-out w-64 h-64 sm:w-80 sm:h-80 md:w-[360px] md:h-[360px] lg:w-[400px] lg:h-[400px]"
            style={imageSize !== 380 ? { width: imageSize, height: imageSize } : undefined}
          >
            <Image
              src={resolvedImageSrc}
              alt={resolvedImageAlt}
              width={imageSize}
              height={imageSize}
              priority
              className="h-full w-full object-contain floating-glow-graphic"
            />
          </div>
        </div>

        {/* Right: Text & Actions */}
        <div className="flex max-w-xl flex-col items-center text-center md:items-start md:text-left floating-glow-text">
          {resolvedEyebrow && (
            <span
              className={`mb-3.5 inline-flex items-center rounded-full border px-4 py-1.5 font-mono text-xs font-extrabold uppercase tracking-wider ${
                EYEBROW_STYLES[resolvedEyebrowVariant] || EYEBROW_STYLES.default
              }`}
            >
              {resolvedEyebrow}
            </span>
          )}

          {resolvedTitle && (
            <h2 className="mb-3 font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-brand-text">
              {resolvedTitle}
            </h2>
          )}

          {resolvedDescription && (
            <p className="mb-6 text-sm sm:text-base leading-relaxed text-brand-muted">
              {resolvedDescription}
            </p>
          )}

          {(resolvedAction || resolvedSecondaryAction) && (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full sm:w-auto">
              {resolvedAction && renderActionButton(resolvedAction, 'primary')}
              {resolvedSecondaryAction && renderActionButton(resolvedSecondaryAction, 'secondary')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
