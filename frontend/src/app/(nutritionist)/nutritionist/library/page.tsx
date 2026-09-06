'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { BookOpen, Utensils, Stethoscope, ShieldAlert, Flag } from 'lucide-react';
import { normalizeExclusiveNone } from '@/lib/profile-normalization';

import {
  AVAILABLE_ALLERGENS,
  AVAILABLE_CONDITIONS,
  useNutritionistLibrary,
} from '@/features/nutritionist-library/useNutritionistLibrary';
import { NutritionistLibraryModals } from '@/features/nutritionist-library/NutritionistLibraryModals';

export default function MealLibraryPage() {
  const workspace = useNutritionistLibrary();
  const {
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    status,
    setStatus,
    verifiedByMe,
    setVerifiedByMe,
    setActiveModal,
    setSelectedMeal,
    setSelectedVerifier,
    setFlagReason,
    isOwner,
    handleOpenEdit,
    handleOpenCertification,
  } = workspace;

  return (
    <div className="portal-page space-y-6">
      {/* Header */}
      <PortalPageHeader
        icon={BookOpen}
        eyebrow="Meal intelligence"
        title="Verified meal library"
        description="Search, inspect, and maintain the reusable meal evidence available to compatible user plans."
        meta={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/50">
            {totalCount} records
          </span>
        }
      />

      {coverage && (
        <section aria-labelledby="coverage-heading" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
                Coverage monitor
              </p>
              <h2 id="coverage-heading" className="font-display text-lg font-black text-brand-text">
                Seven-day library readiness
              </h2>
            </div>
            <p className="text-xs text-brand-muted">
              {coverage.certifiedMeals} current certified meals · {coverage.requiredPerSlot} required per slot
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {coverage.profiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-brand-text">{profile.label}</p>
                    <p className="mt-1 text-[10px] text-brand-muted">Lowest slot: {profile.minimumPerSlot}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Week ready' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden border-brand-border/60 bg-brand-surface/65 p-0">
            <div className="border-b border-brand-border/60 px-4 py-3">
              <h3 className="text-sm font-extrabold text-brand-text">Combined restriction matrix</h3>
              <p className="mt-1 text-[11px] text-brand-muted">
                Each cell shows the lowest available main-meal slot. Hover or focus a cell for breakfast, lunch, and
                dinner counts.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-brand-bg/45">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-bg px-4 py-3 font-mono text-[9px] uppercase tracking-wider text-brand-muted"
                    >
                      Condition
                    </th>
                    {coverage.combinationColumns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-3 py-3 text-center text-[10px] font-extrabold text-brand-muted"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.combinationMatrix.map((row) => (
                    <tr key={row.key} className="border-t border-brand-border/50">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-surface px-4 py-3 text-xs font-extrabold text-brand-text"
                      >
                        {row.label}
                      </th>
                      {row.cells.map((cell) => {
                        const detail = `Breakfast ${cell.counts.BREAKFAST}, lunch ${cell.counts.LUNCH}, dinner ${cell.counts.DINNER}`;
                        return (
                          <td key={cell.key} className="px-2 py-2 text-center">
                            <span
                              tabIndex={0}
                              title={detail}
                              aria-label={`${row.label} and ${cell.label}: ${cell.minimumPerSlot} lowest-slot meals. ${detail}. ${cell.weekReady ? 'Week ready' : 'Coverage gap'}.`}
                              className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-xl border px-2 py-2 font-mono text-[10px] font-black outline-none transition focus:ring-2 focus:ring-brand-cyan/40 ${cell.weekReady ? 'border-brand-green/35 bg-brand-green/10 text-brand-green' : 'border-status-warning-text/35 bg-status-warning-bg/15 text-status-warning-text'}`}
                            >
                              {cell.minimumPerSlot}
                              <span aria-hidden="true">/7</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-3" aria-label="Structured combined profile coverage">
            {coverage.structuredProfiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-cyan">
                      Structured profile
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-brand-text">{profile.label}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Week ready' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Top Filter Panel */}
      <Card className="portal-filter-panel space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="md:col-span-2">
            <label htmlFor="library-search" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Search meal name
            </label>
            <div className="relative">
              <input
                id="library-search"
                name="search"
                type="text"
                placeholder="Search e.g. Tinola..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10 placeholder:text-brand-muted/60"
              />
              {searchVal && (
                <button
                  type="button"
                  aria-label="Clear meal search"
                  onClick={() => setSearchVal('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Meal Type */}
          <div>
            <label htmlFor="library-meal-type" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Meal Type
            </label>
            <select
              id="library-meal-type"
              value={mealType}
              onChange={(e) => {
                setMealType(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Types</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACK">Snack</option>
            </select>
          </div>

          {/* Condition Tag */}
          <div>
            <label htmlFor="library-condition" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Condition Tag
            </label>
            <select
              id="library-condition"
              value={conditionTag}
              onChange={(e) => {
                setConditionTag(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-sm text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Conditions</option>
              {AVAILABLE_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-brand-border/40">
          <div className="flex gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="library-status" className="text-xs font-bold text-brand-muted uppercase">
                Status:
              </label>
              <select
                id="library-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text focus:outline-none focus:border-brand-green/80"
              >
                <option value="All">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="FLAGGED">Flagged</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Owner filter */}
          <label htmlFor="library-verified-by-me" className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              id="library-verified-by-me"
              type="checkbox"
              checked={verifiedByMe}
              onChange={(e) => {
                setVerifiedByMe(e.target.checked);
                setPage(1);
              }}
              className="w-4.5 h-4.5 rounded border-brand-border text-brand-green focus:ring-brand-green bg-brand-bg"
            />
            <span className="text-xs font-bold text-brand-text">Show only meals verified by me</span>
          </label>
        </div>
      </Card>

      {fetchError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Main Meal Grid / Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <div className="w-8 h-8 border-2 border-brand-green/20 border-t-brand-green rounded-full animate-spin"></div>
          <span className="text-sm text-brand-muted">Fetching verified library meals...</span>
        </div>
      ) : meals.length === 0 ? (
        <Card className="p-16 text-center border-brand-border/40 bg-brand-surface/30 flex flex-col items-center">
          <Utensils className="w-12 h-12 text-brand-muted mb-4" />
          <h3 className="text-lg font-bold text-brand-text font-display">No Meals Found</h3>
          <p className="text-sm text-brand-muted mt-1 max-w-md mx-auto">
            Try adjusting your search query, selecting different filters, or checking back later.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meals.map((meal) => {
              const owned = isOwner(meal);
              const isFlagged = meal.status === 'FLAGGED';
              const isArchived = meal.status === 'ARCHIVED';
              const activeFlag = meal.flags?.[0];

              return (
                <Card
                  key={meal.id}
                  className={`relative p-5 border-brand-border/60 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-brand-border-hover hover:shadow-lg ${
                    isFlagged ? 'border-amber-900/60 bg-amber-950/5' : ''
                  }`}
                >
                  <div>
                    {/* Top tags & status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2.5 py-1 rounded-md tracking-wider uppercase font-display">
                        {meal.mealType}
                      </span>
                      <div className="flex gap-1.5">
                        {isFlagged ? (
                          <Badge variant="pending" showIcon>
                            Flagged
                          </Badge>
                        ) : isArchived ? (
                          <Badge variant="pending" showIcon>
                            Archived
                          </Badge>
                        ) : (
                          <Badge variant="verified" showIcon>
                            Approved
                          </Badge>
                        )}
                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                            meal.safetyEvidenceStatus === 'COMPLETE'
                              ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                              : meal.safetyEvidenceStatus === 'STALE'
                                ? 'border-amber-700/50 bg-amber-950/20 text-amber-300'
                                : 'border-brand-border/60 bg-brand-bg/60 text-brand-muted'
                          }`}
                        >
                          {meal.safetyEvidenceStatus === 'COMPLETE'
                            ? 'Evidence certified'
                            : meal.safetyEvidenceStatus === 'STALE'
                              ? 'Evidence stale'
                              : 'Evidence incomplete'}
                        </span>
                      </div>
                    </div>

                    {/* Meal details */}
                    <h3 className="text-base font-bold text-brand-text leading-snug">{meal.mealName}</h3>
                    {meal.description && (
                      <p className="text-xs text-brand-muted line-clamp-2 mt-1.5 leading-relaxed">{meal.description}</p>
                    )}

                    {/* Macros grid */}
                    <div className="grid grid-cols-4 gap-2 my-4 p-2.5 bg-brand-bg/60 rounded-xl border border-brand-border/30 text-center">
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Calories</span>
                        <span className="text-xs font-bold text-brand-text">{meal.calories} kcal</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Protein</span>
                        <span className="text-xs font-bold text-brand-text">{meal.proteinG}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Carbs</span>
                        <span className="text-xs font-bold text-brand-text">{meal.carbsG}g</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted uppercase font-bold">Fat</span>
                        <span className="text-xs font-bold text-brand-text">{meal.fatG}g</span>
                      </div>
                    </div>

                    {/* Suitability details */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {normalizeExclusiveNone(meal.suitableConditions).map((cond) => (
                        <span
                          key={cond}
                          className="text-[10px] bg-brand-border/30 text-brand-text px-2 py-0.5 rounded border border-brand-border/50 flex items-center gap-1"
                        >
                          <Stethoscope className="w-3 h-3 text-brand-green" />{' '}
                          {AVAILABLE_CONDITIONS.find((c) => c.value === cond)?.label || cond}
                        </span>
                      ))}
                      {normalizeExclusiveNone(meal.allergenFree).map((alg) => (
                        <span
                          key={alg}
                          className="text-[10px] bg-brand-border/30 text-brand-text px-2 py-0.5 rounded border border-brand-border/50 flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3 text-brand-green" />{' '}
                          {AVAILABLE_ALLERGENS.find((a) => a.value === alg)?.label || alg}
                        </span>
                      ))}
                    </div>

                    {/* Flag Alert Warning banner */}
                    {isFlagged && activeFlag && (
                      <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-xs text-amber-200/90 leading-relaxed mb-4">
                        <span className="font-bold flex items-center gap-1 mb-1">
                          <Flag className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Flagged for Re-Review:
                        </span>
                        &quot;{activeFlag.reason}&quot; —{' '}
                        <span className="font-semibold">{activeFlag.flaggedByNutritionist?.user?.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Verifier Badge & Actions footer */}
                  <div className="flex items-center justify-between border-t border-brand-border/40 pt-4 mt-2">
                    {/* Verifier credentials */}
                    <div className="text-[11px] text-brand-muted">
                      <span>Verifier: </span>
                      {meal.verifiedByNutritionist ? (
                        <button
                          onClick={() => {
                            setSelectedVerifier(meal.verifiedByNutritionist!);
                            setActiveModal('verifier');
                          }}
                          className="font-bold text-brand-green hover:underline cursor-pointer"
                        >
                          {meal.verifiedByNutritionist.user.name}
                        </button>
                      ) : (
                        <span className="italic">System / Unknown</span>
                      )}
                      <span className="block mt-0.5">Used {meal.usageCount}x</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedMeal(meal);
                          setActiveModal('view');
                        }}
                        className="!px-3 !py-1.5 !h-8 text-xs font-semibold"
                      >
                        View
                      </Button>

                      {!isFlagged && !isArchived && (
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenCertification(meal)}
                          className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-brand-green"
                        >
                          {meal.safetyEvidenceStatus === 'COMPLETE' ? 'Re-certify' : 'Review evidence'}
                        </Button>
                      )}

                      {owned && !isArchived ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenEdit(meal)}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-brand-green"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setActiveModal('delete');
                            }}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-red-900/60 hover:text-red-400"
                          >
                            Archive
                          </Button>
                        </>
                      ) : (
                        !isFlagged &&
                        !isArchived && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setFlagReason('');
                              setActiveModal('flag');
                            }}
                            className="!px-3 !py-1.5 !h-8 text-xs font-semibold hover:border-amber-900/60 hover:text-amber-400"
                          >
                            Flag
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-brand-border/40">
              <span className="text-xs text-brand-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="!px-3 !py-1.5 !h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="!px-3 !py-1.5 !h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODALS SECTION */}
      {/* ──────────────────────────────────────────────────────── */}

      <NutritionistLibraryModals workspace={workspace} />
    </div>
  );
}
