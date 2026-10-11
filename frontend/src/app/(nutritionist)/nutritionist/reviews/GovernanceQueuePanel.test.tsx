import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GovernanceQueuePanel from './GovernanceQueuePanel';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (path: string) => ({
    data: {
      data: path.includes('governance')
        ? {
            clearances: [
              {
                id: 'flagged',
                mealLibraryId: 'recipe',
                condition: 'DIABETES',
                assuranceTier: 'ENHANCED',
                state: 'SUSPENDED',
                mealLibrary: { mealName: 'Tinola' },
              },
            ],
          }
        : [],
    },
  }));
  api.post.mockResolvedValue({ data: { success: true } });
});

it('rechecks flagged evidence without exposing legacy dispute adjudication', async () => {
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Checked the exact recorded approval evidence.');
  try {
    render(<GovernanceQueuePanel tab="audit" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recheck' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/nutritionist/library/recipe/approvals/flagged/recheck', {
        kind: 'CONDITION',
        rationale: 'Checked the exact recorded approval evidence.',
      })
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/nutritionist/governance/queue?view=audit');
  } finally {
    prompt.mockRestore();
  }
});
