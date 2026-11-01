import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HistoricalHighlightsCard } from './HistoricalHighlightsCard';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
  },
  API_ENDPOINTS: {
    PORTFOLIO: '/api/portfolio',
  },
}));

describe('HistoricalHighlightsCard Component', () => {
  it('displays loading initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<HistoricalHighlightsCard portfolioId="p-123" />);
    expect(screen.getByText('Loading highlights...')).toBeInTheDocument();
  });

  it('renders stats when API succeeds', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        ath: { value: 1500000, date: '2024-03-15T00:00:00Z' },
        maxInvested: { value: 1200000, date: '2024-02-10T00:00:00Z' },
        yearly: [
          {
            year: 2024,
            ath: { value: 1500000, date: '2024-03-15T00:00:00Z' },
            maxInvested: { value: 1200000, date: '2024-02-10T00:00:00Z' },
          },
        ],
      },
    });

    render(<HistoricalHighlightsCard portfolioId="p-123" />);

    await waitFor(() => {
      expect(screen.getByText('Historical Highlights')).toBeInTheDocument();
      expect(screen.getByText('All-Time High Corpus')).toBeInTheDocument();
      expect(screen.getByText('Maximum Invested')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
    });
  });

  it('displays error message when API fails', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    render(<HistoricalHighlightsCard portfolioId="p-123" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load historical highlights.')).toBeInTheDocument();
    });
  });
});
