import type { MealImageKind } from '@prisma/client';

export type MealImageRecord = {
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

export function toPublicMealImage(meal: MealImageRecord): PublicMealImage | null {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName && process.env.CLOUDINARY_URL) {
    try {
      cloudName = new URL(process.env.CLOUDINARY_URL).hostname;
    } catch {
      cloudName = undefined;
    }
  }
  if (
    !cloudName ||
    !meal.imagePublicId ||
    !meal.imageVersion ||
    !meal.imageFormat ||
    !meal.imageKind ||
    !meal.imageAltText
  ) {
    return null;
  }

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
