export interface MealCookingLink {
  url: string;
  kind: 'PANLASANG_RECIPE' | 'SOURCE_VIDEO';
}

export function cookingAction(mealName: string, directLink?: MealCookingLink | null) {
  if (directLink?.kind === 'PANLASANG_RECIPE') {
    return {
      href: directLink.url,
      label: 'View Recipe',
      description: 'Open the original Panlasang Pinoy recipe and cooking instructions.',
    };
  }
  if (directLink?.kind === 'SOURCE_VIDEO') {
    return {
      href: directLink.url,
      label: 'Watch Video',
      description: 'Watch the cooking video linked to this recipe.',
    };
  }
  return {
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to cook ${mealName}`)}`,
    label: 'Find Tutorial',
    description: 'Find cooking tutorials for this dish on YouTube.',
  };
}
