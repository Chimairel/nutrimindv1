import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showPendingReviewNoticeOnce, showStarterPlanNoticeOnce } from './plan-status-notice';

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@/components/ui/Sonner', () => ({ toast: { info } }));

describe('plan status notices', () => {
  beforeEach(() => {
    info.mockClear();
    window.sessionStorage.clear();
  });

  it('shows the same cycle notice once across Home and Meals, then allows a new cycle', () => {
    const currentCycle = {
      id: 'cycle-a', planType: 'WEEKLY', startDate: '2026-09-28', endDate: '2026-10-04',
    };
    const pending = { planType: 'WEEKLY', meals: [{ scheduledDate: '2026-09-28T04:00:00.000Z' }] };
    showPendingReviewNoticeOnce({ userId: 'notice-test-1', pending, currentCycle, upcomingCycle: null });
    showPendingReviewNoticeOnce({ userId: 'notice-test-1', pending, currentCycle, upcomingCycle: null, upcomingOnly: true });
    showPendingReviewNoticeOnce({
      userId: 'notice-test-1',
      pending: { ...pending, meals: [{ scheduledDate: '2026-09-30T04:00:00.000Z' }] },
      currentCycle,
      upcomingCycle: null,
    });
    expect(info).toHaveBeenCalledTimes(1);

    showPendingReviewNoticeOnce({
      userId: 'notice-test-1',
      pending: { ...pending, meals: [{ scheduledDate: '2026-10-05T04:00:00.000Z' }] },
      currentCycle: null,
      upcomingCycle: { id: 'cycle-b', planType: 'WEEKLY', startDate: '2026-10-05', endDate: '2026-10-11' },
    });
    expect(info).toHaveBeenCalledTimes(2);
  });

  it('does not repeat a starter plan notice when moving between pages', () => {
    const input = {
      userId: 'notice-test-2',
      isStarterPlan: true,
      nextCycleDay: 'Monday, Oct 5',
      currentCycle: { id: 'starter-a', startDate: '2026-10-01', endDate: '2026-10-04' },
    };
    showStarterPlanNoticeOnce(input);
    showStarterPlanNoticeOnce(input);
    expect(info).toHaveBeenCalledTimes(1);
  });
});
