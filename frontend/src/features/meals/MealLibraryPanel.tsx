'use client';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LibraryMealCard from './LibraryMealCard';
import { AlertTriangle, Heart, Search, Salad } from 'lucide-react';
import type { useMealsWorkspace } from './useMealsWorkspace';

export default function MealLibraryPanel({ workspace }: { workspace: ReturnType<typeof useMealsWorkspace> }) {
  const {
    handleLibrarySearchSubmit,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    isLibraryLoading,
    libraryError,
    libraryMeals,
    setSelectedVerifier,
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    loadMoreLibrary,
    toggleLibraryFavorite,
    libraryTotalCount,
  } = workspace;
  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row">
        <form onSubmit={handleLibrarySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search verified recipes</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green"
            />
          </label>
          <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
            Apply
          </Button>
        </form>
        <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-brand-bgAlt/60 p-1 select-none md:w-auto">
          {['All', 'BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
            <button
              key={type}
              onClick={() => setLibraryMealType(type)}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                libraryMealType === type
                  ? 'border-brand-green bg-brand-green text-white dark:border-brand-accent dark:bg-brand-accent dark:text-black shadow-sm'
                  : 'border-transparent text-brand-muted hover:bg-brand-surface hover:text-brand-text'
              }`}
            >
              {type === 'All' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setLibraryFavoriteOnly(!libraryFavoriteOnly)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-bold ${
            libraryFavoriteOnly
              ? 'border-brand-green bg-brand-green text-black'
              : 'border-brand-border text-brand-muted'
          }`}
        >
          <Heart className={`h-4 w-4 ${libraryFavoriteOnly ? 'fill-current' : ''}`} /> Favorites
        </button>
        <label className="flex items-center gap-2 font-semibold text-brand-muted">
          Rice role
          <select
            value={libraryRiceRole}
            onChange={(event) => setLibraryRiceRole(event.target.value)}
            className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text"
          >
            <option value="All">All reviewed roles</option>
            <option value="PAIR_WITH_RICE">Pair with rice</option>
            <option value="STANDALONE">Standalone</option>
            <option value="INCLUDES_RICE">Includes rice</option>
          </select>
        </label>
        {libraryTotalCount !== null && (
          <span className="ml-auto text-brand-muted">{libraryTotalCount} eligible meals</span>
        )}
      </div>

      {isLibraryLoading ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <LoadingSpinner size="md" />
          <span className="text-xs text-brand-muted">Loading recipes...</span>
        </div>
      ) : libraryError ? (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{libraryError}</span>
        </div>
      ) : libraryMeals.length === 0 ? (
        <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
          <Salad className="w-8 h-8 text-brand-green mx-auto mb-2" />
          <p className="text-sm text-brand-text font-semibold">No Recipes Found</p>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
            No verified meals of this type match your health profile right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {libraryMeals.map((meal) => (
            <LibraryMealCard
              key={meal.id}
              meal={meal}
              onVerifier={setSelectedVerifier}
              onFavorite={toggleLibraryFavorite}
            />
          ))}
        </div>
      )}
      {libraryNextCursor && !isLibraryLoading && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMoreLibrary}>
            Load more recipes
          </Button>
        </div>
      )}
    </div>
  );
}
