'use client';

import React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className = '', src, alt, fallbackText = 'NM', size = 'md', ...props }, ref) => {
  const sizeClasses = {
    sm: 'h-10 w-10 text-xs',
    md: 'h-14 w-14 text-sm',
    lg: 'h-24 w-24 text-2xl',
  };

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getAvatarUrl = () => {
    if (src) {
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return src;
      }
      return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(src)}`;
    }
    const seed = fallbackText ? fallbackText.trim() : 'user';
    return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`;
  };

  const displaySrc = getAvatarUrl();

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={`
        relative flex shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-brand-surface font-semibold shadow-sm ring-1 ring-brand-green/10
        ${sizeClasses[size]} ${className}
      `}
      {...props}
    >
      <AvatarPrimitive.Image
        src={displaySrc}
        alt={alt}
        className="aspect-square h-full w-full object-cover animate-fade-in"
      />
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center rounded-2xl bg-brand-bgAlt text-brand-green font-display font-semibold"
      >
        {getInitials(fallbackText)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

export default Avatar;
