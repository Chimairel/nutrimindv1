import { toast } from '@/components/ui/Sonner';
import { getManilaDateKey } from '@/lib/manila-date';

type NoticeCycle = {
  id?: string;
  planType?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
} | null;

type PendingPreview = {
  planType: string;
  meals: Array<{ scheduledDate: string }>;
} | null;

const shownNotices = new Set<string>();

function showOnce(userId: string | undefined, kind: string, cycleKey: string, message: string) {
  if (!userId || !cycleKey) return;
  const key = `nutrimind:plan-notice:${userId}:${kind}:${cycleKey}`;
  if (shownNotices.has(key)) return;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, 'shown');
  } catch {
    // An in-memory guard still prevents repeated notices when storage is unavailable.
  }
  shownNotices.add(key);
  toast.info(message, { id: key });
}

function pendingCycleKey(pending: NonNullable<PendingPreview>, cycles: readonly NoticeCycle[]): string {
  const pendingDates = pending.meals.map((meal) => getManilaDateKey(meal.scheduledDate)).sort();
  const matchingCycle = cycles.find((cycle) =>
    cycle?.startDate && cycle.endDate && pendingDates.some((date) =>
      date >= getManilaDateKey(cycle.startDate!) && date <= getManilaDateKey(cycle.endDate!)
    )
  );
  if (matchingCycle?.id) return matchingCycle.id;
  if (matchingCycle?.startDate) return `${matchingCycle.planType ?? pending.planType}:${getManilaDateKey(matchingCycle.startDate)}`;
  return `${pending.planType}:${pendingDates[0] ?? 'unknown'}`;
}

export function showPendingReviewNoticeOnce(input: {
  userId?: string;
  pending: PendingPreview;
  currentCycle: NoticeCycle;
  upcomingCycle: NoticeCycle;
  upcomingOnly?: boolean;
}) {
  if (!input.pending) return;
  showOnce(
    input.userId,
    'pending-review',
    pendingCycleKey(input.pending, [input.currentCycle, input.upcomingCycle]),
    input.upcomingOnly
      ? 'Your upcoming week is being prepared. These are previews until nutritionist review is complete.'
      : 'Your meal plan is currently in preview while a nutritionist verifies it.'
  );
}

export function showStarterPlanNoticeOnce(input: {
  userId?: string;
  isStarterPlan: boolean;
  nextCycleDay: string | null;
  currentCycle: NoticeCycle;
}) {
  if (!input.isStarterPlan || !input.nextCycleDay) return;
  const cycleKey = input.currentCycle?.id ||
    (input.currentCycle?.startDate ? getManilaDateKey(input.currentCycle.startDate) : input.nextCycleDay);
  showOnce(input.userId, 'starter-plan', cycleKey,
    `You're on a starter plan. Your full 7-day cycle begins on ${input.nextCycleDay}.`);
}
