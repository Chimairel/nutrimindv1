'use client';

import React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export type BreadcrumbSegment =
  | {
      label: string;
      href: string;
      current?: false;
    }
  | {
      label: string;
      current: true;
      href?: never;
    };

export interface Breadcrumb1Props {
  segments?: readonly BreadcrumbSegment[];
  className?: string;
}

const defaultSegments: readonly BreadcrumbSegment[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Meals', current: true },
] as const;

export const Breadcrumb1: React.FC<Breadcrumb1Props> = ({
  segments = defaultSegments,
  className = '',
}) => {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="border-brand-border/70 bg-brand-surface/90 text-xs w-full max-w-full justify-center rounded-2xl border px-2 py-1.5 shadow-sm sm:w-fit sm:justify-start sm:rounded-full sm:px-3">
        {segments.map((segment, index) => (
          <BreadcrumbItem key={segment.label}>
            {'href' in segment && segment.href ? (
              <BreadcrumbLink href={segment.href}>
                {segment.label}
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{segment.label}</BreadcrumbPage>
            )}
            {index < segments.length - 1 ? <BreadcrumbSeparator /> : null}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumb1;
