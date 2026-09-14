import React from 'react';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = '', children, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#10201b]/[0.085] border border-[#10201b]/[0.04] dark:bg-white/10 dark:border-white/5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Skeleton;
