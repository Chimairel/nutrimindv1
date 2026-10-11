import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import FoodCatalogue from './FoodCatalogue';
import type { FoodPage } from './types';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'catalogue-admin' } }) }));
const food = {
  id: 'rice',
  name: 'Rice, white, boiled',
  source: 'FNRI',
  calories: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
  aliases: [],
};
const pageData = { foods: [food], total: 1537, page: 1, limit: 12, totalPages: 129 };
const response = (data: FoodPage = pageData) => ({ data: { success: true, data } });
describe('separate food catalogues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionResourceCache();
    mocks.get.mockResolvedValue(response());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  it('loads only FNRI records and renders actual nutrient values and pagination', async () => {
    render(<FoodCatalogue source="FNRI" onChanged={vi.fn()} onError={vi.fn()} />);
    expect(await screen.findByText(/130 kcal/)).toBeInTheDocument();
    expect(screen.getByText('1,537 matching records')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 129')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/data/foods', {
      params: { source: 'FNRI', page: 1, limit: 12, search: undefined },
    });
    expect(screen.getByRole('button', { name: 'Composition' })).toBeInTheDocument();
  });
  it('requests USDA records and exposes provenance and aliases with read-only nutrition', async () => {
    mocks.get.mockResolvedValue(
      response({
        ...pageData,
        foods: [
          {
            ...food,
            source: 'USDA_FDC',
            sourceRecordId: '2710186',
            sourceDataset: 'Foundation Foods',
            sourceReferenceUrl: 'https://fdc.nal.usda.gov/food-search/?query=2710186',
          },
        ],
      })
    );
    const user = userEvent.setup();
    render(<FoodCatalogue source="USDA_FDC" onChanged={vi.fn()} onError={vi.fn()} />);
    expect(await screen.findByText(/ID 2710186/)).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/data/foods', {
      params: { source: 'USDA_FDC', page: 1, limit: 12, search: undefined },
    });
    expect(screen.queryByRole('button', { name: 'Composition' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View source record' })).toHaveAttribute(
      'href',
      'https://fdc.nal.usda.gov/food-search/?query=2710186'
    );
    await user.click(screen.getByRole('button', { name: 'Add alias' }));
    expect(screen.getByRole('region', { name: 'Add a verified alias for Rice, white, boiled' })).toBeInTheDocument();
  });
  it('retains USDA source, applied search and current page during live refresh', async () => {
    const user = userEvent.setup();
    render(<FoodCatalogue source="USDA_FDC" onChanged={vi.fn()} onError={vi.fn()} />);
    await screen.findByText(/130 kcal/);
    await user.type(screen.getByRole('textbox', { name: 'Search USDA catalogue' }), 'rice');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith('/admin/data/foods', {
        params: { source: 'USDA_FDC', page: 1, limit: 12, search: 'rice' },
      })
    );
    mocks.get.mockResolvedValue(response({ ...pageData, page: 2 }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 129');
    await user.type(screen.getByRole('textbox', { name: 'Search USDA catalogue' }), ' unsaved');
    act(() => window.dispatchEvent(new Event(LIVE_UPDATE_EVENT)));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith('/admin/data/foods', {
        params: { source: 'USDA_FDC', page: 2, limit: 12, search: 'rice' },
      })
    );
    expect(screen.getByRole('textbox', { name: 'Search USDA catalogue' })).toHaveValue('rice unsaved');
    expect(screen.getByText('Page 2 of 129')).toBeInTheDocument();
  });
  it('shows empty and failure states without displaying a different source', async () => {
    mocks.get.mockResolvedValue(response({ ...pageData, foods: [], total: 0, totalPages: 0 }));
    render(<FoodCatalogue source="USDA_FDC" onChanged={vi.fn()} onError={vi.fn()} />);
    expect(await screen.findByText('No USDA records match this search.')).toBeInTheDocument();
    mocks.get.mockRejectedValue(new Error('Snapshot unavailable'));
    act(() => window.dispatchEvent(new Event(LIVE_UPDATE_EVENT)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the USDA catalogue.');
    expect(screen.queryByText(food.name)).not.toBeInTheDocument();
  });
});

it('gives RNDs a read-only catalogue, preserving zero and unknown nutrients', async () => {
  mocks.get.mockResolvedValue(response({ ...pageData, foods: [{ ...food, sodium: 0, sugar: null }] }));
  render(<FoodCatalogue source="FNRI" readOnly />);
  await screen.findByText(/130 kcal/);
  expect(mocks.get).toHaveBeenCalledWith('/nutritionist/food-catalogue', {
    params: { source: 'FNRI', page: 1, limit: 12, search: undefined },
  });
  expect(screen.getByText('0 mg')).toBeInTheDocument();
  expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Composition' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add alias' })).not.toBeInTheDocument();
  expect(mocks.post).not.toHaveBeenCalled();
});
