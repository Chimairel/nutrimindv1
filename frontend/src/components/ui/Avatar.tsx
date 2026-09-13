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
  hair: string;
  clothing?: string;
  clothingColor?: string;
  skinColor?: string;
  description: string;
}

export const FILIPINO_AVATAR_PRESETS: FilipinoAvatarPreset[] = [
  { name: 'Juan', gender: 'male', hair: 'short01', clothing: 'variant01', skinColor: 'e0b687', description: 'Classic Filipino' },
  { name: 'Bayani', gender: 'male', hair: 'short04', clothing: 'variant02', skinColor: 'cb9e6e', description: 'Heroic & bold' },
  { name: 'Datu', gender: 'male', hair: 'short16', clothing: 'variant08', skinColor: 'a26d3d', description: 'Distinguished chief' },
  { name: 'Malakas', gender: 'male', hair: 'short08', clothing: 'variant03', skinColor: 'b68655', description: 'Strong mythic hero' },
  { name: 'Maria', gender: 'female', hair: 'long01', clothing: 'variant14', skinColor: 'eac393', description: 'Traditional Filipina' },
  { name: 'Tala', gender: 'female', hair: 'long08', clothing: 'variant18', skinColor: 'f5cfa0', description: 'Goddess of stars' },
  { name: 'Luningning', gender: 'female', hair: 'long14', clothing: 'variant13', skinColor: 'ffdbac', description: 'Radiant & bright' },
  { name: 'Mayari', gender: 'female', hair: 'long03', clothing: 'variant19', skinColor: 'e0b687', description: 'Moon goddess' },
  { name: 'Maganda', gender: 'female', hair: 'long10', clothing: 'variant20', skinColor: 'cb9e6e', description: 'Graceful mythic heroine' },
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
          const skin = matched.skinColor ? `&skinColor=${matched.skinColor}` : '';
          const cloth = matched.clothing ? `&clothing=${matched.clothing}` : '';
          const clothColor = matched.clothingColor ? `&clothingColor=${matched.clothingColor}` : '';
          return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(matched.name)}&hair=${matched.hair}&beardProbability=0&hatProbability=0${cloth}${clothColor}${skin}`;
        }
        return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(src)}&hatProbability=0`;
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
