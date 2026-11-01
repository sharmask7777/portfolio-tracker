import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from './App';
import api, { API_ENDPOINTS } from './api';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    PORTFOLIO: '/api/portfolio',
    FAMILY: '/api/family',
    TAX: '/api/tax',
    AUTH: '/api/auth',
  },
}));

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    token: 'fake-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('./contexts/SettingsContext', () => ({
  useSettings: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    performanceMode: 'XIRR',
    setPerformanceMode: vi.fn(),
  }),
}));

vi.mock('./components/Dashboard/HistoryChart', () => ({
  HistoryChart: () => <div data-testid="mock-history-chart" />,
}));

vi.mock('./components/Dashboard/HistoricalHighlightsCard', () => ({
  HistoricalHighlightsCard: () => <div data-testid="mock-highlights-card" />,
}));

vi.mock('./components/Insights/InsightsSidebar', () => ({
  InsightsSidebar: () => <div data-testid="mock-insights-sidebar" />,
}));

vi.mock('./components/Insights/GoalTracker', () => ({
  GoalTracker: () => <div data-testid="mock-goal-tracker" />,
}));

describe('App Dashboard - Stock Intersection excludeArbitrage data flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches exposures with ?excludeArbitrage=false initially and passes excludeArbitrage state to IntersectionView', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `${API_ENDPOINTS.PORTFOLIO}/summary`) {
        return Promise.resolve({
          data: {
            id: 'port-123',
            name: 'Synthetic Test Portfolio',
            folios: [],
            metrics: {
              totalValue: 500000,
              totalInvested: 400000,
              totalGain: 100000,
              absReturn: 25,
              xirr: 15,
            },
          },
        });
      }
      if (url === `${API_ENDPOINTS.FAMILY}/profiles`) {
        return Promise.resolve({ data: [] });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-123/xray`) {
        return Promise.resolve({ data: { assetAllocation: { equity: 100, debt: 0, cash: 0, other: 0 } } });
      }
      if (url.startsWith(`${API_ENDPOINTS.PORTFOLIO}/port-123/exposures`)) {
        return Promise.resolve({
          data: [
            {
              name: 'Reliance Industries Ltd',
              sector: 'Energy',
              absoluteValue: 50000,
              percentage: 10,
              contributions: [{ schemeName: 'Equity Fund', value: 50000, weight: 10 }],
            },
          ],
        });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-123/tax-summary`) {
        return Promise.resolve({ data: { shortTerm: { gains: 0 }, longTerm: { gains: 0 } } });
      }
      if (url.startsWith(`${API_ENDPOINTS.TAX}/harvesting-opportunities`)) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.PORTFOLIO}/port-123/exposures?excludeArbitrage=false`
      );
    });

    // Switch to Stock Intersection tab
    const intersectionTab = screen.getByRole('button', { name: /Stock Intersection/i });
    fireEvent.click(intersectionTab);

    // Verify toggle checkbox is present and unchecked initially
    const toggle = await screen.findByRole('checkbox', { name: /exclude arbitrage/i });
    expect(toggle).not.toBeChecked();

    // Toggle excludeArbitrage to true
    fireEvent.click(toggle);

    // Verify exposures are re-fetched with ?excludeArbitrage=true
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.PORTFOLIO}/port-123/exposures?excludeArbitrage=true`
      );
    });

    // Toggle excludeArbitrage back to false
    fireEvent.click(toggle);

    // Verify exposures are re-fetched with ?excludeArbitrage=false
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.PORTFOLIO}/port-123/exposures?excludeArbitrage=false`
      );
    });
  });

  it('handles exposure refetch error gracefully on toggle without crashing', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `${API_ENDPOINTS.PORTFOLIO}/summary`) {
        return Promise.resolve({
          data: {
            id: 'port-456',
            name: 'Synthetic Resilience Portfolio',
            folios: [],
            metrics: {
              totalValue: 100000,
              totalInvested: 90000,
              totalGain: 10000,
              absReturn: 11,
              xirr: 10,
            },
          },
        });
      }
      if (url === `${API_ENDPOINTS.FAMILY}/profiles`) {
        return Promise.resolve({ data: [] });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-456/xray`) {
        return Promise.resolve({ data: { assetAllocation: { equity: 100, debt: 0, cash: 0, other: 0 } } });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-456/exposures?excludeArbitrage=false`) {
        return Promise.resolve({
          data: [
            {
              name: 'Infosys Ltd',
              sector: 'Technology',
              absoluteValue: 20000,
              percentage: 20,
              contributions: [{ schemeName: 'Tech Fund', value: 20000, weight: 20 }],
            },
          ],
        });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-456/exposures?excludeArbitrage=true`) {
        return Promise.reject(new Error('Network error on exposures refetch'));
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-456/tax-summary`) {
        return Promise.resolve({ data: { shortTerm: { gains: 0 }, longTerm: { gains: 0 } } });
      }
      if (url.startsWith(`${API_ENDPOINTS.TAX}/harvesting-opportunities`)) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Dashboard />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.PORTFOLIO}/port-456/exposures?excludeArbitrage=false`
      );
    });

    // Switch to Stock Intersection tab
    const intersectionTab = screen.getByRole('button', { name: /Stock Intersection/i });
    fireEvent.click(intersectionTab);

    const toggle = await screen.findByRole('checkbox', { name: /exclude arbitrage/i });
    expect(toggle).not.toBeChecked();

    // Toggle excludeArbitrage to true - API rejects
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `${API_ENDPOINTS.PORTFOLIO}/port-456/exposures?excludeArbitrage=true`
      );
    });

    // Console logged the error and component did not crash
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch exposures:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
