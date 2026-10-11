'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import ReviewDecisionDialog from '@/features/nutritionist-reviews/ReviewDecisionDialog';
import Badge from '@/components/ui/Badge';
import MealImage from '@/components/user/MealImage';
import IngredientEvidenceTable from '@/features/nutritionist-reviews/IngredientEvidenceTable';
import { recordedIngredients } from '@/features/nutritionist-reviews/recorded-ingredients';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import MealVerificationQueue, { type MealCandidate } from '@/features/nutritionist-reviews/MealVerificationQueue';
import { ChefHat, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

export default function MealVerificationPanel() {
  const ownerId = useAuth().user?.userId;
  const cachedQueue = readSessionResource<MealCandidate[]>(ownerId, 'nutritionist-meal-verification-queue', 30_000);
  const [queue, setQueue] = useState<MealCandidate[]>(cachedQueue ?? []);
  const [isLoading, setIsLoading] = useState(!cachedQueue);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | null>(null);
  useEffect(() => setDecisionAction(null), [selectedId]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await api.get('/nutritionist/meal-verification', signal ? { signal } : undefined);
        if (signal?.aborted) return;
        const next = response.data.data ?? [];
        setQueue(next);
        writeSessionResource(ownerId, 'nutritionist-meal-verification-queue', next);
        setError(null);
      } catch (cause) {
        if (!signal?.aborted) setError(getApiErrorMessage(cause, 'Meal verification queue could not be loaded.'));
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId]
  );

  useVisiblePolling(
    async (signal) => {
      await load(signal);
    },
    { enabled: !busy, immediate: false, scopeKey: ownerId }
  );
  useEffect(() => {
    void load();
  }, [load]);

  const selected = queue.find((item) => `${item.kind}:${item.id}` === selectedId);

  const act = async (action: 'claim' | 'release' | 'decision', decision?: 'VERIFIED' | 'REJECTED') => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/nutritionist/meal-verification/${selected.kind}/${selected.id}/${action}`,
        action === 'decision' ? { decision, rationale } : {}
      );
      if (action === 'decision' || action === 'release') {
        setDecisionAction(null);
        setSelectedId(null);
        setExpanded(false);
        setRationale('');
      }
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The review could not be saved. Refresh and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const claimHeader = selected ? (
    selected.claimedByMe ? (
      <div className="flex items-center gap-2 rounded-xl border border-brand-green/35 bg-brand-surface/95 px-3 py-1.5 text-xs text-brand-green shadow-md backdrop-blur-md">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" />
        <span className="font-semibold text-xs text-brand-text">Claim active</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          isLoading={busy}
          onClick={() => void act('release')}
          className="ml-1 text-[11px] h-7 px-2.5 rounded-lg border-brand-green/30 hover:border-brand-green/50"
        >
          Release claim
        </Button>
      </div>
    ) : (
      <Button
        variant="primary"
        size="sm"
        disabled={busy || selected.claimedByOther || selected.authoredByMe}
        isLoading={busy}
        onClick={() => void act('claim')}
        className="rounded-xl shadow-md text-xs font-bold px-3.5 py-2"
      >
        <ChefHat className="mr-1.5 h-3.5 w-3.5" />
        {selected.authoredByMe ? 'Independent reviewer required' : 'Claim verification'}
      </Button>
    )
  ) : null;

  return (
    <section className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
      <MealVerificationQueue
        queue={queue}
        selectedId={selectedId}
        expanded={expanded}
        busy={busy}
        isLoading={isLoading}
        error={error}
        onRetry={() => void load()}
        onSelect={(id) => {
          setSelectedId(id);
          setRationale('');
          setExpanded(false);
        }}
      />

      {/* Details View Panel */}
      <div
        className={`${selected ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar sm:p-4`}
      >
        {!selected ? (
          <ExpandableCasePanel
            expanded={expanded}
            onExpandedChange={setExpanded}
            canExpand={false}
            headerLeft={claimHeader}
            onBack={() => {
              setSelectedId(null);
              setRationale('');
              setExpanded(false);
            }}
            className={`${selected ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
          >
            <div className="space-y-6 py-2">
              <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
                  <ChefHat className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                    A clear path to meal verification
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                    Inspect proposed recipes to verify kitchen preparation feasibility, macro estimates, and clean
                    ingredient formulations before dishes enter the verified library.
                  </p>
                </div>
                <div className="grid gap-3 pt-2">
                  {[
                    {
                      step: '01',
                      title: 'Inspect an available dish',
                      desc: 'Preview preparation instructions, estimated calories and macros, and parsed ingredient quantities.',
                    },
                    {
                      step: '02',
                      title: 'Claim verification review',
                      desc: 'Secure exclusive evaluation lock when you are ready to evaluate ingredients and culinary safety.',
                    },
                    {
                      step: '03',
                      title: 'Verify or reject with clinical notes',
                      desc: 'Confirm the base dish for clinical library usage or reject with specific corrective instructions.',
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="flex items-start gap-3.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4 transition-colors hover:border-brand-accent/30"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 font-mono text-xs font-black text-brand-accent">
                        {item.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-bold text-brand-text">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ExpandableCasePanel>
        ) : (
          <div className="space-y-4">
            <RndQueueDocument
              key={selectedId}
              title={`Meal verification · ${selected.name}`}
              contentKey={`${selected.kind}:${selected.id}:${selected.revisionKey}`}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onBack={() => {
                setSelectedId(null);
                setRationale('');
              }}
              actions={claimHeader}
              decision={
                selected.claimedByMe ? (
                  <>
                    <div role="toolbar" aria-label="Meal review actions" className="flex items-center gap-2">
                      <Button size="sm" disabled={busy} onClick={() => setDecisionAction('approve')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => setDecisionAction('reject')}>
                        Reject
                      </Button>
                    </div>
                    <ReviewDecisionDialog
                      action={decisionAction}
                      onClose={() => setDecisionAction(null)}
                      busy={busy}
                      error={error}
                      note={rationale}
                      onNoteChange={setRationale}
                      required
                      approvalLabel="Verify base meal"
                      onConfirm={() => void act('decision', decisionAction === 'reject' ? 'REJECTED' : 'VERIFIED')}
                    />
                  </>
                ) : undefined
              }
            >
              <ReviewDocumentPage page={1} title="Base meal verification" subtitle={selected.name}>
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400"
                  >
                    {error}
                  </div>
                )}

                {selected.claimedByMe && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                      30-minute exclusive verification lock active. Submit before expiry to prevent automatic release.
                    </span>
                  </div>
                )}

                {/* Recipe Header & Details */}
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3">
                    <span className="inline-block rounded-full bg-brand-accent/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-accent">
                      {selected.mealType} · {selected.source.replaceAll('_', ' ')}
                    </span>
                    <Badge variant={selected.status === 'PENDING' ? 'pending' : 'rejected'} className="text-[10px]">
                      {selected.status}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">{selected.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                      {selected.description || 'No description recorded.'}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-brand-border/60">
                    <MealImage
                      image={
                        selected.imageUrl
                          ? {
                              url: selected.imageUrl,
                              altText: selected.name,
                              kind: 'EXACT',
                              attribution: {
                                creator: 'RND supplied',
                                sourcePageUrl: null,
                                licenseCode: null,
                                licenseUrl: null,
                                modifications: 'Adapted recipe',
                              },
                            }
                          : null
                      }
                      mealName={selected.name}
                      mealType={selected.mealType}
                      variant="card"
                      className="h-44 w-full sm:h-52"
                      showAttributionLinks
                    />
                  </div>

                  {/* Nutritional Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Calories</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.calories ?? '—'} <span className="text-xs font-normal text-brand-muted">kcal</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Protein</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.proteinG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Carbs</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.carbsG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Fat</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.fatG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                  </div>
                </div>
              </ReviewDocumentPage>
              <ReviewDocumentPage page={2} title="Recipe ingredients" subtitle={selected.name}>
                {/* Recorded Ingredients */}
                <div className="space-y-4">
                  <h3 className="font-display text-sm font-bold text-brand-text">Recorded ingredients</h3>
                  {selected.riceRole === 'PAIR_WITH_RICE' && (
                    <p className="text-xs text-brand-muted">
                      Review rice pairing from {(selected.riceMinHalfCups ?? 1) / 2} to{' '}
                      {(selected.riceMaxHalfCups ?? 3) / 2} cups, in half-cup steps. Cup estimates use 150 g of cooked
                      rice; the saved grams and food record determine nutrition.
                    </p>
                  )}
                  {selected.riceRole === 'INCLUDES_RICE' && (
                    <p className="text-xs text-brand-muted">
                      Rice is already included. Do not add another rice component.
                    </p>
                  )}
                  <IngredientEvidenceTable ingredients={recordedIngredients(selected.ingredients)} />
                </div>

                <div className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00]/10 p-3.5 text-xs text-[#8c3b00] font-semibold leading-relaxed">
                  Verification confirms the base dish only. It does not certify nutrition amounts or permit use for a
                  health condition.
                </div>
              </ReviewDocumentPage>
            </RndQueueDocument>
          </div>
        )}
      </div>
    </section>
  );
}
