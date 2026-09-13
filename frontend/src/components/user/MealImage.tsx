'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { Apple, Coffee, Egg, ExternalLink, Fish, Flame, Salad, Soup, UtensilsCrossed } from 'lucide-react';
import type { MealType, PublicMealImage } from '@/types';
import { reviewedMealImages } from './reviewed-meal-images';

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
  // Use structured animal-protein categories before generic vegetable or egg words.
  // Ingredient names distinguish poultry within FNRI's combined Meat & Poultry category.
  const primary = (ingredients || []).filter((item) =>
    /^(meat & poultry|fish & shellfish|seafood|meat|poultry)$/i.test(item.category?.trim() || '')
  );
  const combined = primary.length
    ? primary
        .map(
          (item) =>
            `${item.ingredientName} ${/fish|shellfish|seafood/i.test(item.category || '') ? 'seafood' : /chicken|manok|poultry/i.test(item.ingredientName) ? 'chicken' : 'meat'}`
        )
        .join(' ')
        .toLowerCase()
    : /\b(beef|pork|chicken|manok|baboy|baka|tapa|bistek)\b/.test(name)
      ? name
      : `${name} ${ingText}`;

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
        bg: 'from-cyan-100 dark:from-cyan-950/40 via-brand-surface to-brand-cyan/15',
        border: 'border-cyan-500/25',
        text: 'text-cyan-700 dark:text-cyan-400',
        badgeBg: 'bg-cyan-500/15',
        badgeText: 'text-cyan-800 dark:text-cyan-300',
        dot: 'bg-cyan-400',
      },
    };
  }

  // Primary meat takes precedence over egg and vegetable accompaniments.
  if (/pork|baboy|beef|baka|liempo|bistek|tapa|meat|steak/.test(combined)) {
    return {
      category: 'meat',
      label: 'Meat & Savory',
      icon: Flame,
      tone: {
        bg: 'from-rose-100 dark:from-rose-950/40 via-brand-surface to-rose-500/15',
        border: 'border-rose-500/25',
        text: 'text-rose-700 dark:text-rose-400',
        badgeBg: 'bg-rose-500/15',
        badgeText: 'text-rose-800 dark:text-rose-300',
        dot: 'bg-rose-400',
      },
    };
  }

  // 3. Poultry & Egg
  if (/\b(eggs?|itlog|scrambled|omelet|omelette|chicken|manok|tinola|inasal)\b/.test(combined)) {
    return {
      category: 'poultry-egg',
      label: 'Poultry & Egg',
      icon: Egg,
      tone: {
        bg: 'from-amber-100 dark:from-amber-950/40 via-brand-surface to-amber-500/15',
        border: 'border-amber-500/25',
        text: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-800 dark:text-amber-300',
        dot: 'bg-amber-400',
      },
    };
  }

  // Vegetable imagery is not a dietary or allergen-safety certification.
  if (
    /tofu|tokwa|munggo|monggo|vegetable|gulay|pinakbet|kangkong|cabbage|sayote|eggplant|talong|salad|sitaw|pechay|kalabasa|mushroom|beans|ampalaya|chopsuey/.test(
      combined
    )
  ) {
    return {
      category: 'plant-based',
      label: 'Vegetables & Legumes',
      icon: Salad,
      tone: {
        bg: 'from-emerald-100 dark:from-emerald-950/40 via-brand-surface to-brand-green/15',
        border: 'border-brand-green/25',
        text: 'text-brand-green',
        badgeBg: 'bg-brand-green/15',
        badgeText: 'text-brand-green',
        dot: 'bg-brand-green',
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
        bg: 'from-emerald-100 dark:from-emerald-950/30 via-brand-surface to-emerald-500/15',
        border: 'border-emerald-500/25',
        text: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-800 dark:text-emerald-300',
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
        bg: 'from-amber-100 dark:from-amber-950/30 via-brand-surface to-brand-accent/15',
        border: 'border-brand-accent/25',
        text: 'text-brand-green',
        badgeBg: 'bg-brand-accent/15',
        badgeText: 'text-brand-green',
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
        bg: 'from-purple-100 dark:from-purple-950/40 via-brand-surface to-purple-500/15',
        border: 'border-purple-500/25',
        text: 'text-purple-700 dark:text-purple-400',
        badgeBg: 'bg-purple-500/15',
        badgeText: 'text-purple-800 dark:text-purple-300',
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

export function resolveCanonicalReviewedImage(mealName: string): PublicMealImage | null {
  return reviewedMealImages[mealName.trim().toLowerCase()] ?? null;
}

export const defaultMealTypePlaceholders: Record<string, PublicMealImage> = {
  BREAKFAST: {
    url: '/meals/placeholder-breakfast.jpg',
    altText: 'Appetizing Filipino breakfast plate with garlic fried rice, sunny-side egg, and sliced tomatoes',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: null,
      licenseCode: 'CC0',
      sourcePageUrl: null,
      licenseUrl: null,
      modifications: null,
    },
  },
  LUNCH: {
    url: '/meals/placeholder-lunch.jpg',
    altText: 'Appetizing Filipino chicken adobo lunch with steamed rice and sautéed greens',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: null,
      licenseCode: 'CC0',
      sourcePageUrl: null,
      licenseUrl: null,
      modifications: null,
    },
  },
  DINNER: {
    url: '/meals/placeholder-dinner.jpg',
    altText: 'Comforting Filipino sinigang tamarind soup dinner with tender meat and rice',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: null,
      licenseCode: 'CC0',
      sourcePageUrl: null,
      licenseUrl: null,
      modifications: null,
    },
  },
  SNACK: {
    url: '/meals/placeholder-snack.jpg',
    altText: 'Fresh Philippine golden mango, banana slices, and light snack plate',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: null,
      licenseCode: 'CC0',
      sourcePageUrl: null,
      licenseUrl: null,
      modifications: null,
    },
  },
};

export function resolveMealTypePlaceholder(
  mealType?: MealType | string,
  mealName?: string
): PublicMealImage {
  const normalized = (mealType || '').toUpperCase();
  if (normalized in defaultMealTypePlaceholders) {
    return defaultMealTypePlaceholders[normalized];
  }

  const name = (mealName || '').toLowerCase();
  if (/silog|pandesal|egg|oatmeal|breakfast|champorado|pancake|toast|waffle|bread/.test(name)) {
    return defaultMealTypePlaceholders.BREAKFAST;
  }
  if (/sinigang|soup|stew|nilaga|bulalo|dinner|sopas|mami/.test(name)) {
    return defaultMealTypePlaceholders.DINNER;
  }
  if (/snack|merienda|fruit|mango|banana|saba|shake/.test(name)) {
    return defaultMealTypePlaceholders.SNACK;
  }

  return defaultMealTypePlaceholders.LUNCH;
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
  allowMealTypePlaceholder?: boolean;
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
  allowMealTypePlaceholder = true,
}: MealImageProps) {
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  // 1. Specific image provided via props or reviewed canonical recipe match
  const primaryImage = image || (allowCanonicalFallback ? resolveCanonicalReviewedImage(mealName) : null);
  const primaryFailed = Boolean(primaryImage && failedUrls[primaryImage.url]);

  // 2. Real food placeholder image for BREAKFAST, LUNCH, DINNER, SNACK
  const placeholderCandidate = allowMealTypePlaceholder ? resolveMealTypePlaceholder(mealType, mealName) : null;
  const placeholderFailed = Boolean(placeholderCandidate && failedUrls[placeholderCandidate.url]);

  // Determine which image candidate to display
  const effectiveImage = !primaryFailed && primaryImage ? primaryImage : !placeholderFailed && placeholderCandidate ? placeholderCandidate : null;
  const showFallback = !effectiveImage;
  const isLoaded = Boolean(effectiveImage && loadedUrl === effectiveImage.url);
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
          <span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/5">
            <span className={`h-1.5 w-1.5 rounded-full ${categoryInfo.tone.dot}`} aria-hidden="true" />
            Illustration
          </span>
        </div>

        {/* Center: Category Icon & Title */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-2 text-center">
          <div
            className={`mb-2 flex h-16 w-16 items-center justify-center rounded-full border bg-brand-surface/75 shadow-sm backdrop-blur-md ${categoryInfo.tone.border} ${categoryInfo.tone.text}`}
          >
            <FallbackIcon className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        {/* Bottom honest disclosure footer */}
        <div className="relative z-10 text-center">
          <span className="text-[9px] font-medium text-brand-muted/75">Recipe photo coming soon</span>
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
          onLoad={() => setLoadedUrl(effectiveImage.url)}
          onError={() => setFailedUrls((prev) => ({ ...prev, [effectiveImage.url]: true }))}
        />
        {effectiveImage.kind === 'REPRESENTATIVE' && (
          <span
            className="absolute inset-x-0 bottom-0 bg-black/80 py-0.5 text-center text-[7px] font-semibold text-white"
            title="Representative image"
          >
            Representative
          </span>
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
          isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse motion-reduce:animate-none'
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
        onLoad={() => setLoadedUrl(effectiveImage.url)}
        onError={() => setFailedUrls((prev) => ({ ...prev, [effectiveImage.url]: true }))}
      />

      {/* Visible Representative Photo Disclosure */}
      {effectiveImage.kind === 'REPRESENTATIVE' && (
        <figcaption className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur-md border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span>Representative image</span>
        </figcaption>
      )}

      {/* Compact Non-Interactive Attribution Pill (Safe inside clickable cards) */}
      {(effectiveImage.attribution?.creator || effectiveImage.attribution?.licenseCode) && (
        <figcaption
          className="absolute top-2.5 left-2.5 z-10 max-w-[55%] truncate rounded-full bg-black/75 px-2.5 py-1 text-[9px] font-medium text-white/90 shadow-md backdrop-blur-md border border-white/10"
          title={effectiveImage.attribution?.modifications || undefined}
        >
          {[
            effectiveImage.attribution?.creator,
            effectiveImage.attribution?.licenseCode,
            effectiveImage.attribution?.modifications && 'adapted',
          ]
            .filter(Boolean)
            .join(' · ')}
        </figcaption>
      )}

      {/* Accessible Interactive External Links (Only when showAttributionLinks is explicitly requested and NOT in compact mode) */}
      {!isCompact &&
        showAttributionLinks &&
        (effectiveImage.attribution?.sourcePageUrl || effectiveImage.attribution?.licenseUrl) && (
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
