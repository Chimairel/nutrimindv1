import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { Stethoscope, ShieldAlert, Salad } from 'lucide-react';
import { useState } from 'react';
import api from '@/lib/axios';
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
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-brand-text">
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
              {selectedMeal.nutritionServingDescription && (
                <p className="mt-2 text-xs text-brand-muted">Per serving: {selectedMeal.nutritionServingDescription}</p>
              )}
              {selectedMeal.safetyReviews?.[0]?.evidenceSnapshot?.nutritionBasis && (
                <p className="mt-2 rounded-xl border border-brand-border/60 p-3 text-xs text-brand-muted">
                  Admin-entered calculation/source notes:{' '}
                  {selectedMeal.safetyReviews[0].evidenceSnapshot.nutritionBasis}
                </p>
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-brand-muted uppercase">Classification proposals</span>
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
                <span className="text-xs font-bold uppercase text-brand-muted">Base recipe evidence</span>
                <span className="text-xs font-bold text-brand-text">
                  {selectedMeal.safetyEvidenceStatus} · revision {selectedMeal.safetyEvidenceRevision}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                {selectedMeal.safetyEvidenceStatus === 'COMPLETE'
                  ? 'Ingredient and nutrition provenance is complete for this revision. Condition and allergen coverage are checked independently for each user.'
                  : selectedMeal.safetyEvidenceStatus === 'STALE'
                    ? `Base evidence must be refreshed${selectedMeal.safetyInvalidationReason ? `: ${selectedMeal.safetyInvalidationReason.replaceAll('_', ' ').toLowerCase()}` : ''}.`
                    : 'This meal does not yet have complete base ingredient and nutrition evidence.'}
              </p>
            </div>

            {selectedMeal.safetyEvidenceStatus === 'COMPLETE' && <ConditionClearancePanel mealId={selectedMeal.id} />}

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
                      <span className="font-semibold text-brand-text">
                        {ingredient.ingredientName}
                        {ingredient.quantity != null
                          ? ` · ${ingredient.quantity} ${ingredient.unit ?? ''} per serving`
                          : ''}
                      </span>
                      <span
                        className={
                          ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                            ? 'text-brand-green'
                            : 'text-amber-300'
                        }
                      >
                        {ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                          ? 'FNRI linked'
                          : ingredient.dataSource === 'USDA_FDC' && ingredient.foodItemId
                            ? 'USDA composition linked; certification pending'
                            : ingredient.foodItemId
                              ? `${ingredient.foodItemId.startsWith('USDA_FDC_') ? 'USDA' : 'FNRI'} name matched; nutrition evidence pending`
                              : 'Composition identity unresolved'}
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
        <NutritionistCredentialModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          verifier={{
            name: selectedVerifier.user.name,
            image: selectedVerifier.user.image,
            officialHeadshot: selectedVerifier.officialHeadshot,
            digitalSignature: selectedVerifier.digitalSignature,
            prcLicenseNumber: selectedVerifier.prcLicenseNumber,
            prcLicenseExpiry: selectedVerifier.prcLicenseExpiry,
            specialization: selectedVerifier.specialization,
            yearsOfExperience: selectedVerifier.yearsOfExperience,
            university: selectedVerifier.university,
            bio: selectedVerifier.bio,
          }}
        />
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
              universally safe. KAINARA will still compare each user&apos;s current restrictions before reuse.
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-4 text-xs leading-relaxed text-brand-muted">
              <p className="font-bold text-brand-text">Recipe and nutrition submitted for review</p>
              <p className="mt-2 whitespace-pre-line">
                {selectedMeal.description || 'No preparation details recorded.'}
              </p>
              <p className="mt-2">
                {selectedMeal.nutritionServingDescription || 'Serving unspecified'} · {selectedMeal.calories} kcal · P{' '}
                {selectedMeal.proteinG} g · C {selectedMeal.carbsG} g · F {selectedMeal.fatG} g
              </p>
              <p className="mt-1">
                Sodium {selectedMeal.sodiumMg ?? 'unknown'} mg · Sugar {selectedMeal.sugarG ?? 'unknown'} g · Fiber{' '}
                {selectedMeal.fiberG ?? 'unknown'} g · Potassium {selectedMeal.potassiumMg ?? 'unknown'} mg · Phosphorus{' '}
                {selectedMeal.phosphorusMg ?? 'unknown'} mg · Saturated fat {selectedMeal.saturatedFatG ?? 'unknown'} g
              </p>
              {selectedMeal.safetyReviews?.[0]?.evidenceSnapshot?.nutritionBasis && (
                <p className="mt-2">
                  Admin-entered calculation/source notes:{' '}
                  {selectedMeal.safetyReviews[0].evidenceSnapshot.nutritionBasis}
                </p>
              )}
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
                      <span className="font-semibold text-brand-text">
                        {ingredient.ingredientName}
                        {ingredient.quantity != null
                          ? ` · ${ingredient.quantity} ${ingredient.unit ?? ''} per serving`
                          : ''}
                      </span>
                      <span
                        className={
                          ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                            ? 'text-brand-green'
                            : 'text-amber-300'
                        }
                      >
                        {ingredient.dataSource === 'FNRI' && ingredient.foodItemId
                          ? 'FNRI linked'
                          : ingredient.dataSource === 'USDA_FDC' && ingredient.foodItemId
                            ? 'USDA composition linked; certification pending'
                            : ingredient.foodItemId
                              ? `${ingredient.foodItemId.startsWith('USDA_FDC_') ? 'USDA' : 'FNRI'} name matched; nutrition evidence pending`
                              : 'Composition identity unresolved'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-4 text-xs leading-relaxed text-brand-muted">
              Condition clearance is reviewed separately after base evidence certification. Each clearance is scoped to
              this exact recipe revision and condition, with enhanced conditions requiring an independent Lead review.
            </div>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-brand-muted">Allergen declarations</span>
              <p className="mb-3 text-[11px] leading-relaxed text-brand-muted">
                Choose Present or Reviewed absent for every supported allergen. Reviewed absent describes this evidence
                review only; it is not laboratory or manufacturing certification.
              </p>
              <div className="space-y-2">
                {AVAILABLE_ALLERGENS.map((allergen) => {
                  const mode = evidenceForm.allergensPresent.includes(allergen.value)
                    ? 'present'
                    : evidenceForm.allergensReviewedAbsent.includes(allergen.value)
                      ? 'absent'
                      : '';
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
                        <option value="" disabled>
                          Select a finding
                        </option>
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
                  evidenceForm.allergensPresent.length + evidenceForm.allergensReviewedAbsent.length !==
                    AVAILABLE_ALLERGENS.length ||
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

            <div className="grid gap-4 rounded-xl border border-brand-border/60 bg-brand-bg/60 p-4 md:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase text-brand-muted">Applicable meal slots</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 text-xs text-brand-text">
                      <input
                        type="checkbox"
                        checked={editForm.applicableMealTypes.includes(type)}
                        onChange={() =>
                          setEditForm((current) => {
                            const selected = current.applicableMealTypes.includes(type)
                              ? current.applicableMealTypes.filter((value) => value !== type)
                              : [...current.applicableMealTypes, type];
                            return selected.length ? { ...current, applicableMealTypes: selected } : current;
                          })
                        }
                      />
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-brand-muted">Your saved selection replaces classifier proposals.</p>
              </fieldset>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-brand-muted" htmlFor="edit-rice-role">
                  Rice role
                </label>
                <select
                  id="edit-rice-role"
                  value={editForm.riceRole}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      riceRole: event.target.value as typeof current.riceRole,
                      includedRiceG: event.target.value === 'INCLUDES_RICE' ? current.includedRiceG : null,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text"
                >
                  <option value="PAIR_WITH_RICE">Pair with separate rice</option>
                  <option value="STANDALONE">Standalone</option>
                  <option value="INCLUDES_RICE">Rice included in recipe</option>
                </select>
                {editForm.riceRole === 'INCLUDES_RICE' && (
                  <Input
                    label="Included cooked rice (g, if evidenced)"
                    type="number"
                    min="1"
                    max="1000"
                    value={editForm.includedRiceG ?? ''}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        includedRiceG: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                  />
                )}
                <p className="text-[10px] text-brand-muted">
                  Leave included grams blank when the source does not provide a defensible amount; the serving remains
                  unevaluable.
                </p>
              </div>
            </div>

            {/* Checkboxes lists */}
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-brand-border/60 bg-brand-bg/60 p-3 text-[11px] leading-relaxed text-brand-muted">
                Condition and allergen declarations are controlled in{' '}
                <strong className="text-brand-text">Review evidence</strong>. Editing meal content invalidates any
                current certification and never silently changes clinical declarations.
              </div>

              <div>
                <span className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
                  Dietary compatibility tags
                </span>
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

function ConditionClearancePanel({ mealId }: { mealId: string }) {
  const [condition, setCondition] = useState('HYPERTENSION');
  const [userScopeId, setUserScopeId] = useState('');
  const [rationale, setRationale] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requiresUserScope = condition === 'KIDNEY_DISEASE' || condition === 'HEART_CONDITION';

  const submit = async (decision: 'APPROVE' | 'REJECT') => {
    setWorking(true);
    setMessage(null);
    try {
      const response = await api.post(`/nutritionist/library/${mealId}/condition-clearances`, {
        condition,
        decision,
        rationale: rationale.trim() || undefined,
        userScopeId: userScopeId.trim() || null,
      });
      setMessage(
        response.data?.data?.state === 'REVIEW_DUE'
          ? 'First enhanced review recorded. A different Lead must submit the blind second decision.'
          : `Decision recorded: ${response.data?.data?.state || 'complete'}.`
      );
      setRationale('');
    } catch {
      setMessage(
        'Decision could not be recorded. Check base evidence, reviewer independence, Lead capability, and scope.'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-4">
      <p className="text-xs font-bold uppercase text-brand-green">Condition clearance for this revision</p>
      <p className="mt-2 text-[11px] leading-relaxed text-brand-muted">
        This is separate from base and allergen evidence. Kidney and heart clearance requires the exact user ID because
        the current profile does not capture stage, labs, or medication context.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text"
        >
          {AVAILABLE_CONDITIONS.filter((item) => item.value !== 'NONE').map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {requiresUserScope && (
          <input
            value={userScopeId}
            onChange={(event) => setUserScopeId(event.target.value)}
            placeholder="Required user ID"
            className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text"
          />
        )}
      </div>
      <textarea
        value={rationale}
        onChange={(event) => setRationale(event.target.value)}
        placeholder="Clinical rationale"
        rows={2}
        className="mt-2 w-full rounded-lg border border-brand-border bg-brand-surface p-3 text-xs text-brand-text"
      />
      {message && (
        <p role="status" className="mt-2 text-xs text-brand-muted">
          {message}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={working} onClick={() => void submit('REJECT')}>
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={working || (requiresUserScope && !userScopeId.trim())}
          onClick={() => void submit('APPROVE')}
        >
          Approve clearance
        </Button>
      </div>
    </div>
  );
}
