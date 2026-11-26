import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboardData } from './useDashboardData';
import api, { API_ENDPOINTS } from './api';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
  API_ENDPOINTS: {
    PORTFOLIO: '/api/portfolio',
    FAMILY: '/api/family',
    TAX: '/api/tax',
  },
}));

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === `${API_ENDPOINTS.PORTFOLIO}/summary`) {
        return Promise.resolve({
          data: { id: 'port-1', name: 'Test', folios: [], metrics: {} },
        });
      }
      if (url === `${API_ENDPOINTS.FAMILY}/profiles`) {
        return Promise.resolve({ data: [] });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-1/xray`) {
        return Promise.resolve({ data: null });
      }
      if (url.startsWith(`${API_ENDPOINTS.PORTFOLIO}/port-1/exposures`)) {
        return Promise.resolve({ data: [] });
      }
      if (url === `${API_ENDPOINTS.PORTFOLIO}/port-1/tax-summary`) {
        return Promise.resolve({
          data: { realized: { sec112aExemption: 0, sec112aExemptionLimit: 125000 }, details: [] },
        });
      }
      if (url.startsWith(`${API_ENDPOINTS.TAX}/harvesting-opportunities`)) {
        return Promise.resolve({ data: null });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('passes taxSlab on initial tax-summary fetch and re-fetches with fy and taxSlab when selectedTaxFY changes', async () => {
    const { result } = renderHook(() =>
      useDashboardData({
        selectedFamilyId: null,
        selectedProfileId: null,
        cpiInflationRate: 0.06,
        marginalTaxBracket: 0.2,
        excludeArbitrage: false,
        onResetScopeIfMissing: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.portfolio?.id).toBe('port-1');
    });

    expect(api.get).toHaveBeenCalledWith(`${API_ENDPOINTS.PORTFOLIO}/port-1/tax-summary`, {
      params: { taxSlab: 0.2 },
      signal: expect.any(AbortSignal),
    });

    act(() => {
      result.current.setSelectedTaxFY('2024-25');
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`${API_ENDPOINTS.PORTFOLIO}/port-1/tax-summary`, {
        params: { fy: '2024-25', taxSlab: 0.2 },
      });
    });

    act(() => {
      result.current.setSelectedTaxFY('2025-26');
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`${API_ENDPOINTS.PORTFOLIO}/port-1/tax-summary`, {
        params: { fy: '2025-26', taxSlab: 0.2 },
      });
    });
  });
});
