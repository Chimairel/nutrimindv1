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
    face: 'explaining',
    clothingColor: 'ffcf77',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=&expressionVariant=explaining&facialHairVariant=&headVariant=dreads2&maskVariant=&clothingColor=ffcf77&seed=Chimay',
  },
  {
    name: 'Kevin',
    gender: 'male',
    head: 'twists',
    face: 'eyesClosed',
    clothingColor: '78e185',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=glasses,glasses2,glasses3,glasses4,glasses5&accessoriesProbability=0&expressionProbability=100&expressionVariant=eyesClosed&headVariant=twists&clothingColor=78e185&seed=Kevin',
  },
  {
    name: 'Bedic',
    gender: 'male',
    head: 'short5',
    face: 'serious',
    clothingColor: 'ffffff',
    skinColor: 'edb98a',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=glasses&accessoriesProbability=97&expressionVariant=serious&headVariant=short5&clothingColor=ffffff&skinColor=edb98a&facialHairVariant=&seed=Bedic',
  },
  {
    name: 'Ichan',
    gender: 'male',
    head: 'twists2',
    face: 'smileBig',
    clothingColor: 'e78276',
    skinColor: 'd08b5b',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=&expressionVariant=smileBig&facialHairVariant=&headVariant=twists2&clothingColor=e78276&skinColor=d08b5b&seed=Ichan',
  },
  {
    name: 'Telay',
    gender: 'female',
    head: 'long',
    face: 'cheeky',
    clothingColor: '9ddadb',
    skinColor: 'edb98a',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=&expressionVariant=cheeky&facialHairVariant=&headVariant=long&clothingColor=9ddadb&skinColor=edb98a&seed=Telay',
  },
  {
    name: 'Maeann',
    gender: 'female',
    head: 'mediumBangs3',
    face: 'cute',
    clothingColor: 'e279c7',
    skinColor: 'edb98a',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=&expressionVariant=cute&facialHairVariant=&headVariant=mediumBangs3&clothingColor=e279c7&skinColor=edb98a&maskProbability=0&maskVariant=&seed=Maeann',
  },
  {
    name: 'Jenelyn',
    gender: 'female',
    head: 'longBangs',
    face: 'suspicious',
    clothingColor: 'e279c7',
    skinColor: 'edb98a',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=&expressionVariant=suspicious&facialHairVariant=&headVariant=longBangs&clothingColor=e279c7&skinColor=edb98a&maskProbability=0&maskVariant=&seed=Jenelyn',
  },
  {
    name: 'Mayan',
    gender: 'female',
    head: 'bun2',
    face: 'calm',
    clothingColor: '8fa7df',
    skinColor: 'edb98a',
    customUrl: 'https://api.dicebear.com/10.x/open-peeps/svg?scale=1.2&accessoriesVariant=glasses2&expressionVariant=calm&facialHairVariant=&headVariant=bun2&skinColor=edb98a&maskProbability=0&maskVariant=&accessoriesProbability=100&clothingColor=8fa7df&seed=Mayan',
  },
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
        relative flex shrink-0 overflow-visible rounded-full bg-brand-surface font-semibold shadow-sm
        ${sizeClasses[size]} ${className}
      `}
        {...props}
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          {displaySrc ? (
            <AvatarPrimitive.Image
              src={displaySrc}
              alt={alt}
              className="aspect-square h-full w-full object-cover animate-fade-in"
            />
          ) : null}
          <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-brand-bgAlt text-brand-green font-display font-semibold">
            {getInitials(fallbackText)}
          </AvatarPrimitive.Fallback>
        </div>
        {showSalakot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/icons/salakot.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-[12%] -right-[4%] w-[64%] h-auto select-none z-10 drop-shadow-md"
          />
        )}
      </AvatarPrimitive.Root>
    );
  }
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

export default Avatar;
