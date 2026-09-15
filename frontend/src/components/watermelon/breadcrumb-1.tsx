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
      <BreadcrumbList className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-medium text-brand-muted">
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
