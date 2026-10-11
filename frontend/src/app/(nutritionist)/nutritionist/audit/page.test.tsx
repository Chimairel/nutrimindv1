import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NutritionistAuditPage from './page';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'reviewer' } }) }));

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/features/nutritionist-reviews/useReviewWorkCounts', () => ({
  useReviewWorkCounts: () => ({ meal: 1, case: 2, profile: 3, audit: 125 }),
}));
vi.mock('../reviews/GovernanceQueuePanel', () => ({
  default: ({ tab }: { tab: string }) => <div data-testid="recheck-queue">{tab}</div>,
}));

describe('RND audit page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionResourceCache();
    mocks.get.mockImplementation((_path: string, options: { params: { page: number } }) =>
      Promise.resolve({
        data: {
          success: true,
          data: {
            rows: [
              {
                id: `row-${options.params.page}`,
                occurredAt: '2026-09-29T00:00:00.000Z',
                nutritionist: 'Andrea Reyes',
                actor: 'Andrea Reyes',
                role: 'NUTRITIONIST',
                action: 'Flagged a meal',
                subject: 'Basilog',
                outcome: 'Needs attention',
              },
            ],
            page: options.params.page,
            total: 21,
            totalPages: 2,
          },
        },
      })
    );
  });

  it('shows review history across RNDs, pages results, and opens flagged approvals', async () => {
    render(<NutritionistAuditPage />);
    expect(await screen.findByText('Andrea Reyes')).toBeInTheDocument();
    expect(screen.getByText('Flagged a meal')).toBeInTheDocument();
    expect(screen.getByText('Basilog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('/nutritionist/audit-history', { params: { page: 2, limit: 20 } })
    );
    expect(await screen.findByText(/Page 2 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Flagged approvals.*99\+/ }));
    expect(screen.getByTestId('recheck-queue')).toHaveTextContent('audit');
  });
  it('resets to page one and requests only the signed-in reviewer with Me', async () => {
    render(<NutritionistAuditPage />);
    await screen.findByText('Andrea Reyes');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(/Page 2 of 2/);
    fireEvent.click(screen.getByRole('combobox', { name: 'Staff filter' }));
    fireEvent.click(screen.getByRole('option', { name: 'Me' }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('/nutritionist/audit-history', {
        params: { page: 1, limit: 20, mine: 'true' },
      })
    );
    expect(screen.getByRole('link', { name: 'Reviewed plans' })).toHaveAttribute('href', '/nutritionist/approved');
  });
});
