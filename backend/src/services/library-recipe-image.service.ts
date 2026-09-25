import prisma from '@/lib/prisma';
import { toPublicRawRecipeImage, type PublicMealImage } from '@/domain/meal-image.policy';
import legacyImages from '@/data/panlasang-legacy-images.json';

type LibraryRecipeReference = { id: string; mealName: string; description: string | null };

function panlasangSourcePage(description: string | null): string | null {
  const candidate = description?.match(/(?:^|\n)\s*Source:\s*(https:\/\/[^\s<>"']+)/i)?.[1];
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.hostname.toLowerCase() === 'panlasangpinoy.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Bounded, display-only lookup. A corpus match never grants safety clearance. */
export async function resolveLibraryRecipeImages(
  meals: readonly LibraryRecipeReference[]
): Promise<Map<string, PublicMealImage>> {
  const sourceByMeal = new Map<string, string>();
  const nameByMeal = new Map<string, string>();
  for (const meal of meals) {
    const sourceUrl = panlasangSourcePage(meal.description);
    if (sourceUrl) {
      sourceByMeal.set(meal.id, sourceUrl);
      nameByMeal.set(meal.id, meal.mealName);
    }
  }
  if (!sourceByMeal.size) return new Map();

  const recipes = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', sourceUrl: { in: [...new Set(sourceByMeal.values())] } },
    select: {
      recipeName: true,
      sourceName: true,
      sourceUrl: true,
      sourceImageUrl: true,
      sourceVideoUrl: true,
    },
  });
  const imageBySource = new Map(recipes.map((recipe) => [recipe.sourceUrl, toPublicRawRecipeImage(recipe)] as const));
  const result = new Map<string, PublicMealImage>();
  for (const [id, sourceUrl] of sourceByMeal) {
    const image =
      imageBySource.get(sourceUrl) ||
      toPublicRawRecipeImage({
        recipeName: nameByMeal.get(id) || 'Recipe',
        sourceName: 'PANLASANG_PINOY',
        sourceUrl,
        sourceImageUrl: (legacyImages as Record<string, string>)[sourceUrl] || null,
        sourceVideoUrl: null,
      });
    if (image) result.set(id, image);
  }
  return result;
}
