import React from 'react';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-brand-border/60 dark:bg-white/10 ${className}`}
      {...props}
    />
  );
}

export default Skeleton;
