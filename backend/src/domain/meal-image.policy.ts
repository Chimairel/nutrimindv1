import type { MealImageKind } from '@prisma/client';

export type MealImageRecord = {
  mealName?: string | null;
  description?: string | null;
  sourceVideoUrl?: string | null;
  imagePublicId: string | null;
  imageVersion: string | null;
  imageFormat: string | null;
  imageKind: MealImageKind | null;
  imageAltText: string | null;
  imageCreator: string | null;
  imageSourcePageUrl: string | null;
  imageLicenseCode: string | null;
  imageLicenseUrl: string | null;
};

export type PublicMealImage = {
  url: string;
  altText: string;
  kind: MealImageKind;
  attribution: {
    creator: string | null;
    sourcePageUrl: string | null;
    licenseCode: string | null;
    licenseUrl: string | null;
    modifications: string | null;
  };
};

function parseYouTubeVideoId(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;
    if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      videoId = url.searchParams.get('v');
      if (!videoId) {
        const [kind, id] = url.pathname.split('/').filter(Boolean);
        if (kind === 'embed' || kind === 'shorts' || kind === 'live') videoId = id ?? null;
      }
    }
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

function videoUrlFromDescription(description?: string | null): string | null {
  const explicitVideoLine = description?.match(/(?:^|\n)\s*Video:\s*(https?:\/\/[^\s<>"']+)/i)?.[1];
  if (explicitVideoLine && parseYouTubeVideoId(explicitVideoLine)) return explicitVideoLine;
  const youtubeUrl = description?.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/i)?.[0];
  return youtubeUrl && parseYouTubeVideoId(youtubeUrl) ? youtubeUrl : null;
}

export function toPublicYouTubeThumbnail(input: {
  mealName?: string | null;
  description?: string | null;
  sourceVideoUrl?: string | null;
}): PublicMealImage | null {
  const sourceVideoUrl = input.sourceVideoUrl || videoUrlFromDescription(input.description);
  const videoId = sourceVideoUrl ? parseYouTubeVideoId(sourceVideoUrl) : null;
  if (!sourceVideoUrl || !videoId) return null;

  return {
    url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    altText: input.mealName ? `Recipe video thumbnail for ${input.mealName}` : 'Recipe video thumbnail',
    kind: 'EXACT',
    attribution: {
      creator: null,
      sourcePageUrl: sourceVideoUrl,
      licenseCode: null,
      licenseUrl: null,
      modifications: null,
    },
  };
}

export function toPublicMealImage(meal: MealImageRecord): PublicMealImage | null {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName && process.env.CLOUDINARY_URL) {
    try {
      cloudName = new URL(process.env.CLOUDINARY_URL).hostname;
    } catch {
      cloudName = undefined;
    }
  }
  if (cloudName && meal.imagePublicId && meal.imageVersion && meal.imageFormat && meal.imageKind && meal.imageAltText) {
    const publicId = meal.imagePublicId
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const format = encodeURIComponent(meal.imageFormat);
    const version = encodeURIComponent(meal.imageVersion);
    const cloud = encodeURIComponent(cloudName);

    return {
      url: `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,c_fill,g_auto,w_960,h_640/v${version}/${publicId}.${format}`,
      altText: meal.imageAltText,
      kind: meal.imageKind,
      attribution: {
        creator: meal.imageCreator,
        sourcePageUrl: meal.imageSourcePageUrl,
        licenseCode: meal.imageLicenseCode,
        licenseUrl: meal.imageLicenseUrl,
        modifications:
          meal.imageLicenseCode && !['OWNED', 'GENERATED'].includes(meal.imageLicenseCode)
            ? 'Resized, format-optimized, and cropped for display.'
            : null,
      },
    };
  }

  return toPublicYouTubeThumbnail(meal);
}
