'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import {
  CheckCircle,
  Flame,
  Check,
  X,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Info,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';
import IngredientEvidenceList from '@/features/nutritionist-reviews/IngredientEvidenceList';
import GovernanceQueuePanel, { ReviewTabs, type ReviewWorkspaceTab } from './GovernanceQueuePanel';
import ClinicalEvidenceReviewPanel from './ClinicalEvidenceReviewPanel';
import api from '@/lib/axios';
import { toast } from '@/components/ui/Sonner';

export default function ReviewsPage() {
  const [workspaceTab, setWorkspaceTab] = useState<ReviewWorkspaceTab>('pending');
  const {
    queue,
    fetchQueue,
    isLoading,
    selectedMealId,
    setSelectedMealId,
    detailLoading,
    detailData,
    actionLoading,
    rejectNote,
    setRejectNote,
    showRejectForm,
    setShowRejectForm,
    generalNote,
    setGeneralNote,
    errorMsg,
    candidateMeal,
    isGeneratingCandidate,
    isEditingCandidate,
    setIsEditingCandidate,
    handleGenerateCandidate,
    handleReplaceAndApprove,
    updateCandidateField,
    addCandidateIngredient,
    removeCandidateIngredient,
    updateCandidateIngredient,
    resetCandidate,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleSelectMeal,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
    handleReject,
    startEditing,
    addIngredientField,
    removeIngredientField,
    updateIngredientField,
  } = useNutritionistReviews();
  const visibleQueue = queue.filter((meal) =>
    workspaceTab === 'second' ? meal.requiresIndependentSecondReview : !meal.requiresIndependentSecondReview
  );

  if (workspaceTab === 'audit' || workspaceTab === 'disputed') {
    return <GovernanceQueuePanel tab={workspaceTab} onTabChange={setWorkspaceTab} />;
  }
  if (workspaceTab === 'clinical') {
    return <ClinicalEvidenceReviewPanel onTabChange={setWorkspaceTab} />;
  }

  return (
    <div className="m-2 sm:m-3 flex h-[calc(100%-1rem)] sm:h-[calc(100%-1.5rem)] w-[calc(100%-1rem)] sm:w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl sm:rounded-[30px] border border-brand-border/70 bg-brand-surface text-left shadow-card-lg backdrop-blur-xl md:m-4 md:h-[calc(100%-2rem)] md:w-[calc(100%-2rem)] md:flex-row">
      {/* Master Queue List Panel */}
      <div
        className={`${selectedMealId ? 'hidden md:flex' : 'flex'} h-full w-full min-w-0 flex-col space-y-4 overflow-y-auto border-brand-border/70 bg-brand-surface/75 p-5 custom-scrollbar md:w-[38%] md:min-w-[280px] md:border-r`}
      >
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 text-brand-text">
          <ReviewTabs value={workspaceTab} onChange={setWorkspaceTab} />
          <p className="text-xs font-semibold text-brand-green">Meal-plan review</p>
          <div className="mt-3 flex items-center justify-between">
            <h1 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
              Review queue
              <button
                onClick={() => fetchQueue()}
                className="rounded-xl p-2 text-brand-green transition hover:bg-brand-green/10"
                title="Refresh queue"
                aria-label="Refresh queue"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </h1>
            <Badge variant="pending" className="text-[9px]">
              {visibleQueue.length} pending
            </Badge>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-brand-muted">
            Select a meal to preview its evidence. Claim it when you are ready to review; release your claim if you need to hand it back.
          </p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-brand-muted animate-pulse text-sm">Loading queue...</span>
          </div>
        ) : visibleQueue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 border border-dashed border-brand-border rounded-xl">
            <CheckCircle className="w-8 h-8 text-brand-green" />
            <p role={errorMsg ? 'alert' : 'status'} className="text-xs text-brand-muted">
              {errorMsg || 'No meals awaiting review in this queue.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQueue.map((meal) => {
              const isSelected = selectedMealId === meal.id;
              return (
                <button
                  type="button"
                  key={meal.id}
                  disabled={meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (!meal.claimStatus.claimedByOther && !meal.claimStatus.coolingDownForMe) handleSelectMeal(meal.id);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
                    meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe ? 'cursor-not-allowed opacity-65' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                      : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/25'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-brand-green">{meal.mealType}</span>
                    <Badge variant="pending" className="text-xs">
                      {meal.requiresSafetyRevalidation ? 'Recheck needed' : 'Awaiting review'}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-brand-text truncate mb-1">{meal.mealName}</h3>
                  {meal.highRiskReviewRequired && (
                    <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-amber-500">
                      {meal.requiresIndependentSecondReview ? 'Independent second review required' : 'Escalated review'}
                    </p>
                  )}
                  <p className="mb-2 text-[10px] font-bold text-brand-green">
                    {meal.reviewApprovalCount}/{meal.highRiskReviewRequired ? 2 : 1} reviews complete
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                    <span className="rounded-md border border-brand-border px-2 py-1 text-brand-muted">
                      {meal.sourceProvenance.replace(/_/g, ' ')}
                    </span>
                    <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-amber-500">
                      Shop by {new Date(meal.shoppingDeadlineAt).toLocaleDateString()}
                    </span>
                    {meal.coalescedDependentCount > 1 && (
                      <span className="rounded-md border border-brand-green/25 bg-brand-green/10 px-2 py-1 text-brand-green">
                        {meal.coalescedDependentCount} matching slots
                      </span>
                    )}
                  </div>
                  <p className="mb-2 text-[10px] leading-relaxed text-brand-muted">
                    Cook date {new Date(meal.cookDeadlineAt).toLocaleDateString()} · {meal.assuranceTier.toLowerCase()}{' '}
                    assurance · {meal.remainingReviewers} review{meal.remainingReviewers === 1 ? '' : 's'} remaining
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-brand-muted">
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      <Avatar name={meal.user.name} size="sm" />
                      <span className="truncate">{meal.user.name}</span>
                    </span>
                    <span className="shrink-0">{new Date(meal.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  {meal.claimStatus.claimedByOther && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Being reviewed</span>
                    </div>
                  )}
                  {meal.claimStatus.coolingDownForMe && (
                    <p className="mt-2 text-[10px] font-bold text-amber-500">
                      Your claim expired. Available to other nutritionists; you can retry after{' '}
                      {meal.claimStatus.cooldownUntil ? new Date(meal.claimStatus.cooldownUntil).toLocaleTimeString() : 'the cooldown'}.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details View Panel */}
      <div
        className={`${selectedMealId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6`}
      >
        {selectedMealId !== null && (
          <button
            type="button"
            onClick={() => setSelectedMealId(null)}
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold text-brand-text outline-none transition hover:border-brand-green/35 focus-visible:ring-2 focus-visible:ring-brand-green/40 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to review queue
          </button>
        )}
        {selectedMealId === null ? (
          <div className="space-y-6 py-3">
            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
              <h2 className="font-display text-2xl font-bold text-brand-text">A clear path to every review</h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                Select a meal to inspect the person’s health profile and the meal’s evidence side by side. The review lock begins only when you press Claim review.
              </p>
              <ol className="mt-5 space-y-3 text-sm text-brand-text">
                <li>
                  <strong className="text-brand-green">01 · Inspect</strong> an available meal.
                </li>
                <li>
                  <strong className="text-brand-green">02 · Claim</strong> when ready to decide.
                </li>
                <li>
                  <strong className="text-brand-green">03 · Decide</strong> and record your review notes.
                </li>
              </ol>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <span className="text-brand-muted animate-pulse text-sm">Loading meal preview...</span>
          </div>
        ) : errorMsg && !detailData ? (
          <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-xl space-y-4 max-w-lg mx-auto mt-12 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-brand-text">Access Blocked</h3>
              <p className="text-xs text-brand-muted">{errorMsg}</p>
            </div>
            <Button variant="secondary" onClick={() => setSelectedMealId(null)} className="text-xs px-6">
              Back to Queue
            </Button>
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {errorMsg && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400">{errorMsg}</div>}
            {!detailData.claimStatus.claimedByMe && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
                <p className="text-xs text-brand-muted">Preview only. Claim this meal before submitting a review or downloading its clinical record.</p>
                <Button onClick={handleClaimMeal} isLoading={actionLoading === selectedMealId} disabled={Boolean(actionLoading)}>
                  Claim review
                </Button>
              </div>
            )}
            {/* Header Lock Info Banner */}
            {detailData.claimStatus.claimedByMe && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  Claimed by you until{' '}
                  {detailData.claimStatus.claimExpiresAt
                    ? new Date(detailData.claimStatus.claimExpiresAt).toLocaleTimeString()
                    : 'the 30-minute deadline'}. Submit before it expires; afterward, others may claim it and you have a 5-minute cooldown.
                </span>
                <Button variant="secondary" onClick={handleReleaseMeal} isLoading={actionLoading === selectedMealId} disabled={Boolean(actionLoading)}>
                  Release claim
                </Button>
              </div>
            )}
            {detailData.mealPlan.requiresSafetyRevalidation && (
              <div
                role="status"
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-brand-text"
              >
                <strong>Profile or evidence changed.</strong> Check the current diet, allergies, conditions and portion
                target below. Previous automated triage is not current.
              </div>
            )}
            {detailData.highRiskReviewRequired && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {detailData.requiresIndependentSecondReview
                  ? 'This meal has one approval. You are performing the required independent second review.'
                  : 'This profile requires two independent nutritionist approvals before the meal becomes actionable.'}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Split Panel Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Panel: User Profile */}
              <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                <div className="flex items-center gap-3.5 border-b border-brand-border pb-3">
                  <Avatar name={detailData.user.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      User Health Profile
                    </h2>
                    <h3 className="truncate text-base font-extrabold text-brand-text mt-0.5">{detailData.user.name}</h3>
                    <p className="text-xs text-brand-muted">
                      {detailData.user.age} yrs • {detailData.user.sex}
                    </p>
                  </div>
                </div>

                {/* Health Conditions */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-brand-muted">Conditions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailData.user.conditions.length === 0 ? (
                      <span className="text-xs text-brand-muted italic">None declared</span>
                    ) : (
                      detailData.user.conditions.map((hc, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold"
                        >
                          {hc}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Allergies */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-brand-muted">Allergies</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailData.user.allergies.length === 0 ? (
                      <span className="text-xs text-brand-muted italic">None declared</span>
                    ) : (
                      detailData.user.allergies.map((alg, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold"
                        >
                          {alg}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {detailData.user.safetyEntries && detailData.user.safetyEntries.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-brand-muted">Complete structured restrictions</h4>
                    <div className="space-y-1.5">
                      {detailData.user.safetyEntries.map((entry, index) => (
                        <div
                          key={`${entry.domain}-${entry.label}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 bg-brand-bg/50 px-2.5 py-2 text-[10px]"
                        >
                          <span className="font-bold text-brand-text">{entry.label}</span>
                          <span className="text-right font-mono uppercase text-brand-muted">
                            {entry.domain.replaceAll('_', ' ')} · {entry.supportState.replaceAll('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailData.clinicalEvidence && detailData.clinicalEvidence.requirements.length > 0 && (
                  <div className="space-y-2 border-t border-brand-border pt-3 text-xs">
                    <h4 className="font-bold text-brand-text">Reviewed clinical context</h4>
                    {detailData.clinicalEvidence.requirements.map((item) => <p key={item.area} className={item.state === 'READY' ? 'text-brand-green' : 'text-amber-500'}>{item.area.replaceAll('_', ' ')}: {item.message}</p>)}
                    {detailData.clinicalEvidence.documents.map((item) => <div key={item.id} className="rounded-lg border border-brand-border p-2">
                      <p>{item.area.replaceAll('_', ' ')} · {item.documentType.replaceAll('_', ' ')}{item.validUntil ? ` · valid until ${new Date(item.validUntil).toLocaleDateString()}` : ''}</p>
                      {item.facts.map((fact, index) => <p key={`${fact.code}-${index}`} className="text-brand-muted">{fact.code.replaceAll('_', ' ')}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''}</p>)}
                      {detailData.claimStatus.claimedByMe && <button type="button" className="mt-1 font-semibold text-brand-green underline" onClick={async () => { try {
                        const response = await api.get(`/nutritionist/queue/${detailData.mealPlan.id}/clinical-evidence/${item.id}/file`, { responseType: 'blob' });
                        const url = URL.createObjectURL(response.data);
                        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'clinical-document'; anchor.click();
                        setTimeout(() => URL.revokeObjectURL(url), 30_000);
                      } catch { toast.error('The clinical document could not be opened. Refresh your review claim and try again.'); } }}>Download original record</button>}
                    </div>)}
                  </div>
                )}

                {/* General Info Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-brand-border">
                  <div>
                    <span className="block text-[10px] text-brand-muted">Target Goal</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.goal}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Daily Target</span>
                    <strong className="text-brand-text text-xs">{detailData.user.dailyCalorieTarget} kcal</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Diet Preference</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.dietaryPreference}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-brand-muted">Rice Preference</span>
                    <strong className="text-brand-text text-xs uppercase">{detailData.user.ricePreference}</strong>
                  </div>
                </div>
              </div>

              {/* Right Panel: Meal Details */}
              <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                <div className="border-b border-brand-border pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider">Meal Details</h2>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.mealName}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, mealName: e.target.value }))}
                        className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-sm font-extrabold w-full mt-2 focus:outline-none focus:border-brand-green"
                      />
                    ) : (
                      <h3 className="text-base font-extrabold text-brand-text mt-1">{detailData.mealPlan.mealName}</h3>
                    )}
                    <p className="text-xs text-brand-muted mt-1 uppercase">
                      {detailData.mealPlan.mealType} • Generated{' '}
                      {new Date(detailData.mealPlan.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-brand-muted">Description</h4>
                  {isEditing ? (
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-brand-green resize-none"
                    />
                  ) : (
                    <p className="text-xs text-brand-muted leading-relaxed">
                      {detailData.mealPlan.description || 'No description available.'}
                    </p>
                  )}
                </div>

                {/* Nutrition targets */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-brand-muted">Nutrition Data</h4>
                  {isEditing ? (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-brand-muted">Calories</label>
                        <input
                          type="number"
                          value={editForm.calories}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))
                          }
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Protein (g)</label>
                        <input
                          type="number"
                          value={editForm.proteinG}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))
                          }
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Carbs (g)</label>
                        <input
                          type="number"
                          value={editForm.carbsG}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))
                          }
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-brand-muted">Fat (g)</label>
                        <input
                          type="number"
                          value={editForm.fatG}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 text-xs text-brand-muted items-center">
                      <span className="flex items-center gap-1 font-bold text-amber-500">
                        <Flame className="w-3.5 h-3.5 fill-current" />
                        <span>{detailData.mealPlan.calories.toFixed(0)} kcal</span>
                      </span>
                      <span>
                        P: <strong>{detailData.mealPlan.proteinG.toFixed(1)}g</strong>
                      </span>
                      <span>
                        C: <strong>{detailData.mealPlan.carbsG.toFixed(1)}g</strong>
                      </span>
                      <span>
                        F: <strong>{detailData.mealPlan.fatG.toFixed(1)}g</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Ingredients list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-brand-muted flex justify-between items-center">
                    <span>Ingredients</span>
                    {isEditing && (
                      <button
                        onClick={addIngredientField}
                        className="text-brand-green hover:underline text-[11px] flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add Ingredient
                      </button>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {isEditing ? (
                      editForm.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={ing.name}
                            onChange={(e) => updateIngredientField(idx, e.target.value)}
                            placeholder="Ingredient name..."
                            className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs flex-grow focus:outline-none focus:border-brand-green"
                          />
                          <Badge
                            variant={
                              ing.dataSource === 'FNRI'
                                ? 'verified'
                                : ing.dataSource === 'SOURCE_RECIPE'
                                  ? 'user'
                                  : 'pending'
                            }
                            className="text-[8px] uppercase select-none"
                          >
                            {ing.dataSource === 'FNRI'
                              ? 'FNRI'
                              : ing.dataSource === 'SOURCE_RECIPE'
                                ? 'Source'
                                : 'AI est.'}
                          </Badge>
                          <button
                            onClick={() => removeIngredientField(idx)}
                            className="p-1 text-red-500 hover:bg-red-950/20 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <IngredientEvidenceList ingredients={detailData.ingredients} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Warnings list */}
            {detailData.warnings.length > 0 && (
              <div className="border border-brand-border rounded-xl p-5 bg-brand-surface/40 space-y-3">
                <h4 className="text-xs font-bold text-brand-muted flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Pre-computed Clinical Warnings
                </h4>
                <div className="space-y-2">
                  {detailData.warnings.map((w, idx) => {
                    let severityStyles = 'border-brand-cyan/20 bg-brand-cyan/10 text-brand-green dark:text-brand-cyan';
                    if (w.severity === 'CRITICAL') {
                      severityStyles = 'text-red-400 bg-red-950/30 border-red-900/30';
                    } else if (w.severity === 'IMPORTANT') {
                      severityStyles = 'text-amber-500 bg-amber-950/20 border-amber-800/20';
                    }
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${severityStyles}`}
                      >
                        {w.severity === 'CRITICAL' && <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
                        {w.severity === 'IMPORTANT' && (
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                        )}
                        {w.severity === 'NOTICE' && (
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-green dark:text-brand-cyan" />
                        )}
                        <span>{w.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {detailData.claimStatus.claimedByMe && <>
            {/* Note to Patient form input */}
            <div className="bg-brand-surface/30 border border-brand-border rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                Note to Patient (optional)
              </h4>
              <textarea
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Include a helpful message, advice, or summary context for the patient. They will see this alongside their approved meal."
                rows={2}
                className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:border-brand-green resize-none leading-relaxed"
              />
            </div>

            {/* Rejection forms section with In-Flight Candidate Replacement */}
            {showRejectForm && (
              <div className="p-5 border border-red-500/25 bg-red-950/10 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Clinical Rejection & In-Flight Replacement
                  </h4>
                  {candidateMeal && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> AI Candidate Ready
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-muted leading-relaxed">
                  Specify why this dish is contraindicated for the patient. You can immediately generate an alternative
                  dish tailored to avoid this problem and verify it in one step, so the patient never receives an
                  unverified pending meal.
                </p>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-brand-muted mb-1.5">
                    Rejection Reason & Negative Constraint (Required)
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="e.g., Too high sodium for hypertension; bagoong contraindicated; high purine for hyperuricemia..."
                    rows={2}
                    disabled={Boolean(candidateMeal)}
                    className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:border-red-500 resize-none disabled:opacity-75"
                  />
                </div>

                {!candidateMeal ? (
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <Button
                      variant="primary"
                      onClick={handleGenerateCandidate}
                      isLoading={isGeneratingCandidate}
                      disabled={!rejectNote.trim() || isGeneratingCandidate}
                      className="w-full sm:w-auto text-xs px-6 py-2.5 bg-brand-green text-brand-bg hover:bg-brand-green/90 font-bold flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Compliant Replacement ⚡</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleReject}
                      isLoading={actionLoading === selectedMealId}
                      disabled={!rejectNote.trim() || isGeneratingCandidate}
                      className="w-full sm:w-auto text-xs px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-950/20 border border-red-500/25 font-semibold"
                      title="Reject directly without an in-flight replacement"
                    >
                      Reject Without Replacement
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectNote('');
                        resetCandidate();
                      }}
                      disabled={isGeneratingCandidate}
                      className="w-full sm:w-auto text-xs px-4 py-2"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-brand-green/30 bg-brand-bg/70 p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-brand-border/60 pb-2.5">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green">
                          Proposed Replacement Dish
                        </span>
                        <div className="mt-0.5">
                          {isEditingCandidate ? (
                            <input
                              type="text"
                              value={candidateMeal.mealName}
                              onChange={(e) => updateCandidateField('mealName', e.target.value)}
                              className="bg-brand-bgAlt border border-brand-border rounded-lg px-2.5 py-1 text-sm font-bold text-brand-text w-full focus:outline-none focus:border-brand-green"
                            />
                          ) : (
                            <h3 className="font-display text-base font-extrabold text-brand-text">
                              {candidateMeal.mealName}
                            </h3>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setIsEditingCandidate(!isEditingCandidate)}
                        className="text-[11px] font-semibold text-brand-muted hover:text-brand-text py-1 px-2.5 h-auto shrink-0"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {isEditingCandidate ? 'Done' : 'Tweak'}
                      </Button>
                    </div>

                    {isEditingCandidate ? (
                      <textarea
                        value={candidateMeal.description}
                        onChange={(e) => updateCandidateField('description', e.target.value)}
                        rows={2}
                        placeholder="Description..."
                        className="bg-brand-bgAlt border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text w-full focus:outline-none focus:border-brand-green resize-none"
                      />
                    ) : (
                      <p className="text-xs text-brand-muted leading-relaxed">
                        {candidateMeal.description || 'AI-generated clinical replacement meal.'}
                      </p>
                    )}

                    {/* Macro distribution */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                        <span className="block text-xs font-black font-display text-brand-text">
                          {Math.round(candidateMeal.calories)} kcal
                        </span>
                        <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                          Energy
                        </span>
                      </div>
                      <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                        <span className="block text-xs font-black font-display text-brand-text">
                          {Math.round(candidateMeal.proteinG)}g
                        </span>
                        <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                          Protein
                        </span>
                      </div>
                      <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                        <span className="block text-xs font-black font-display text-brand-text">
                          {Math.round(candidateMeal.carbsG)}g
                        </span>
                        <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                          Carbs
                        </span>
                      </div>
                      <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                        <span className="block text-xs font-black font-display text-brand-text">
                          {Math.round(candidateMeal.fatG)}g
                        </span>
                        <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                          Fat
                        </span>
                      </div>
                    </div>

                    {/* Proposed Ingredients */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                          Ingredients ({candidateMeal.ingredients.length})
                        </span>
                        {isEditingCandidate && (
                          <button
                            type="button"
                            onClick={addCandidateIngredient}
                            className="text-[10px] text-brand-green font-bold flex items-center gap-0.5 hover:underline"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                      {isEditingCandidate ? (
                        <div className="space-y-1.5">
                          {candidateMeal.ingredients.map((ing, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={ing.name}
                                onChange={(e) => updateCandidateIngredient(idx, e.target.value)}
                                className="bg-brand-bgAlt border border-brand-border rounded-lg px-2 py-1 text-xs text-brand-text flex-1 focus:outline-none focus:border-brand-green"
                              />
                              <button
                                type="button"
                                onClick={() => removeCandidateIngredient(idx)}
                                className="text-red-400 p-1 hover:bg-red-500/10 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {candidateMeal.ingredients.map((ing, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg border border-brand-border/70 bg-brand-surface px-2.5 py-1 text-[11px] font-semibold text-brand-text"
                            >
                              {ing.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Final Decision Action Row */}
                    <div className="pt-2 border-t border-brand-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={handleReplaceAndApprove}
                        isLoading={actionLoading === selectedMealId}
                        className="text-xs px-6 py-2.5 font-bold flex-1 flex items-center justify-center gap-1.5 bg-brand-green text-brand-bg hover:bg-brand-green/90"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve & Deliver to Patient ✅</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleGenerateCandidate}
                        isLoading={isGeneratingCandidate}
                        className="text-xs px-4 py-2 text-brand-muted hover:text-brand-text"
                        title="Regenerate another suggestion"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Re-roll
                      </Button>
                      <Button variant="ghost" onClick={resetCandidate} className="text-xs px-3 py-2 text-brand-muted">
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons footer */}
            {!showRejectForm && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:gap-3">
                {isEditing ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleApprove}
                      isLoading={actionLoading === selectedMealId}
                      className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0
                          ? 'Save first approval'
                          : 'Save & Approve'}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditing(false)}
                      className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 text-center justify-center"
                    >
                      Cancel Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleApprove}
                      isLoading={actionLoading === selectedMealId}
                      className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0
                          ? 'Submit first approval'
                          : 'Approve'}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={startEditing}
                      className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 border-brand-muted text-brand-muted hover:text-brand-text hover:border-brand-text active:scale-[0.98]"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit & Approve</span>
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowRejectForm(true)}
                      className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 text-red-400 border-red-500/20 hover:bg-red-950/20 hover:border-red-500/40 active:scale-[0.98]"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </Button>
                  </>
                )}
              </div>
            )}
            </>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
