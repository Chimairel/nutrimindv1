import prisma from '@/lib/prisma';
import { cookingLinkForMeal, panlasangPageFromDescription, type PublicMealCookingLink } from '@/domain/meal-cooking-link.policy';

type LibraryRecipeReference = { id: string; description: string | null };

/** Resolve recipe provenance for a bounded set of library rows, including drafts published from raw-corpus plans. */
export async function resolveLibraryRecipeCookingLinks(
  meals: readonly LibraryRecipeReference[]
): Promise<Map<string, PublicMealCookingLink>> {
  const links = new Map<string, PublicMealCookingLink>();
  const unresolved: string[] = [];
  for (const meal of meals) {
    const page = panlasangPageFromDescription(meal.description);
    if (page) links.set(meal.id, { url: page, kind: 'PANLASANG_RECIPE' });
    else unresolved.push(meal.id);
  }
  if (!unresolved.length) return links;

  const originPlans = await prisma.mealPlan.findMany({
    where: {
      libraryMealId: { in: unresolved },
      sourceRawRecipeCandidate: { is: { sourceName: 'PANLASANG_PINOY' } },
    },
    select: {
      libraryMealId: true,
      sourceRawRecipeCandidate: {
        select: { recipeName: true, sourceName: true, sourceUrl: true, sourceImageUrl: true, sourceVideoUrl: true },
      },
    },
    distinct: ['libraryMealId'],
    take: unresolved.length,
  });
  for (const plan of originPlans) {
    if (!plan.libraryMealId) continue;
    const link = cookingLinkForMeal({ sourceRawRecipeCandidate: plan.sourceRawRecipeCandidate });
    if (link) links.set(plan.libraryMealId, link);
  }
  for (const meal of meals) {
    if (links.has(meal.id)) continue;
    const link = cookingLinkForMeal({ libraryDescription: meal.description });
    if (link) links.set(meal.id, link);
  }
  return links;
}
