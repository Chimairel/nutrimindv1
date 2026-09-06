import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Stethoscope, ShieldAlert, Salad } from 'lucide-react';
import { normalizeExclusiveNone } from '@/lib/profile-normalization';
import {
  AVAILABLE_ALLERGENS,
  AVAILABLE_CONDITIONS,
  AVAILABLE_DIETS,
  useNutritionistLibrary,
} from './useNutritionistLibrary';

type Props = { workspace: ReturnType<typeof useNutritionistLibrary> };

export function NutritionistLibraryModals({ workspace }: Props) {
  const {
    activeModal,
    setActiveModal,
    selectedMeal,
    selectedVerifier,
    editForm,
    setEditForm,
    flagReason,
    setFlagReason,
    evidenceForm,
    setEvidenceForm,
    actionLoading,
    actionError,
    handleCertificationSubmit,
    handleEditSubmit,
    handleDeleteSubmit,
    handleFlagSubmit,
    handleResolveFlag,
    handleToggleDiet,
    toggleEvidenceCondition,
    setEvidenceAllergen,
  } = workspace;

  return (
    <>
      {/* View Meal Details Modal */}
      {selectedMeal && activeModal === 'view' && (
        <Modal isOpen={true} onClose={() => setActiveModal(null)} title={selectedMeal.mealName} size="lg">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Description</span>
              <p className="text-sm text-brand-text leading-relaxed mt-1">
                {selectedMeal.description || 'No description available.'}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Macronutrients & Portions</span>
              <div className="grid grid-cols-4 gap-4 mt-2 p-3 bg-brand-surface rounded-xl border border-brand-border text-center">
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Calories</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.calories} kcal</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Protein</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.proteinG} g</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Carbs</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.carbsG} g</span>
                </div>
                <div>
                  <span className="block text-[10px] text-brand-muted uppercase font-bold">Fat</span>
                  <span className="text-sm font-bold text-brand-text">{selectedMeal.fatG} g</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Pre-Verified Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {normalizeExclusiveNone(selectedMeal.suitableConditions).map((cond) => (
                  <Badge key={cond} variant="verified" className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" />{' '}
                    {AVAILABLE_CONDITIONS.find((c) => c.value === cond)?.label || cond}
                  </Badge>
                ))}
                {normalizeExclusiveNone(selectedMeal.allergenFree).map((alg) => (
                  <Badge key={alg} variant="user" className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> {AVAILABLE_ALLERGENS.find((a) => a.value === alg)?.label || alg}
                  </Badge>
                ))}
                {selectedMeal.dietaryTags &&
                  (selectedMeal.dietaryTags as string[]).map((tag) => (
                    <Badge key={tag} variant="ai" className="flex items-center gap-1">
                      <Salad className="w-3 h-3" /> {AVAILABLE_DIETS.find((d) => d.value === tag)?.label || tag}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-brand-muted">Reusable evidence</span>
                <span className="text-xs font-bold text-brand-text">
                  {selectedMeal.safetyEvidenceStatus} · revision {selectedMeal.safetyEvidenceRevision}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                {selectedMeal.safetyEvidenceStatus === 'COMPLETE'
                  ? `Certified for deterministic library matching by ${selectedMeal.safetyReviewedByNutritionist?.user.name || 'qualified staff'}. User-specific restrictions are still checked every time.`
                  : selectedMeal.safetyEvidenceStatus === 'STALE'
                    ? `Re-review required${selectedMeal.safetyInvalidationReason ? `: ${selectedMeal.safetyInvalidationReason.replaceAll('_', ' ').toLowerCase()}` : ''}.`
                    : 'This meal is approved for its original user, but its reusable evidence has not yet been certified.'}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Stable ingredient evidence</span>
              <div className="mt-2 space-y-2">
                {(selectedMeal.ingredients || []).length === 0 ? (
                  <p className="rounded-xl border border-amber-800/40 bg-amber-950/15 p-3 text-xs text-amber-300">
                    No library-owned ingredient snapshot is available. This legacy entry cannot be certified
                    automatically.
                  </p>
                ) : (
                  (selectedMeal.ingredients || []).map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="flex items-center justify-between rounded-xl border border-brand-border/50 bg-brand-surface/50 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-brand-text">{ingredient.ingredientName}</span>
                      <span
                        className={
                          ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                            ? 'text-brand-green'
                            : 'text-amber-300'
                        }
                      >
                        {ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                          ? 'FNRI linked'
                          : 'Unresolved evidence'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedMeal.verifiedByNutritionist && (
              <div className="p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                <span className="text-xs font-bold text-brand-muted uppercase block mb-1">Signed & Verified By</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-brand-text">{selectedMeal.verifiedByNutritionist.user.name}</span>
                  <span className="text-brand-muted">
                    PRC License: {selectedMeal.verifiedByNutritionist.prcLicenseNumber}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Verifier Profile Modal */}
      {selectedVerifier && activeModal === 'verifier' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={`${selectedVerifier.user.name} Profile`}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block font-bold text-brand-muted uppercase">PRC License</span>
                <span className="text-brand-text font-semibold">{selectedVerifier.prcLicenseNumber}</span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">License Expiry</span>
                <span className="text-brand-text font-semibold">
                  {new Date(selectedVerifier.prcLicenseExpiry).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">Specialization</span>
                <span className="text-brand-text font-semibold">
                  {selectedVerifier.specialization || 'General Nutrition'}
                </span>
              </div>
              <div>
                <span className="block font-bold text-brand-muted uppercase">Experience</span>
                <span className="text-brand-text font-semibold">{selectedVerifier.yearsOfExperience || 0} years</span>
              </div>
            </div>

            {selectedVerifier.university && (
              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase">University</span>
                <span className="text-sm text-brand-text font-semibold">{selectedVerifier.university}</span>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-brand-muted uppercase">Biography</span>
              <p className="text-sm text-brand-text leading-relaxed mt-1">
                {selectedVerifier.bio || 'No biography written.'}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Independent reusable-evidence certification */}
      {selectedMeal && activeModal === 'certify' && (
        <Modal isOpen={true} onClose={() => setActiveModal(null)} title="Review reusable meal evidence" size="lg">
          <form onSubmit={handleCertificationSubmit} className="space-y-5">
            {actionError && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-400">
                {actionError}
              </div>
            )}

            <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4 text-xs leading-relaxed text-brand-muted">
              This review applies only to revision{' '}
              <strong className="text-brand-text">{selectedMeal.safetyEvidenceRevision}</strong> of{' '}
              <strong className="text-brand-text">{selectedMeal.mealName}</strong>. It does not label the meal
              universally safe. NutriMind will still compare each user&apos;s current restrictions before reuse.
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-brand-muted">Library-owned ingredients</span>
                <span className="text-[10px] font-bold uppercase text-brand-muted">
                  {(selectedMeal.ingredients || []).length} recorded
                </span>
              </div>
              <div className="space-y-2">
                {(selectedMeal.ingredients || []).length === 0 ? (
                  <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-300">
                    This legacy meal has no stable ingredient snapshot and cannot be certified. Recreate it through a
                    reviewed meal plan first.
                  </div>
                ) : (
                  (selectedMeal.ingredients || []).map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bg/60 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-brand-text">{ingredient.ingredientName}</span>
                      <span
                        className={
                          ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                            ? 'text-brand-green'
                            : 'text-amber-300'
                        }
                      >
                        {ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                          ? 'FNRI linked'
                          : 'Blocks certification'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-brand-muted">Condition review scope</span>
              <p className="mb-3 text-[11px] leading-relaxed text-brand-muted">
                Record only conditions you explicitly considered. Current complete diabetes and hypertension
                declarations may authorize reusable matching; heart, kidney, pregnancy, custom, and incomplete cases
                remain individually review-gated.
              </p>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3 sm:grid-cols-2">
                {AVAILABLE_CONDITIONS.map((condition) => (
                  <label
                    key={condition.value}
                    className="flex cursor-pointer items-center gap-2 text-xs text-brand-text"
                  >
                    <input
                      type="checkbox"
                      checked={evidenceForm.suitableConditions.includes(condition.value)}
                      onChange={() => toggleEvidenceCondition(condition.value)}
                      className="rounded border-brand-border bg-brand-bg text-brand-green focus:ring-brand-green"
                    />
                    {condition.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-brand-muted">Allergen declarations</span>
              <p className="mb-3 text-[11px] leading-relaxed text-brand-muted">
                Choose Present, Reviewed absent, or Not declared for every canonical allergen. Reviewed absent describes
                this evidence review only; it is not laboratory or manufacturing certification.
              </p>
              <div className="space-y-2">
                {AVAILABLE_ALLERGENS.map((allergen) => {
                  const mode = evidenceForm.allergensPresent.includes(allergen.value)
                    ? 'present'
                    : evidenceForm.allergensReviewedAbsent.includes(allergen.value)
                      ? 'absent'
                      : 'clear';
                  return (
                    <div
                      key={allergen.value}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-brand-border/60 bg-brand-bg/60 px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-brand-text">{allergen.label}</span>
                      <select
                        value={mode}
                        onChange={(event) =>
                          setEvidenceAllergen(allergen.value, event.target.value as 'present' | 'absent' | 'clear')
                        }
                        className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-green"
                      >
                        <option value="clear">Not declared</option>
                        <option value="present">Present</option>
                        <option value="absent">Reviewed absent</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border/60 bg-brand-surface/60 p-4">
              <input
                type="checkbox"
                checked={evidenceForm.crossContactAcknowledged}
                onChange={(event) =>
                  setEvidenceForm((current) => ({ ...current, crossContactAcknowledged: event.target.checked }))
                }
                className="mt-0.5 rounded border-brand-border bg-brand-bg text-brand-green focus:ring-brand-green"
              />
              <span className="text-xs leading-relaxed text-brand-muted">
                I assessed the documented preparation information and found no known cross-contact risk in the evidence
                reviewed. This is not a guarantee about every kitchen or manufacturer.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-brand-border pt-4">
              <Button variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  actionLoading ||
                  !evidenceForm.crossContactAcknowledged ||
                  (selectedMeal.ingredients || []).length === 0 ||
                  (selectedMeal.ingredients || []).some(
                    (ingredient) => ingredient.dataSource !== 'FNRI' || !ingredient.foodItemId
                  )
                }
              >
                {actionLoading ? 'Certifying...' : 'Certify this revision'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit / Resolve Meal Modal */}
      {selectedMeal && activeModal === 'edit' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={selectedMeal.status === 'FLAGGED' ? 'Resolve Flag: Edit Meal Details' : 'Edit Library Meal Details'}
          size="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <Input
              label="Meal Name"
              type="text"
              required
              value={editForm.mealName}
              onChange={(e) => setEditForm((prev) => ({ ...prev, mealName: e.target.value }))}
            />

            <div>
              <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Description</label>
              <textarea
                required
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:outline-none focus:border-brand-green/80"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Input
                label="Calories (kcal)"
                type="number"
                required
                value={editForm.calories}
                onChange={(e) => setEditForm((prev) => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
              />
              <Input
                label="Protein (g)"
                type="number"
                required
                value={editForm.proteinG}
                onChange={(e) => setEditForm((prev) => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label="Carbs (g)"
                type="number"
                required
                value={editForm.carbsG}
                onChange={(e) => setEditForm((prev) => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label="Fat (g)"
                type="number"
                required
                value={editForm.fatG}
                onChange={(e) => setEditForm((prev) => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Checkboxes lists */}
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3 text-[11px] leading-relaxed text-brand-muted">
                Condition and allergen declarations are controlled in{' '}
                <strong className="text-brand-text">Review evidence</strong>. Editing meal content invalidates any
                current certification and never silently changes clinical declarations.
              </div>

              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Dietary & Goal Tags</span>
                <div className="grid grid-cols-2 gap-2 p-3 bg-brand-bg rounded-xl border border-brand-border/60">
                  {AVAILABLE_DIETS.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 cursor-pointer text-xs text-brand-text">
                      <input
                        type="checkbox"
                        checked={editForm.dietaryTags.includes(d.value)}
                        onChange={() => handleToggleDiet(d.value)}
                        className="rounded text-brand-green bg-brand-bg border-brand-border focus:ring-brand-green"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Resolve or edit actions footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>

              {selectedMeal.status === 'FLAGGED' ? (
                <>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => handleResolveFlag('dismiss')}
                    disabled={actionLoading}
                    className="hover:border-brand-green hover:text-brand-green"
                  >
                    Dismiss Flag
                  </Button>
                  <Button type="button" onClick={() => handleResolveFlag('edit')} disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Resolve: Keep with Edits'}
                  </Button>
                </>
              ) : (
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Resolve Delete Modal */}
      {selectedMeal && activeModal === 'delete' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          title={selectedMeal.status === 'FLAGGED' ? 'Resolve Flag: Archive Meal' : 'Archive Library Meal'}
          size="md"
        >
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <p className="text-sm text-brand-muted leading-relaxed">
              Archive <span className="font-bold text-brand-text">&quot;{selectedMeal.mealName}&quot;</span>? It will
              immediately stop appearing in user matching while its review history remains available for audit.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button variant="secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={selectedMeal.status === 'FLAGGED' ? () => handleResolveFlag('delete') : handleDeleteSubmit}
                disabled={actionLoading}
                className="bg-red-900 hover:bg-red-800 text-brand-text border-transparent"
              >
                {actionLoading
                  ? 'Archiving...'
                  : selectedMeal.status === 'FLAGGED'
                    ? 'Resolve: Archive Meal'
                    : 'Archive Meal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Flag Modal */}
      {selectedMeal && activeModal === 'flag' && (
        <Modal isOpen={true} onClose={() => setActiveModal(null)} title="Flag Meal for Re-Review" size="md">
          <form onSubmit={handleFlagSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            <p className="text-xs text-brand-muted leading-relaxed">
              Submit a flag to alert the original verifying nutritionist (
              <span className="font-bold">{selectedMeal.verifiedByNutritionist?.user.name}</span>) of clinical
              inaccuracies. Flagged meals will be immediately hidden from matching algorithms for new user plans.
            </p>

            <div>
              <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Reason for flag</label>
              <textarea
                required
                rows={4}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Describe why you disagree with this verified meal (e.g. nutrition value is wrong, suitable conditions tags, unsafe ingredients for clinical tag, etc.)."
                className="w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-sm text-brand-text placeholder-brand-muted/70 focus:outline-none focus:border-brand-green/80"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
              <Button variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading || !flagReason.trim()}>
                {actionLoading ? 'Flagging...' : 'Submit Flag'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
