'use client';

import OutsideReviewRequestButton from '@/features/membership/OutsideReviewRequestButton';
import { useMembership } from '@/features/membership/MembershipProvider';
import { getApiErrorMessage } from '@/lib/api-error';
import type { MealHistoryLog } from '@/features/meals/meals-workspace.types';

import type { useMealHistoryCardModel } from './useMealHistoryCardModel';
type Model = Extract<ReturnType<typeof useMealHistoryCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'log'
    | 'isVoided'
    | 'onEditOutsideItem'
    | 'setEditingItemId'
    | 'setEditDraft'
    | 'setMarkUnresolved'
    | 'editingItemId'
    | 'setIsChanging'
    | 'setSaveError'
    | 'editDraft'
    | 'markUnresolved'
    | 'isChanging'
    | 'onReplyToOutsideReview'
    | 'clarification'
    | 'setClarification'
    | 'onRequestOutsideReview'
    | 'onObservedWithdraw'
    | 'consentItemId'
    | 'shareImage'
    | 'setShareImage'
    | 'onObservedConsent'
    | 'setConsentItemId'
  >;
};
export default function OutsideMealHistoryItems({ model }: SectionProps) {
  const {
    log,
    isVoided,
    onEditOutsideItem,
    setEditingItemId,
    setEditDraft,
    setMarkUnresolved,
    editingItemId,
    setIsChanging,
    setSaveError,
    editDraft,
    markUnresolved,
    isChanging,
    onReplyToOutsideReview,
    clarification,
    setClarification,
    onRequestOutsideReview,
    onObservedWithdraw,
    consentItemId,
    shareImage,
    setShareImage,
    onObservedConsent,
    setConsentItemId,
  } = model;

  const { refresh } = useMembership();
  const items = log.outsideItems ?? [];
  const open = items.some(
    (item) => item.review?.requestedByUserAt && ['PENDING', 'CLAIMED', 'NEEDS_MORE_INFO'].includes(item.review.status)
  );
  const completed = items.length > 0 && items.every(isCurrentReviewedEstimate);
  return (
    <>
      {log.outsideItems && log.outsideItems.length > 0 && (
        <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-xs text-white backdrop-blur-sm">
          <p className="font-bold text-white/80 uppercase tracking-wider text-[10px] mb-1.5">Logged Food Items</p>
          {log.nutritionCompleteness && log.nutritionCompleteness !== 'COMPLETE' && (
            <p className="mb-2 text-white/80">Partial total: unresolved items are excluded, not counted as zero.</p>
          )}
          {log.provisionalCalories ? (
            <p className="mb-2 text-amber-300">{Math.round(log.provisionalCalories)} kcal remains estimated.</p>
          ) : null}
          {!isVoided && log.source === 'USER_LOGGED' && onRequestOutsideReview && !open && !completed && (
            <div className="mb-4">
              <OutsideReviewRequestButton
                inverse
                busy={isChanging}
                onRequest={async () => {
                  setIsChanging(true);
                  setSaveError(null);
                  try {
                    await onRequestOutsideReview(log.id, items[0].id);
                    refresh();
                  } catch (error) {
                    setSaveError(getApiErrorMessage(error, 'Could not request estimate review. Please retry.'));
                  } finally {
                    setIsChanging(false);
                  }
                }}
              />
            </div>
          )}
          <div className="space-y-2">
            {log.outsideItems.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-lg border border-white/15 bg-black/25 p-2.5 text-xs text-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {item.name}
                    {item.portionGrams ? ` (${item.portionGrams}g)` : ''} ·{' '}
                    {item.includedInTotals ? `${Math.round(item.calories ?? 0)} kcal` : 'Unresolved'} ·{' '}
                    {item.source?.replaceAll('_', ' ').toLowerCase()} · revision {item.currentRevision ?? 0}
                  </span>
                  {log.source === 'USER_LOGGED' && !isVoided && onEditOutsideItem && (
                    <button
                      type="button"
                      className="text-emerald-300 underline font-medium hover:text-emerald-200"
                      onClick={() => {
                        setEditingItemId(item.id);
                        setEditDraft({
                          name: item.name,
                          portionGrams: String(item.portionGrams ?? ''),
                          calories: String(item.calories ?? ''),
                          proteinG: String(item.proteinG ?? ''),
                          carbsG: String(item.carbsG ?? ''),
                          fatG: String(item.fatG ?? ''),
                          reason: '',
                        });
                        setMarkUnresolved(!item.includedInTotals);
                      }}
                    >
                      Correct
                    </button>
                  )}
                </div>
                {editingItemId === item.id && (
                  <form
                    className="mt-3 grid grid-cols-2 gap-2 text-gray-900"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!onEditOutsideItem) return;
                      setIsChanging(true);
                      setSaveError(null);
                      try {
                        await onEditOutsideItem(log.id, item.id, {
                          name: editDraft.name,
                          portionGrams: editDraft.portionGrams ? Number(editDraft.portionGrams) : null,
                          ...(markUnresolved
                            ? { unresolved: true }
                            : {
                                reportedNutrition: {
                                  calories: Number(editDraft.calories),
                                  proteinG: Number(editDraft.proteinG),
                                  carbsG: Number(editDraft.carbsG),
                                  fatG: Number(editDraft.fatG),
                                },
                              }),
                          reason: editDraft.reason || 'Member corrected this record',
                        });
                        setEditingItemId(null);
                      } catch {
                        setSaveError('Could not revise this item. Reload and try again.');
                      } finally {
                        setIsChanging(false);
                      }
                    }}
                  >
                    <input
                      className="col-span-2 rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                      aria-label="Corrected food name"
                      value={editDraft.name}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, name: event.target.value }))}
                      required
                    />
                    <input
                      className="rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                      type="number"
                      min="1"
                      max="5000"
                      step="0.1"
                      aria-label="Corrected portion grams"
                      placeholder="Portion g"
                      value={editDraft.portionGrams}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, portionGrams: event.target.value }))}
                    />
                    <label className="flex items-center gap-1 text-xs text-white">
                      <input
                        type="checkbox"
                        checked={markUnresolved}
                        onChange={(event) => setMarkUnresolved(event.target.checked)}
                      />{' '}
                      Unknown nutrition
                    </label>
                    {!markUnresolved &&
                      (['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => (
                        <input
                          key={field}
                          className="rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                          type="number"
                          min="0"
                          step="0.1"
                          required
                          aria-label={`Corrected ${field}`}
                          placeholder={field}
                          value={editDraft[field]}
                          onChange={(event) => setEditDraft((draft) => ({ ...draft, [field]: event.target.value }))}
                        />
                      ))}
                    <input
                      className="col-span-2 rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                      aria-label="Reason for correction"
                      placeholder="What changed?"
                      value={editDraft.reason}
                      onChange={(event) => setEditDraft((draft) => ({ ...draft, reason: event.target.value }))}
                    />
                    <button
                      disabled={isChanging}
                      className="rounded bg-emerald-500 hover:bg-emerald-400 p-2 font-bold text-black text-xs"
                      type="submit"
                    >
                      Save revision
                    </button>
                    <button
                      type="button"
                      className="text-xs text-white/80 hover:text-white"
                      onClick={() => setEditingItemId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                )}
                {log.source === 'USER_LOGGED' && (
                  <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-white/90">
                    <p className="font-semibold text-white/80">
                      {!item.review?.requestedByUserAt
                        ? 'No RND review requested'
                        : ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status) &&
                            !isCurrentReviewedEstimate(item)
                          ? 'Previous review: this item has changed'
                          : item.review.status === 'PENDING'
                            ? 'Queued for nutrition estimate review'
                            : item.review?.status === 'CLAIMED'
                              ? 'Nutrition estimate under review'
                              : item.review?.status === 'VERIFIED'
                                ? 'RND-reviewed estimate'
                                : item.review?.status === 'CORRECTED'
                                  ? 'RND-adjusted estimate'
                                  : item.review?.status === 'NEEDS_MORE_INFO'
                                    ? 'RND needs more information'
                                    : item.review?.status === 'UNVERIFIABLE'
                                      ? 'RND could not assess this estimate'
                                      : 'No RND review requested'}
                    </p>
                    {item.review &&
                      ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status) &&
                      item.revisions?.[0]?.revision === (item.review.reviewedRevision ?? -1) + 1 &&
                      item.revisions[0].reason && (
                        <p className="rounded-lg bg-black/20 p-2 text-white/80">
                          RND rationale: {item.revisions[0].reason}
                        </p>
                      )}
                    {item.review?.messages?.map((message) => (
                      <p key={message.id} className="rounded-lg bg-black/20 p-2 text-white/80">
                        <strong>{message.sender === 'NUTRITIONIST' ? 'RND' : 'You'}:</strong> {message.content}
                        <span className="ml-2 text-[10px] text-white/60">Revision {message.itemRevision}</span>
                      </p>
                    ))}
                    {!isVoided &&
                      item.review?.requestedByUserAt &&
                      item.review.status === 'NEEDS_MORE_INFO' &&
                      onReplyToOutsideReview && (
                        <form
                          className="space-y-2"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            setIsChanging(true);
                            setSaveError(null);
                            try {
                              await onReplyToOutsideReview(log.id, item.id, clarification.trim());
                              setClarification('');
                            } catch {
                              setSaveError('Could not send your clarification.');
                            } finally {
                              setIsChanging(false);
                            }
                          }}
                        >
                          <textarea
                            className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                            maxLength={1000}
                            value={clarification}
                            onChange={(event) => setClarification(event.target.value)}
                            placeholder="Answer the specific RND question"
                            aria-label="Clarification reply"
                          />
                          <button
                            type="submit"
                            disabled={isChanging || clarification.trim().length < 3}
                            className="rounded bg-emerald-500 px-3 py-1 font-bold text-black text-xs disabled:opacity-50"
                          >
                            Send clarification
                          </button>
                        </form>
                      )}
                    {!isVoided &&
                      isCurrentReviewedEstimate(item) &&
                      ['VERIFIED', 'CORRECTED'].includes(item.review?.status ?? '') &&
                      item.portionGrams &&
                      item.portionGrams > 0 &&
                      (() => {
                        const submission = item.observedSubmissions?.find(
                          (row) => row.sourceRevision === item.currentRevision && row.status !== 'WITHDRAWN'
                        );
                        return submission ? (
                          <div className="text-xs text-white/80">
                            <p>
                              Deidentified food-detail reuse: {submission.status.replaceAll('_', ' ').toLowerCase()}.
                              This does not certify a recipe or reuse your private notes.
                            </p>
                            {onObservedWithdraw && (
                              <button
                                type="button"
                                className="text-emerald-300 underline hover:text-emerald-200"
                                disabled={isChanging}
                                onClick={async () => {
                                  setIsChanging(true);
                                  setSaveError(null);
                                  try {
                                    await onObservedWithdraw(submission.id);
                                  } catch {
                                    setSaveError('Could not withdraw reuse permission.');
                                  } finally {
                                    setIsChanging(false);
                                  }
                                }}
                              >
                                Withdraw future reuse
                              </button>
                            )}
                          </div>
                        ) : consentItemId === item.id ? (
                          <div className="space-y-2 rounded-lg border border-white/20 bg-black/20 p-3 text-xs text-white">
                            <p>
                              Allow an RND to turn this reviewed estimate into a deidentified food reference or recipe
                              candidate. Your identity and private notes will not be shared. This is optional.
                            </p>
                            {log.hasImage && (
                              <label className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={shareImage}
                                  onChange={(event) => setShareImage(event.target.checked)}
                                />
                                I own this photo and separately allow its reuse. Photos are not currently copied into
                                the shared corpus.
                              </label>
                            )}
                            <div className="flex gap-3">
                              <button
                                type="button"
                                disabled={isChanging}
                                className="text-emerald-300 underline hover:text-emerald-200"
                                onClick={async () => {
                                  if (!onObservedConsent) return;
                                  setIsChanging(true);
                                  setSaveError(null);
                                  try {
                                    await onObservedConsent(log.id, item.id, shareImage);
                                    setConsentItemId(null);
                                  } catch {
                                    setSaveError('Could not submit reuse permission.');
                                  } finally {
                                    setIsChanging(false);
                                  }
                                }}
                              >
                                Allow deidentified details
                              </button>
                              <button
                                type="button"
                                onClick={() => setConsentItemId(null)}
                                className="text-white/70 hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          onObservedConsent && (
                            <button
                              type="button"
                              className="text-emerald-300 underline hover:text-emerald-200"
                              onClick={() => {
                                setShareImage(false);
                                setConsentItemId(item.id);
                              }}
                            >
                              Optionally share deidentified food details
                            </button>
                          )
                        );
                      })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function isCurrentReviewedEstimate(item: NonNullable<MealHistoryLog['outsideItems']>[number]) {
  return (
    !!item.review?.requestedByUserAt &&
    ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status) &&
    item.review.reviewedRevision != null &&
    item.review.reviewedRevision + 1 === item.currentRevision
  );
}
