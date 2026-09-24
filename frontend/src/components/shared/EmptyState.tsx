'use client';

import React from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { Soup } from 'lucide-react';
import StateNotice from './StateNotice';

interface EmptyStateProps {
  icon?: React.ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  imageSize?: number;
  useSleepingGraphic?: boolean;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Soup className="h-8 w-8 text-brand-green" />,
  imageSrc,
  imageAlt,
  imageSize = 220,
  useSleepingGraphic = false,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  if (useSleepingGraphic) {
    return (
      <StateNotice
        variant="no-meal-plan"
        title={title}
        description={description}
        action={
          actionText
            ? {
                label: actionText,
                onClick: onAction,
              }
            : null
        }
        className={className}
      />
    );
  }

  return (
    <div
      className={`
        surface-panel mx-auto my-6 flex max-w-lg flex-col items-center justify-center rounded-[28px] border-dashed p-8 sm:p-10 text-center
        ${className}
      `}
    >
      {imageSrc ? (
        <div className="relative mb-5 flex h-44 w-44 sm:h-52 sm:w-52 items-center justify-center transition-transform hover:scale-105 duration-500 ease-out">
          <Image
            src={imageSrc}
            alt={imageAlt || title}
            width={imageSize}
            height={imageSize}
            priority
            className="h-full w-full object-contain floating-glow-graphic"
          />
        </div>
      ) : (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 p-4 text-brand-green shadow-cyan">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold tracking-tight text-brand-text mb-1.5 font-display">{title}</h3>
      <p className="text-sm text-brand-muted leading-relaxed mb-6 px-4">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
