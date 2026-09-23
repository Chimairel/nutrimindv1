import { RecipeRiceRole } from '@prisma/client';

export interface RiceRoleProposal {
  riceRole: RecipeRiceRole;
  includedRiceG: number | null;
  reasonCode: 'EXPLICIT_RICE_INGREDIENT' | 'STANDALONE_CATEGORY' | 'ULAM_PAIRING_PROPOSAL';
}

/** Classifier proposal only. An RND review is required to mark the role reviewed. */
export function proposeRiceRole(input: {
  name: string;
  category?: string | null;
  ingredients: readonly { name: string; quantity?: number | null; unit?: string | null }[];
}): RiceRoleProposal {
  const riceIngredient = input.ingredients.find((ingredient) =>
    /\b(rice|kanin|malagkit|glutinous rice)\b/iu.test(ingredient.name.normalize('NFKC'))
  );
  if (riceIngredient) {
    const unit = riceIngredient.unit?.trim().toLowerCase();
    const includedRiceG =
      riceIngredient.quantity && riceIngredient.quantity > 0 && (unit === 'g' || unit === 'gram' || unit === 'grams')
        ? riceIngredient.quantity
        : null;
    return { riceRole: RecipeRiceRole.INCLUDES_RICE, includedRiceG, reasonCode: 'EXPLICIT_RICE_INGREDIENT' };
  }

  const text = `${input.name} ${input.category ?? ''}`.normalize('NFKC').toLowerCase();
  if (
    /\b(snack|merienda|dessert|cake|cookie|bread|drink|beverage|smoothie|shake|salad|sandwich|pasta|noodle)\b/u.test(
      text
    )
  ) {
    return { riceRole: RecipeRiceRole.STANDALONE, includedRiceG: null, reasonCode: 'STANDALONE_CATEGORY' };
  }
  return { riceRole: RecipeRiceRole.PAIR_WITH_RICE, includedRiceG: null, reasonCode: 'ULAM_PAIRING_PROPOSAL' };
}
