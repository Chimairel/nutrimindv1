import type { RawRecipeImageRecord } from './meal-image.policy';

export type PublicMealCookingLink = {
  url: string;
  kind: 'PANLASANG_RECIPE' | 'SOURCE_VIDEO';
};

export function panlasangRecipePage(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' &&
      ['panlasangpinoy.com', 'www.panlasangpinoy.com'].includes(url.hostname.toLowerCase()) &&
      url.pathname !== '/'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function panlasangPageFromDescription(description: string | null | undefined): string | null {
  const source = description?.match(/(?:^|\n)\s*Source:\s*(https:\/\/[^\s<>"']+)/i)?.[1];
  return panlasangRecipePage(source);
}

function approvedYouTubeVideo(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || !['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') ||
      (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch {
    return null;
  }
}

export function cookingLinkForMeal(input: {
  libraryDescription?: string | null;
  sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
}): PublicMealCookingLink | null {
  const raw = input.sourceRawRecipeCandidate;
  const article = raw?.sourceName === 'PANLASANG_PINOY' ? panlasangRecipePage(raw.sourceUrl) : null;
  const page = article || panlasangPageFromDescription(input.libraryDescription);
  if (page) return { url: page, kind: 'PANLASANG_RECIPE' };

  const libraryVideo = input.libraryDescription?.match(/(?:^|\n)\s*Video:\s*(https:\/\/[^\s<>"']+)/i)?.[1];
  const video = approvedYouTubeVideo(raw?.sourceVideoUrl) || approvedYouTubeVideo(libraryVideo);
  return video ? { url: video, kind: 'SOURCE_VIDEO' } : null;
}
