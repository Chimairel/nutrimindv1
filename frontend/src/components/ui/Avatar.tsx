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
  head?: string;
  face?: string;
  skinColor?: string;
  clothingColor?: string;
  customUrl?: string;
  description?: string;
}

export const FILIPINO_AVATAR_PRESETS: FilipinoAvatarPreset[] = [
  {
    name: 'Chimay',
    gender: 'male',
    head: 'dreads2',
    face: 'smileBig',
    skinColor: 'ffdbb4',
    clothingColor: 'ffcf77',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&headVariant=dreads2&facialHairVariant=&facialHairProbability=100&clothingColor=ffcf77&headContrastColor=2c1b18,ecdcbf,d6b370,f59797,b58143,a55728,724133,4a312c,c93305&seed=Felix',
  },
  { name: 'Kevin', gender: 'male', head: 'short2', face: 'driven', skinColor: 'd08b5b', clothingColor: '03396c' },
  { name: 'Bedic', gender: 'male', head: 'flatTop', face: 'calm', skinColor: 'd08b5b', clothingColor: 'ffd969' },
  { name: 'Ichan', gender: 'male', head: 'short3', face: 'smileBig', skinColor: '694d3d', clothingColor: '323232' },
  { name: 'Telay', gender: 'female', head: 'long', face: 'smile', skinColor: 'e0ac69', clothingColor: 'ffeead' },
  { name: 'Maeann', gender: 'female', head: 'bun', face: 'cute', skinColor: 'f8d25c', clothingColor: '428bca' },
  { name: 'Jenelyn', gender: 'female', head: 'longBangs', face: 'eatingHappy', skinColor: 'edb98a', clothingColor: '00b159' },
  { name: 'Mayan', gender: 'female', head: 'longCurly', face: 'smile', skinColor: 'ffdbac', clothingColor: '428bca' },
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
          if (matched.customUrl) {
            return matched.customUrl;
          }
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
