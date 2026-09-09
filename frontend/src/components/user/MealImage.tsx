'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Coffee, Soup, UtensilsCrossed } from 'lucide-react';
import type { MealType, PublicMealImage } from '@/types';

type Props = {
  image?: PublicMealImage | null;
  mealName: string;
  mealType?: MealType | string;
  className?: string;
  priority?: boolean;
};

export default function MealImage({ image, mealName, mealType, className = '', priority = false }: Props) {
  const [failed, setFailed] = useState(false);
  const Icon =
    mealType === 'BREAKFAST' ? Coffee : mealType === 'LUNCH' || mealType === 'DINNER' ? Soup : UtensilsCrossed;
  const showFallback = !image || failed;

  return (
    <figure
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-green/20 via-brand-surface to-brand-cyan/20 ${className}`}
    >
      {showFallback ? (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-center">
          <Icon className="h-8 w-8 text-brand-green" aria-hidden="true" />
          <span className="text-xs font-extrabold text-brand-text">{mealName}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Representative image</span>
        </div>
      ) : (
        <Image
          src={image.url}
          alt={image.altText}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
          priority={priority}
          onError={() => setFailed(true)}
        />
      )}
      {!showFallback && image.kind === 'REPRESENTATIVE' && (
        <figcaption className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold text-white">
          Representative image
        </figcaption>
      )}
      {!showFallback && (image.attribution.creator || image.attribution.licenseCode) && (
        <figcaption className="absolute bottom-2 right-2 max-w-[65%] truncate rounded-full bg-black/65 px-2 py-1 text-[9px] text-white">
          {[image.attribution.creator, image.attribution.licenseCode].filter(Boolean).join(' · ')}
        </figcaption>
      )}
    </figure>
  );
}
