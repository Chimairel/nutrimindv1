import { getIngredientEvidencePresentation, type IngredientEvidenceSource } from './ingredient-evidence';

interface IngredientEvidenceListProps {
  ingredients: Array<{
    name: string;
    source: IngredientEvidenceSource;
    fnriFoodName?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }>;
}

export default function IngredientEvidenceList({ ingredients }: IngredientEvidenceListProps) {
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2 text-[9px] font-semibold text-brand-muted">
        <span className="text-status-verified-text">● FNRI identity linked</span>
        <span className="text-sky-400">● Source recipe, unmatched</span>
        <span className="text-amber-500">● AI estimate</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ingredients.map((ingredient, index) => {
          const evidence = getIngredientEvidencePresentation(ingredient);
          return (
            <div
              key={`${ingredient.name}-${index}`}
              className={`flex items-center gap-1 rounded-lg border bg-brand-surface px-2.5 py-1 text-xs text-brand-muted ${evidence.borderClass}`}
            >
              <span>
                {ingredient.name}
                {ingredient.quantity != null
                  ? ` · ${ingredient.quantity} ${ingredient.unit || ''}`
                  : ' · Quantity unavailable'}
              </span>
              <span className="text-[9px]" title={evidence.title}>
                {evidence.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
