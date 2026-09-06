import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { AlertTriangle, ShieldCheck, Utensils } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import { useMealsWorkspace } from './useMealsWorkspace';

type Props = { workspace: ReturnType<typeof useMealsWorkspace> };

export function MealsWorkspaceModals({ workspace }: Props) {
  const {
    activeSwapMeal,
    setActiveSwapMeal,
    swapOptions,
    setSwapOptions,
    isOptionsLoading,
    swapOptionsError,
    setSwapOptionsError,
    confirmSwapMeal,
    setConfirmSwapMeal,
    isSwapping,
    swapPreview,
    setSwapPreview,
    isCheckingPreview,
    previewError,
    selectedVerifier,
    setSelectedVerifier,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
  } = workspace;

  return (
    <>
      {selectedVerifier && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVerifier(null)}
          title={selectedVerifier.name}
          description="Nutritionist who reviewed and certified this reusable meal."
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4">
              <div className="flex items-center gap-2 text-brand-green">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-display text-sm font-extrabold">Verified nutritionist-dietitian</span>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-brand-muted">PRC license</dt>
                  <dd className="mt-1 font-mono font-bold text-brand-text">{selectedVerifier.prcLicenseNumber}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Valid until</dt>
                  <dd className="mt-1 font-bold text-brand-text">
                    {new Date(selectedVerifier.prcLicenseExpiry).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Specialization</dt>
                  <dd className="mt-1 font-bold text-brand-text">
                    {selectedVerifier.specialization || 'General nutrition'}
                  </dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Experience</dt>
                  <dd className="mt-1 font-bold text-brand-text">{selectedVerifier.yearsOfExperience ?? 0} years</dd>
                </div>
              </dl>
            </div>
            {selectedVerifier.university && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">Education</p>
                <p className="mt-1 font-semibold text-brand-text">{selectedVerifier.university}</p>
              </div>
            )}
            {selectedVerifier.bio && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
                  Professional profile
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-muted">{selectedVerifier.bio}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Swap Options Modal */}
      {activeSwapMeal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapOptionsError(null);
            setSwapPreview(null);
          }}
          title={`Swap ${activeSwapMeal.mealName}`}
          size="lg"
        >
          <div className="space-y-4 text-left">
            <p className="text-xs text-brand-muted leading-relaxed">
              Choose a verified alternative for{' '}
              <span className="font-bold text-brand-text">{activeSwapMeal.mealType}</span> on{' '}
              <span className="font-bold text-brand-text">
                {formatManilaDate(activeSwapMeal.scheduledDate, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              .
            </p>

            {isOptionsLoading ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <LoadingSpinner size="md" />
                <span className="text-xs text-brand-muted">Finding profile-matched verified meals...</span>
              </div>
            ) : swapOptionsError ? (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {swapOptionsError}
              </div>
            ) : swapOptions.length === 0 ? (
              <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
                <Utensils className="w-8 h-8 text-brand-green mx-auto mb-2" />
                <p className="text-sm text-brand-text font-semibold">No Alternative Meals Found</p>
                <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                  No alternative verified meals match your profile for this meal type right now.
                </p>
              </div>
            ) : confirmSwapMeal ? (
              /* Confirmation / Warning Screen */
              <div className="space-y-4">
                {isCheckingPreview ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <LoadingSpinner size="md" />
                    <span className="text-xs text-brand-muted font-semibold">
                      Calculating daily calorie projection...
                    </span>
                  </div>
                ) : previewError ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                    {previewError}
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmSwapMeal(null);
                          setSwapPreview(null);
                        }}
                        className="text-xs"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                ) : swapPreview && swapPreview.warningRequired ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <h4 className="text-sm font-bold text-amber-500 font-display uppercase tracking-tight">
                          Calorie Limit Warning
                        </h4>
                      </div>
                      <p className="text-xs text-brand-text leading-relaxed font-sans">
                        This swap puts you at{' '}
                        <span className="font-extrabold text-amber-500">{swapPreview.projectedDayTotal} kcal</span> for
                        this day (
                        <span className="font-bold">
                          {swapPreview.calorieDelta >= 0
                            ? `+${Math.round(swapPreview.calorieDelta)}`
                            : Math.round(swapPreview.calorieDelta)}{' '}
                          kcal
                        </span>{' '}
                        from your <span className="font-semibold">{swapPreview.dailyTarget} kcal</span> target).
                      </p>
                      <p className="text-[11px] text-brand-muted mt-2 font-sans">
                        This exceeds the recommended ±15% daily calorie target safety window. Do you want to proceed
                        with the swap anyway?
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmSwapMeal(null);
                          setSwapPreview(null);
                        }}
                        disabled={isSwapping}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmSwapAnyway}
                        disabled={isSwapping}
                        className="text-xs font-bold bg-amber-500 hover:bg-amber-600 border-amber-500/20 text-white"
                      >
                        {isSwapping ? 'Swapping...' : 'Swap Anyway'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Swap Choices List */
              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                {swapOptions.map((option) => (
                  <div
                    key={option.id}
                    className="p-4 bg-brand-surface/50 border border-brand-border rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-brand-border-hover transition-colors"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-brand-text leading-snug">{option.mealName}</h4>
                      {option.description && (
                        <p className="text-xs text-brand-muted line-clamp-1">{option.description}</p>
                      )}

                      {/* Macros badges */}
                      <div className="flex gap-2 pt-1">
                        <span className="text-[10px] font-bold text-brand-green">{option.calories} kcal</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-protein)' }}>
                          {option.proteinG}g P
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-carbs)' }}>
                          {option.carbsG}g C
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-fat)' }}>
                          {option.fatG}g F
                        </span>
                      </div>

                      {/* Verifier Badge */}
                      <div className="text-[10px] text-brand-muted pt-1">
                        Verified by: <span className="text-brand-green font-bold">{option.verifiedBy}</span> (PRC:{' '}
                        {option.prcLicenseNumber})
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => handleSelectSwapOption(option)}
                      className="text-xs font-semibold py-1.5 h-8 border-brand-border hover:border-brand-green/45 self-start md:self-center"
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
