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

let mockRealityCheckMode = false;
let mockCpiInflationRate = 0.06;
let mockMarginalTaxBracket = 0.30;

vi.mock('./contexts/SettingsContext', () => ({
  useSettings: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    performanceMode: 'XIRR',
    setPerformanceMode: vi.fn(),
    realityCheckMode: mockRealityCheckMode,
    setRealityCheckMode: vi.fn((val: boolean) => {
      mockRealityCheckMode = val;
    }),
    cpiInflationRate: mockCpiInflationRate,
    setCpiInflationRate: vi.fn((val: number) => {
      mockCpiInflationRate = val;
    }),
    marginalTaxBracket: mockMarginalTaxBracket,
    setMarginalTaxBracket: vi.fn((val: number) => {
      mockMarginalTaxBracket = val;
    }),
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
    mockRealityCheckMode = false;
    mockCpiInflationRate = 0.06;
    mockMarginalTaxBracket = 0.30;
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

  it('switches to stock intersection tab with pre-filled search when inspecting from XRayView', async () => {
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
        return Promise.resolve({
          data: {
            totalValue: 500000,
            assetAllocation: {
              equity: { value: 350000, percentage: 70 },
              debt: { value: 150000, percentage: 30 },
              cash: { value: 0, percentage: 0 },
              gold: { value: 0, percentage: 0 },
              other: { value: 0, percentage: 0 },
            },
            marketCap: {
              large: { value: 250000, percentage: 50 },
              mid: { value: 100000, percentage: 20 },
              small: { value: 0, percentage: 0 },
            },
            sectors: [{ name: 'Financial Services', value: 350000, percentage: 70 }],
          },
        });
      }
      if (url.startsWith(`${API_ENDPOINTS.PORTFOLIO}/port-123/exposures`)) {
        return Promise.resolve({
          data: [
            {
              name: 'HDFC Bank Ltd.',
              sector: 'Financial Services',
              absoluteValue: 150000,
              percentage: 30,
              contributions: [{ schemeName: 'Equity Fund', value: 150000, weight: 30 }],
            },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<Dashboard />);

    // Switch to X-Ray tab
    const xrayTab = await screen.findByRole('button', { name: /Portfolio X-Ray/i });
    fireEvent.click(xrayTab);

    // Drill into Equity in Treemap
    const equityTile = await screen.findByRole('button', { name: /Equity/i });
    fireEvent.click(equityTile);

    // Drill into Financial Services
    const finTile = await screen.findByRole('button', { name: /Financial Services/i });
    fireEvent.click(finTile);

    // Click HDFC Bank Ltd. tile
    const stockTile = await screen.findByRole('button', { name: /HDFC Bank Ltd\./i });
    fireEvent.click(stockTile);

    // Drawer opens
    const inspectBtn = await screen.findByRole('button', { name: /Inspect in Stock Intersection/i });
    fireEvent.click(inspectBtn);

    // Verify it switched to Intersection tab and search input contains "HDFC Bank Ltd."
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search stocks, sectors, or funds/i);
      expect(searchInput).toHaveValue('HDFC Bank Ltd.');
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

  describe('Reality Check Mode & Scheme Holdings Table Reaction', () => {
    it('switches table headers to Net Realizable Value and displays Nominal badge', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `${API_ENDPOINTS.PORTFOLIO}/summary`) {
          return Promise.resolve({
            data: {
              id: 'port-reality-1',
              name: 'Reality Portfolio',
              folios: [
                {
                  id: 'folio-d1',
                  number: 'F-101',
                  pan: 'ABCDE1234F',
                  schemeName: 'HDFC Corporate Bond Fund',
                  schemeType: 'DEBT',
                  asset: {
                    name: 'HDFC Corporate Bond Fund',
                    type: 'DEBT',
                  },
                  amcCode: 'HDFC',
                  metrics: {
                    investedAmount: 100000,
                    currentValue: 106000,
                    dayChange: 50,
                    dayChangePercentage: 0.05,
                    xirr: 0.06, // 6% nominal yield
                    absoluteReturn: 0.06,
                    postTaxXirr: 0.042,
                    postTaxAbsoluteReturn: 0.042,
                    netRealizableValue: 104200,
                  },
                },
              ],
              metrics: {
                totalValue: 106000,
                totalInvested: 100000,
                totalGain: 6000,
                absReturn: 6,
                xirr: 6,
                postTaxTotalValue: 104200,
                realPostTaxXirr: -0.015,
                drags: {
                  nominalXirr: 0.06,
                  debtDrag: 0.018,
                  equityDrag: 0,
                  cessDrag: 0.001,
                  inflationDrag: 0.056,
                  realPostTaxXirr: -0.015,
                  benchmarkSpread: -0.025,
                },
              },
            },
          });
        }
        if (url === `${API_ENDPOINTS.FAMILY}/profiles`) {
          return Promise.resolve({ data: [] });
        }
        if (url.startsWith(`${API_ENDPOINTS.PORTFOLIO}/port-reality-1/`)) {
          return Promise.resolve({ data: {} });
        }
        if (url.startsWith(`${API_ENDPOINTS.TAX}/harvesting-opportunities`)) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: {} });
      });

      const { rerender } = render(<Dashboard />);

      // Initially Broker View
      await waitFor(() => {
        expect(screen.getByText('Current Value')).toBeInTheDocument();
      });

      // Click Reality Check switch in StatsGrid
      const realityToggle = screen.getByRole('button', { name: /Reality Check/i });
      fireEvent.click(realityToggle);

      // Re-render to reflect new mock state
      rerender(<Dashboard />);

      // Verify table header changed to Net Realizable Value
      await waitFor(() => {
        expect(screen.getByText('Net Realizable Value')).toBeInTheDocument();
      });

      // Verify "Nominal" badge is rendered next to scheme XIRR
      expect(screen.getByText('Nominal')).toBeInTheDocument();

      // Verify negative real return indicator dot is rendered on the debt scheme
      const dot = screen.getByTitle(/Negative real return/i);
      expect(dot).toBeInTheDocument();
    });
  });
});
