import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NutritionReportWorkspace from './NutritionReportWorkspace';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn(), refresh: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
// Return a new user object on every render to detect fetch loops caused by session identity.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test-user', name: 'Tester' },
    refreshSession: mocks.refresh,
    updateUserSession: mocks.update,
  }),
}));
vi.mock('@/features/reports/ReportHistory', () => ({ default: () => <div>Report archive</div> }));

const report = {
  version: 3,
  generatedAt: '2026-09-16T00:00:00Z',
  isStale: false,
  acknowledgedAt: null,
  basedOnConditions: [],
  basedOnAllergies: [],
  generalSummary: 'Current guidance',
  foodsToAvoid: [],
  foodsToLimit: [],
  foodsRecommended: [],
  drinksGuidance: [],
};
const result = (data: unknown) => ({ data: { success: true, data } });

describe('nutrition report lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/profile/nutrition-report');
    mocks.get.mockImplementation(async (path: string) =>
      result(
        path === '/user/profile'
          ? {
              name: 'Tester',
              userProfile: { goal: 'MAINTAIN', dailyCalorieTarget: 2000 },
              healthConditions: [],
              allergies: [],
            }
          : path.endsWith('/history')
            ? []
            : report
      )
    );
    mocks.post.mockResolvedValue(result(report));
    mocks.refresh.mockResolvedValue({ reportAcknowledged: true });
  });
  it('loads once despite session object changes, acknowledges the displayed version and returns to profile', async () => {
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'I Acknowledge Report' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/profile'));
    expect(mocks.post).toHaveBeenCalledWith('/user/nutrition-report/acknowledge', { version: 3 });
    expect(mocks.get.mock.calls.filter(([path]) => path === '/user/nutrition-report')).toHaveLength(1);
  });
  it('continues an explicit regeneration request only after acknowledgment succeeds', async () => {
    window.history.replaceState({}, '', '/profile/nutrition-report?next=regenerate');
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'I Acknowledge Report' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/meals?regenerate=true'));
  });
  it('continues first-time onboarding to the dashboard only after acknowledgment succeeds', async () => {
    window.history.replaceState({}, '', '/nutrition-report?next=dashboard');
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'I Acknowledge Report' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
  });
  it('does not generate a new report when reading the existing report fails', async () => {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) =>
      path === '/user/nutrition-report' ? Promise.reject(new Error('offline')) : get(path)
    );
    render(<NutritionReportWorkspace />);
    await screen.findByText('Report Resolution Failed');
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('refreshes a stale report before presenting acknowledgment', async () => {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) =>
      path === '/user/nutrition-report' ? Promise.resolve(result({ ...report, isStale: true })) : get(path)
    );
    render(<NutritionReportWorkspace />);
    await screen.findByRole('button', { name: 'I Acknowledge Report' });
    expect(mocks.post).toHaveBeenCalledWith('/user/nutrition-report/generate');
  });
  it('does not navigate if the refreshed session cannot confirm acknowledgment', async () => {
    mocks.refresh.mockResolvedValue(null);
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'I Acknowledge Report' }));
    await screen.findByText(/Unable to confirm the current report status/);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
