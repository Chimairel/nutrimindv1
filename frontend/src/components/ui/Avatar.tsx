'use client';

import React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string | null;
  alt?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg';
  showSalakot?: boolean;
}

export interface FilipinoAvatarPreset {
  name: string;
  gender: 'male' | 'female';
  head: string;
  face: string;
  skinColor: string;
  clothingColor: string;
  description: string;
}

export const FILIPINO_AVATAR_PRESETS: FilipinoAvatarPreset[] = [
  { name: 'Juan', gender: 'male', head: 'short1', face: 'smile', skinColor: 'd08b5b', clothingColor: '00b159', description: 'Classic Filipino' },
  { name: 'Bayani', gender: 'male', head: 'short2', face: 'driven', skinColor: 'd08b5b', clothingColor: '03396c', description: 'Heroic & bold' },
  { name: 'Datu', gender: 'male', head: 'flatTop', face: 'calm', skinColor: 'd08b5b', clothingColor: 'ffd969', description: 'Distinguished chief' },
  { name: 'Malakas', gender: 'male', head: 'short3', face: 'smileBig', skinColor: '694d3d', clothingColor: '323232', description: 'Strong mythic hero' },
  { name: 'Maria', gender: 'female', head: 'long', face: 'smile', skinColor: 'e0ac69', clothingColor: 'ffeead', description: 'Traditional Filipina' },
  { name: 'Tala', gender: 'female', head: 'bun', face: 'cute', skinColor: 'f8d25c', clothingColor: '428bca', description: 'Goddess of stars' },
  { name: 'Luningning', gender: 'female', head: 'medium1', face: 'smileBig', skinColor: 'ffdbac', clothingColor: 'ae0001', description: 'Radiant & bright' },
  { name: 'Mayari', gender: 'female', head: 'longBangs', face: 'eatingHappy', skinColor: 'edb98a', clothingColor: '00b159', description: 'Moon goddess' },
  { name: 'Maganda', gender: 'female', head: 'longCurly', face: 'smile', skinColor: 'ffdbac', clothingColor: '428bca', description: 'Graceful mythic heroine' },
];

export const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className = '', src, alt, fallbackText = 'NM', size = 'md', showSalakot = true, ...props }, ref) => {
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
        if (src.toLowerCase() === 'default') {
          return undefined;
        }
        const matched = FILIPINO_AVATAR_PRESETS.find(
          (p) => p.name.toLowerCase() === src.toLowerCase()
        );
        if (matched) {
          return `https://api.dicebear.com/10.x/open-peeps/svg?seed=${encodeURIComponent(matched.name)}&headVariant=${matched.head}&expressionVariant=${matched.face}&skinColor=${matched.skinColor}&clothingColor=${matched.clothingColor}&scale=1.2&facialHairProbability=0&maskProbability=0&accessoriesProbability=0`;
        }
        return `https://api.dicebear.com/10.x/open-peeps/svg?seed=${encodeURIComponent(src)}&scale=1.2&facialHairProbability=0&maskProbability=0&accessoriesProbability=0`;
      }
      return undefined;
    };

    const displaySrc = getAvatarUrl();

    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={`
        relative flex shrink-0 overflow-visible rounded-2xl border border-white/10 bg-brand-surface font-semibold shadow-sm ring-1 ring-brand-green/10
        ${sizeClasses[size]} ${className}
      `}
        {...props}
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
          {displaySrc ? (
            <AvatarPrimitive.Image
              src={displaySrc}
              alt={alt}
              className="aspect-square h-full w-full object-cover animate-fade-in"
            />
          ) : null}
          <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-[inherit] bg-brand-bgAlt text-brand-green font-display font-semibold">
            {getInitials(fallbackText)}
          </AvatarPrimitive.Fallback>
        </div>
        {showSalakot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/icons/salakot.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-[14%] -right-[8%] w-[64%] h-auto select-none z-10 drop-shadow-sm"
          />
        )}
      </AvatarPrimitive.Root>
    );
  }
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

export default Avatar;
