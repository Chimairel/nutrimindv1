'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { Apple, Coffee, Egg, ExternalLink, Fish, Flame, Salad, Soup, UtensilsCrossed } from 'lucide-react';
import type { MealType, PublicMealImage } from '@/types';

export type MealCategory =
  'seafood' | 'plant-based' | 'poultry-egg' | 'meat' | 'soup-stew' | 'breakfast-grain' | 'snack' | 'general';

export interface MealCategoryInfo {
  category: MealCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    dot: string;
  };
}

export function resolveMealCategory(
  mealName: string,
  mealType?: MealType | string,
  ingredients?: { ingredientName: string; category?: string }[]
): MealCategoryInfo {
  const name = (mealName || '').toLowerCase();
  const ingText = (ingredients || []).map((i) => i.ingredientName.toLowerCase()).join(' ');
  const combined = `${name} ${ingText}`;

  // 1. Seafood
  if (
    /fish|bangus|tilapia|tuna|salmon|shrimp|hipon|squid|pusit|sardine|seafood|crab|mackerel|galunggong|tamban|tanigue/.test(
      combined
    )
  ) {
    return {
      category: 'seafood',
      label: 'Seafood',
      icon: Fish,
      tone: {
        bg: 'from-cyan-950/40 via-brand-surface to-brand-cyan/15',
        border: 'border-cyan-500/25',
        text: 'text-cyan-400',
        badgeBg: 'bg-cyan-500/15',
        badgeText: 'text-cyan-300',
        dot: 'bg-cyan-400',
      },
    };
  }

  // 2. Plant-based / Vegetables / Legumes
  if (
    /tofu|tokwa|munggo|monggo|vegetable|gulay|pinakbet|kangkong|cabbage|sayote|eggplant|talong|salad|sitaw|pechay|kalabasa|mushroom|beans|ampalaya|chopsuey/.test(
      combined
    )
  ) {
    return {
      category: 'plant-based',
      label: 'Plant-based',
      icon: Salad,
      tone: {
        bg: 'from-emerald-950/40 via-brand-surface to-brand-green/15',
        border: 'border-brand-green/25',
        text: 'text-brand-green',
        badgeBg: 'bg-brand-green/15',
        badgeText: 'text-brand-green',
        dot: 'bg-brand-green',
      },
    };
  }

  // 3. Poultry & Egg
  if (/egg|eggs|itlog|scrambled|omelet|omelette|chicken|manok|tinola|inasal|afritada/.test(combined)) {
    return {
      category: 'poultry-egg',
      label: 'Poultry & Egg',
      icon: Egg,
      tone: {
        bg: 'from-amber-950/40 via-brand-surface to-amber-500/15',
        border: 'border-amber-500/25',
        text: 'text-amber-400',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-300',
        dot: 'bg-amber-400',
      },
    };
  }

  // 4. Meat & Savory
  if (/pork|baboy|beef|baka|liempo|adobo|bistek|menudo|caldereta|giniling|tapa|meat|steak/.test(combined)) {
    return {
      category: 'meat',
      label: 'Meat & Savory',
      icon: Flame,
      tone: {
        bg: 'from-rose-950/40 via-brand-surface to-rose-500/15',
        border: 'border-rose-500/25',
        text: 'text-rose-400',
        badgeBg: 'bg-rose-500/15',
        badgeText: 'text-rose-300',
        dot: 'bg-rose-400',
      },
    };
  }

  // 5. Soup & Stew
  if (/soup|stew|sinigang|nilaga|bulalo|sopas|mami|broth/.test(combined)) {
    return {
      category: 'soup-stew',
      label: 'Soup & Stew',
      icon: Soup,
      tone: {
        bg: 'from-emerald-950/30 via-brand-surface to-emerald-500/15',
        border: 'border-emerald-500/25',
        text: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-300',
        dot: 'bg-emerald-400',
      },
    };
  }

  // 6. Breakfast & Grains
  if (
    mealType === 'BREAKFAST' ||
    /pandesal|oatmeal|champorado|silog|lugaw|arroz caldo|bread|pancake|coffee|waffle|oats|toast/.test(combined)
  ) {
    return {
      category: 'breakfast-grain',
      label: 'Breakfast & Grain',
      icon: Coffee,
      tone: {
        bg: 'from-amber-950/30 via-brand-surface to-brand-accent/15',
        border: 'border-brand-accent/25',
        text: 'text-brand-accent',
        badgeBg: 'bg-brand-accent/15',
        badgeText: 'text-brand-accent',
        dot: 'bg-brand-accent',
      },
    };
  }

  // 7. Snacks & Fruit
  if (mealType === 'SNACK' || /fruit|apple|banana|saba|camote|snack/.test(combined)) {
    return {
      category: 'snack',
      label: 'Snack & Fruit',
      icon: Apple,
      tone: {
        bg: 'from-purple-950/40 via-brand-surface to-purple-500/15',
        border: 'border-purple-500/25',
        text: 'text-purple-400',
        badgeBg: 'bg-purple-500/15',
        badgeText: 'text-purple-300',
        dot: 'bg-purple-400',
      },
    };
  }

  // Default General
  return {
    category: 'general',
    label: mealType ? mealType.toLowerCase() : 'Meal',
    icon: UtensilsCrossed,
    tone: {
      bg: 'from-brand-green/20 via-brand-surface to-brand-cyan/20',
      border: 'border-brand-border/70',
      text: 'text-brand-green',
      badgeBg: 'bg-brand-green/10',
      badgeText: 'text-brand-green',
      dot: 'bg-brand-green',
    },
  };
}

const CANONICAL_FALLBACK_IMAGES: Record<
  string,
  { url: string; altText: string; creator: string; licenseCode: string; licenseUrl: string }
> = {
  oatmeal: {
    url: '/meals/oatmeal.jpg',
    altText: 'A bowl of cooked oatmeal with milk',
    creator: 'Renee Comet (Photographer), National Cancer Institute',
    licenseCode: 'PUBLIC_DOMAIN',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  pandesal: {
    url: '/meals/pandesal.jpg',
    altText: 'Fresh Filipino pandesal rolls served on a plate',
    creator: 'Jessartcam',
    licenseCode: 'CC_BY_SA_4_0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  egg: {
    url: '/meals/scrambled-egg-rice.jpg',
    altText: 'Fried egg served over a bowl of vegetable rice',
    creator: 'PaulGorduiz106',
    licenseCode: 'CC_BY_SA_4_0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  },
  beef: {
    url: '/meals/beef-bowl.jpg',
    altText: 'A braised beef and vegetable rice bowl',
    creator: 'Andy Li',
    licenseCode: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
  pork: {
    url: '/meals/pork-bowl.jpg',
    altText: 'A braised pork rice bowl with vegetables',
    creator: 'Andy Li',
    licenseCode: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
  seafood: {
    url: '/meals/tuna-bowl.jpg',
    altText: 'A tuna, salmon, cucumber, and vegetable rice bowl',
    creator: 'Andy Li',
    licenseCode: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
  tofu: {
    url: '/meals/tofu-bowl.jpg',
    altText: 'A tofu and vegetable rice bowl',
    creator: 'Andy Li',
    licenseCode: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  },
};

export function resolveCanonicalReviewedImage(
  mealName: string,
  mealType?: MealType | string,
  ingredients?: { ingredientName: string; category?: string }[]
): PublicMealImage | null {
  const combined = `${mealName || ''} ${(ingredients || []).map((i) => i.ingredientName).join(' ')}`.toLowerCase();
  let key: string | null = null;
  if (/oatmeal|hot cereal|rolled oats|oats|porridge|champorado/.test(combined)) {
    key = 'oatmeal';
  } else if (/pandesal|pan de|bread|toast|bun|bakery/.test(combined)) {
    key = 'pandesal';
  } else if (/egg|eggs|itlog|omelet|scrambled|silog|bonete/.test(combined)) {
    key = 'egg';
  } else if (/tuna|salmon|bangus|tilapia|seafood|fish|hipon|shrimp|squid|pusit/.test(combined)) {
    key = 'seafood';
  } else if (/beef|baka|bistek|tapa|steak|chuck|caldereta|nilaga/.test(combined)) {
    key = 'beef';
  } else if (/pork|baboy|sinigang|adobo|liempo|pork chop|chop|menudo/.test(combined)) {
    key = 'pork';
  } else if (/tofu|tokwa|vegetable|gulay|salad|munggo|monggo|sprouts|curry|beans|chickpea|pinakbet/.test(combined)) {
    key = 'tofu';
  }

  if (!key || !CANONICAL_FALLBACK_IMAGES[key]) return null;
  const match = CANONICAL_FALLBACK_IMAGES[key];
  return {
    url: match.url,
    altText: match.altText,
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: match.creator,
      sourcePageUrl: null,
      licenseCode: match.licenseCode,
      licenseUrl: match.licenseUrl,
      modifications: 'Resized, format-optimized, and cropped for display.',
    },
  };
}

export type MealImageProps = {
  image?: PublicMealImage | null;
  mealName: string;
  mealType?: MealType | string;
  className?: string;
  priority?: boolean;
  showAttributionLinks?: boolean;
  variant?: 'card' | 'detail' | 'compact' | 'hero' | 'thumbnail';
  ingredients?: { ingredientName: string; category?: string }[];
  allowCanonicalFallback?: boolean;
};

export default function MealImage({
  image,
  mealName,
  mealType,
  className = '',
  priority = false,
  showAttributionLinks = false,
  variant = 'card',
  ingredients = [],
  allowCanonicalFallback = true,
}: MealImageProps) {
  const [failed, setFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const effectiveImage =
    image ||
    (!failed && allowCanonicalFallback ? resolveCanonicalReviewedImage(mealName, mealType, ingredients) : null);
  const showFallback = !effectiveImage || failed;
  const categoryInfo = resolveMealCategory(mealName, mealType, ingredients);
  const FallbackIcon = categoryInfo.icon;

  if (showFallback) {
    if (variant === 'thumbnail') {
      return (
        <div
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br select-none ${categoryInfo.tone.bg} ${categoryInfo.tone.border} ${className}`}
          title={`${mealName} (${categoryInfo.label} visual placeholder)`}
          aria-label={`${mealName} (${categoryInfo.label} visual placeholder)`}
        >
          <FallbackIcon className={`h-6 w-6 ${categoryInfo.tone.text}`} aria-hidden="true" />
        </div>
      );
    }
    return (
      <figure
        className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 select-none ${categoryInfo.tone.bg} ${categoryInfo.tone.border} ${className}`}
        aria-label={`${mealName} (representative visual placeholder)`}
      >
        {/* Subtle decorative ambient glow */}
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-white/5 bg-white/[0.02] blur-sm"
          aria-hidden="true"
        />

        {/* Category tag & representative visual badge */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${categoryInfo.tone.badgeBg} ${categoryInfo.tone.badgeText}`}
          >
            <FallbackIcon className="h-3 w-3" aria-hidden="true" />
            <span>{categoryInfo.label}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-muted backdrop-blur-md border border-white/5">
            <span className={`h-1.5 w-1.5 rounded-full ${categoryInfo.tone.dot}`} aria-hidden="true" />
            Representative visual
          </span>
        </div>

        {/* Center: Category Icon & Title */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-2 text-center">
          <div
            className={`mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border bg-brand-surface/75 shadow-sm backdrop-blur-md ${categoryInfo.tone.border} ${categoryInfo.tone.text}`}
          >
            <FallbackIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="line-clamp-1 max-w-[90%] font-display text-xs font-black tracking-tight text-brand-text">
            {mealName}
          </span>
        </div>

        {/* Bottom honest disclosure footer */}
        <div className="relative z-10 text-center">
          <span className="text-[9px] font-medium text-brand-muted/75">
            Visual placeholder · Structured recipe in plan
          </span>
        </div>
      </figure>
    );
  }

  if (variant === 'thumbnail') {
    return (
      <div
        className={`relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#09110e] select-none ${className}`}
        aria-label={`${mealName} (${effectiveImage.kind === 'REPRESENTATIVE' ? 'representative photo' : 'photo'})`}
      >
        <Image
          src={effectiveImage.url}
          alt={effectiveImage.altText || `Photo representing ${mealName}`}
          fill
          sizes="64px"
          className={`object-cover motion-reduce:transition-none transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          priority={priority}
          onLoad={() => setIsLoaded(true)}
          onError={() => setFailed(true)}
        />
        {effectiveImage.kind === 'REPRESENTATIVE' && (
          <span
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-black"
            title="Representative image"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  const isCompact = variant === 'compact';

  return (
    <figure
      className={`relative overflow-hidden rounded-2xl border border-brand-border/60 bg-brand-surface/80 select-none ${className}`}
      aria-label={`${mealName} (${effectiveImage.kind === 'REPRESENTATIVE' ? 'representative photo' : 'photo'})`}
    >
      {/* Subtle loading skeleton placeholder */}
      <div
        className={`absolute inset-0 z-0 bg-brand-surface/90 motion-reduce:transition-none transition-opacity duration-300 ${
          isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'
        }`}
        aria-hidden="true"
      />

      <Image
        src={effectiveImage.url}
        alt={effectiveImage.altText || `Photo representing ${mealName}`}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={`object-cover motion-reduce:transition-none transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        priority={priority}
        onLoad={() => setIsLoaded(true)}
        onError={() => setFailed(true)}
      />

      {/* Visible Representative Photo Disclosure */}
      {effectiveImage.kind === 'REPRESENTATIVE' && (
        <figcaption className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur-md border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span>Representative image</span>
        </figcaption>
      )}

      {/* Compact Non-Interactive Attribution Pill (Safe inside clickable cards) */}
      {(effectiveImage.attribution.creator || effectiveImage.attribution.licenseCode) && (
        <figcaption
          className="absolute bottom-2.5 right-2.5 z-10 max-w-[62%] truncate rounded-full bg-black/75 px-2.5 py-1 text-[9px] font-medium text-white/90 shadow-md backdrop-blur-md border border-white/10"
          title={effectiveImage.attribution.modifications || undefined}
        >
          {[
            effectiveImage.attribution.creator,
            effectiveImage.attribution.licenseCode,
            effectiveImage.attribution.modifications && 'adapted',
          ]
            .filter(Boolean)
            .join(' · ')}
        </figcaption>
      )}

      {/* Accessible Interactive External Links (Only when showAttributionLinks is explicitly requested and NOT in compact mode) */}
      {!isCompact &&
        showAttributionLinks &&
        (effectiveImage.attribution.sourcePageUrl || effectiveImage.attribution.licenseUrl) && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-2 rounded-full bg-black/80 px-2.5 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur-md border border-white/10">
            {effectiveImage.attribution.sourcePageUrl && (
              <a
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 focus-visible:ring-offset-black rounded-sm"
                href={effectiveImage.attribution.sourcePageUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Source page for ${mealName} image (opens in new tab)`}
              >
                <span>Source</span>
                <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
              </a>
            )}
            {effectiveImage.attribution.licenseUrl && (
              <a
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 focus-visible:ring-offset-black rounded-sm"
                href={effectiveImage.attribution.licenseUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`License for ${mealName} image (opens in new tab)`}
              >
                <span>{effectiveImage.attribution.licenseCode || 'License'}</span>
                <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
    </figure>
  );
}
