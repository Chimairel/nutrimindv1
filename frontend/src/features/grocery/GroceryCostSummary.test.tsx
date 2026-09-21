import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import GroceryCostSummary from './GroceryCostSummary';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const mockedGet = vi.mocked(api.get);

describe('GroceryCostSummary', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('renders unlocked details with covered subtotal when cost endpoint succeeds', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          amountMinCentavos: 15000,
          amountMaxCentavos: 18500,
          knownItemCount: 5,
          totalItemCount: 6,
          explanation: 'Indicative reference prices.',
          missingPrices: [],
          evidence: [],
        },
      },
    });

    render(<GroceryCostSummary revision="1" />);

    expect(await screen.findByText(/Shopping cost estimate/i)).toHaveTextContent('₱150.00–₱185.00 covered subtotal');
  });
  it('shows a neutral unavailable state for endpoint failures', async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 403, data: { code: 'REPORT_REQUIRED' } } });
    render(<GroceryCostSummary revision="1" />);
    expect(await screen.findByText('Price estimates are currently unavailable.')).toBeInTheDocument();
  });
  it('explains missing price configuration without displaying a zero-cost estimate', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          amountMinCentavos: null,
          amountMaxCentavos: null,
          knownItemCount: 0,
          totalItemCount: 3,
          availabilityReason: 'PRICE_DATA_NOT_CONFIGURED',
          explanation: 'Market prices have not been published in this system yet.',
          missingPrices: [],
          evidence: [],
        },
      },
    });
    render(<GroceryCostSummary revision="1" />);
    expect(await screen.findByText(/Price data not configured/)).toBeInTheDocument();
    expect(screen.queryByText(/₱0.00/)).not.toBeInTheDocument();
  });
});
