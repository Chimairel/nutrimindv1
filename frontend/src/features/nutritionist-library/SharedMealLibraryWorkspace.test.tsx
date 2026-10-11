import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import SharedMealLibraryWorkspace from './SharedMealLibraryWorkspace';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  hook: vi.fn(),
  refresh: vi.fn(),
  loading: vi.fn(() => 'notice'),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: mocks }));
vi.mock('./LibrarySafetyReview', () => ({ default: () => <div>Clinical evidence editor</div> }));
vi.mock('./RecipeDerivationForm', () => ({
  default: ({ correctionVersion }: { correctionVersion?: string }) => (
    <div>{correctionVersion ? 'Held recipe correction editor' : 'Recipe derivation editor'}</div>
  ),
}));
vi.mock('./MealApprovalsPanel', () => ({ MealApprovalsPanel: () => <div>Private case approvals</div> }));
vi.mock('./useNutritionistLibrary', () => ({ AVAILABLE_CONDITIONS: [], useNutritionistLibrary: mocks.hook }));

const meal = {
  id: 'meal-1',
  mealName: 'Test lunch',
  mealType: 'LUNCH',
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  status: 'APPROVED',
  ingredients: [],
  usageCount: 0,
  flags: [],
  baseVerification: 'VERIFIED',
};
let review = {
  state: 'PUBLISHED',
  recipeVersion: 'a'.repeat(64),
  reviewVersion: 'b'.repeat(64),
  incidentCount: 0,
  legacyHistoryUnknown: false,
  incident: null as null | {
    id: string;
    number: number;
    state: string;
    reports: unknown[];
    decisions: unknown[];
    claimedByNutritionistId: null;
  },
  history: [] as unknown[],
  validConfirmations: [] as unknown[],
  canAdminRelease: false,
};
function held(state = 'PENDING_REREVIEW') {
  review = {
    ...review,
    state,
    incidentCount: state === 'QUARANTINED' ? 2 : 1,
    incident: {
      id: 'case-1',
      number: 1,
      state,
      claimedByNutritionistId: null,
      decisions: [],
      reports: [
        {
          id: 'report-1',
          createdAt: '2026-10-08T00:00:00Z',
          actorSnapshot: { name: 'Test admin', role: 'ADMIN' },
          notes: {
            category: 'NUTRITION',
            affectedFields: ['sodiumMg'],
            explanation: 'Ingredient evidence needs independent review.',
            reference: 'Recorded composition evidence.',
            proposedCorrection: 'Check all measured ingredient amounts.',
          },
        },
      ],
    },
  };
}
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'synthetic-library-owner' } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  clearSessionResourceCache();
  review = {
    ...review,
    state: 'PUBLISHED',
    incident: null,
    history: [],
    validConfirmations: [],
    canAdminRelease: false,
    incidentCount: 0,
  };
  mocks.hook.mockReturnValue({
    meals: [meal],
    totalCount: 1,
    page: 1,
    setPage: vi.fn(),
    totalPages: 1,
    isLoading: false,
    fetchError: null,
    coverage: null,
    searchVal: '',
    setSearchVal: vi.fn(),
    mealType: 'All',
    setMealType: vi.fn(),
    conditionTag: 'All',
    setConditionTag: vi.fn(),
    verifiedByMe: false,
    setVerifiedByMe: vi.fn(),
    adminDraftsOnly: false,
    setAdminDraftsOnly: vi.fn(),
    status: 'ALL',
    setStatus: vi.fn(),
    fetchLibrary: mocks.refresh,
  });
  mocks.get.mockImplementation(async (path: string) => ({
    data: {
      success: true,
      data: path.endsWith('/meal-review-cases')
        ? []
        : path.includes('/meal-review-cases/')
          ? review
          : {
              ...meal,
              status: review.state === 'PUBLISHED' ? 'APPROVED' : 'FLAGGED',
              reviewLineage: { state: review.state, incidentCount: review.incidentCount },
            },
    },
  }));
  mocks.post.mockResolvedValue({ data: { success: true } });
});

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  await screen.findByRole('region', { name: 'Meal details' });
}

function fillFlag() {
  fireEvent.change(screen.getByLabelText('Affected ingredients or nutrition fields, separated by commas'), {
    target: { value: 'sodiumMg, salt' },
  });
  fireEvent.change(screen.getByLabelText('Explanation'), {
    target: { value: 'Ingredient evidence needs independent review.' },
  });
  fireEvent.change(screen.getByLabelText('Supporting evidence or reference'), {
    target: { value: 'Recorded composition evidence.' },
  });
  fireEvent.change(screen.getByLabelText('Proposed correction'), {
    target: { value: 'Check all measured ingredient amounts.' },
  });
}
describe('shared library permissions and feedback', () => {
  it('admin flags with version-bound structured notes and sees the recorded actor without RND certification tools', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    expect(mocks.hook).toHaveBeenCalledWith(false, 'admin', true);
    await open();
    await screen.findByText('Published');
    expect(screen.queryByText('Clinical evidence editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Private case approvals')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flag and withhold recipe' })).toBeDisabled();
    fillFlag();
    mocks.post.mockImplementation(async () => {
      held();
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold recipe' }));
    await screen.findByText(/NUTRITION.*Test admin/);
    expect(mocks.post).toHaveBeenCalledWith('/admin/library/meal-1/flag', {
      expectedVersion: 'a'.repeat(64),
      notes: {
        category: 'NUTRITION',
        affectedFields: ['sodiumMg', 'salt'],
        explanation: 'Ingredient evidence needs independent review.',
        reference: 'Recorded composition evidence.',
        proposedCorrection: 'Check all measured ingredient amounts.',
      },
    });
    expect(screen.queryByRole('button', { name: 'Confirm this version' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release quarantine' })).toBeDisabled();
  });
  it('RND review requires every concern resolution and evidence acknowledgement; one RND re-verifies the first incident', async () => {
    held('PENDING_REREVIEW');
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByText(/NUTRITION.*Test admin/);
    expect(screen.getByText('Clinical evidence editor')).toBeInTheDocument();
    expect(screen.queryByText('Recipe derivation editor')).not.toBeInTheDocument();
    expect(screen.getByText('Held recipe correction editor')).toBeInTheDocument();
    const header = screen.getByRole('heading', { name: 'Test lunch', level: 1 }).closest('header')!;
    expect(within(header).getByText('Pending re-review')).toBeInTheDocument();
    expect(within(header).queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.getByText('Private case approvals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Release quarantine' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Resolution of this concern'), {
      target: { value: 'Resolved by reviewing measured food amounts and recorded evidence.' },
    });
    fireEvent.change(screen.getByLabelText('Independent review findings'), {
      target: { value: 'Independent review covers this exact serving and every concern.' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Claim re-review' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/nutritionist/meal-review-cases/meal-1/claim', {
        expectedVersion: 'b'.repeat(64),
      })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-verify recipe' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Re-verify recipe' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/nutritionist/meal-review-cases/meal-1/confirm',
        expect.objectContaining({
          expectedVersion: 'b'.repeat(64),
          evidenceReviewed: true,
          riceRoleReviewed: true,
          resolutions: [
            { reportId: 'report-1', rationale: 'Resolved by reviewing measured food amounts and recorded evidence.' },
          ],
        })
      )
    );
  });
  it('admin can decide quarantine with a rationale and no RND confirmations', async () => {
    held('QUARANTINED');
    review.canAdminRelease = true;
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText(/Only an admin can release/);
    expect(screen.getByRole('button', { name: 'Release quarantine' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Administrative rationale'), {
      target: { value: 'Reviewed this current version and all recorded quarantine concerns.' },
    });
    expect(screen.getByRole('button', { name: 'Release quarantine' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Release quarantine' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/admin/meal-review-cases/meal-1/release', {
        expectedVersion: 'b'.repeat(64),
        rationale: 'Reviewed this current version and all recorded quarantine concerns.',
      })
    );
  });
  it('quarantine needs an admin decision and offers no RND confirmation or claim', async () => {
    held('QUARANTINED');
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByText(/NUTRITION.*Test admin/);
    expect(screen.getByText(/Only an admin can release/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim re-review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-verify recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release quarantine' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resolution of this concern')).not.toBeInTheDocument();
  });
  it('retains comprehensive flag notes when the server rejects a stale version', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText('Published');
    fillFlag();
    mocks.post.mockRejectedValue({
      response: { data: { error: 'Recipe or concerns changed. Refresh and review the current version.' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold recipe' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Explanation')).toHaveValue('Ingredient evidence needs independent review.');
    expect(screen.getByLabelText('Supporting evidence or reference')).toHaveValue('Recorded composition evidence.');
  });

  it('keeps one matching derivation editor across flag, re-verification and quarantine updates', async () => {
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByText('Published');
    expect(screen.getAllByText('Recipe derivation editor')).toHaveLength(1);
    fillFlag();
    mocks.post.mockImplementation(async () => {
      held();
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold recipe' }));
    await screen.findByText('Held recipe correction editor');
    await waitFor(() => expect(screen.queryByText('Recipe derivation editor')).not.toBeInTheDocument());
    const header = screen.getByRole('heading', { name: 'Test lunch', level: 1 }).closest('header')!;
    expect(within(header).getByText('Pending re-review')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Resolution of this concern'), {
      target: { value: 'All recorded ingredient evidence has been independently checked.' },
    });
    fireEvent.change(screen.getByLabelText('Independent review findings'), {
      target: { value: 'The measured recipe resolves every recorded concern.' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    mocks.post.mockImplementation(async () => {
      review = { ...review, state: 'PUBLISHED', incident: null };
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-verify recipe' }));
    await screen.findByText('Recipe derivation editor');
    await waitFor(() => expect(screen.queryByText('Held recipe correction editor')).not.toBeInTheDocument());
    expect(screen.getAllByText('Recipe derivation editor')).toHaveLength(1);

    mocks.post.mockImplementation(async () => {
      held('QUARANTINED');
      return { data: { success: true } };
    });
    fillFlag();
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold recipe' }));
    await screen.findByText('Held recipe correction editor');
    await waitFor(() => expect(screen.queryByText('Recipe derivation editor')).not.toBeInTheDocument());
    expect(screen.getAllByText('Held recipe correction editor')).toHaveLength(1);
    expect(within(header).getByText('Quarantined')).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Meal-wide review' })).toHaveLength(1);
  });
  it('keeps a recorded decision visible when the later history refresh fails', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText('Published');
    fillFlag();
    mocks.post.mockImplementation(async () => {
      mocks.get.mockRejectedValue(new Error('Network unavailable'));
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold recipe' }));
    await screen.findByText(/Decision recorded/);
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});
