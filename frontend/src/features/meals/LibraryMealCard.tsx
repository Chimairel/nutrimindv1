import { useState } from 'react';
import type { PublicVerifier } from '@/types';
import type { SwapOption } from './useMealsWorkspace';
import MealImage from '@/components/user/MealImage';
import { Heart } from 'lucide-react';

export default function LibraryMealCard({
  meal,
  onVerifier,
  onFavorite,
}: {
  meal: SwapOption;
  onVerifier: (verifier: PublicVerifier) => void;
  onFavorite: (meal: SwapOption) => Promise<void>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const applicableMealTypes = meal.mealTypes?.length ? meal.mealTypes : [meal.mealType];
  return (
    <article className="flex flex-col gap-4 rounded-[22px] border border-brand-border bg-brand-surface p-5 shadow-sm">
      <MealImage
        image={meal.image}
        mealName={meal.mealName}
        mealType={meal.mealType}
        className="h-36 w-full"
        showAttributionLinks
      />
      <div className="flex justify-between text-xs font-bold text-brand-green">
        <span>{applicableMealTypes.join(' · ')}</span>
        <span>{meal.calories} kcal</span>
      </div>
      {(meal.alreadyPlannedInCycle || meal.matchesDietaryPreference === false) && (
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          {meal.alreadyPlannedInCycle && (
            <span className="rounded-full border border-brand-green/40 px-2 py-1 text-brand-green">In your plan</span>
          )}
          {meal.matchesDietaryPreference === false && (
            <span className="rounded-full border border-amber-500/40 px-2 py-1 text-amber-500">
              Outside your dietary preference
            </span>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-brand-text">{meal.mealName}</h3>
        <button
          type="button"
          aria-label={meal.isFavorite ? `Remove ${meal.mealName} from favorites` : `Favorite ${meal.mealName}`}
          aria-pressed={meal.isFavorite}
          onClick={() => onFavorite(meal)}
          className="rounded-full border border-brand-border p-2 text-brand-green hover:bg-brand-bgAlt"
        >
          <Heart className={`h-4 w-4 ${meal.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
      {meal.riceRole && (
        <p className="text-[11px] font-semibold text-brand-muted">
          {meal.riceRole === 'PAIR_WITH_RICE'
            ? 'Usually paired with rice'
            : meal.riceRole === 'INCLUDES_RICE'
              ? `Rice included${meal.includedRiceG ? ` · ${meal.includedRiceG} g` : ''}`
              : 'Standalone meal'}
        </p>
      )}
      {meal.description && <p className="text-xs text-brand-muted">{meal.description}</p>}
      <p className="text-xs text-brand-muted">
        Protein {meal.proteinG} g · Carbs {meal.carbsG} g · Fat {meal.fatG} g
      </p>
      <button
        type="button"
        aria-expanded={showDetails}
        onClick={() => setShowDetails((current) => !current)}
        className="text-left text-xs font-semibold text-brand-green underline"
      >
        {showDetails ? 'Hide details' : 'View details'}
      </button>
      {showDetails && (
        <div className="rounded-xl border border-brand-border bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
          <p>Serving: {meal.servingDescription || 'One recipe serving'}</p>
          <p>Suitable slots: {applicableMealTypes.join(', ').toLowerCase()}</p>
          <p>
            Per serving: {meal.calories} kcal · {meal.proteinG} g protein · {meal.carbsG} g carbs · {meal.fatG} g fat.
          </p>
        </div>
      )}
      {meal.cookingLink && (
        <a
          href={meal.cookingLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-brand-green underline"
        >
          {meal.cookingLink.kind === 'PANLASANG_RECIPE' ? 'View original Panlasang Pinoy recipe ↗' : 'Watch original cooking video ↗'}
        </a>
      )}
      <button
        type="button"
        disabled={!meal.verifier}
        onClick={() => meal.verifier && onVerifier(meal.verifier)}
        className="text-left text-xs text-brand-green underline"
      >
        Verified by {meal.verifiedBy} · PRC {meal.prcLicenseNumber}
      </button>
    </article>
  );
}
