import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { SimulationSellResponse } from '../types/generated/SimulationSellResponse';
import type { RealizedGain } from '../types/generated/RealizedGain';
import type { SimulationLot } from './tax-types';

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string): Promise<void> => {
    mockStorage.delete(key);
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { simulateWithdrawal, SimulationBackendError } from './tax-simulation-service';

function createMockRealizedGain(overrides: Partial<RealizedGain> = {}): RealizedGain {
  return {
    assetName: 'HDFC Top 100 Fund',
    folioNumber: 'FOLIO-123',
    isin: 'INF179K01BE2',
    pan: 'ABCDE1234F',
    assetClass: 'Equity',
    section: 'Sec112A12_5',
    buyDate: '2023-01-15',
    sellDate: '2026-11-23',
    holdingPeriodDays: 1408,
    holdingType: 'LongTerm',
    units: 50,
    buyNav: 90,
    sellNav: 120,
    grossConsideration: 6000,
    costOfAcquisition: 4500,
    fmvAsOfJan312018: 0,
    totalFmvJan312018: 0,
    deemedCostOfAcquisition: 4500,
    transferExpenses: 0,
    gain: 1500,
    taxType: 'Ltcg',
    taxRate: 0.125,
    taxBeforeCess: 187.5,
    cess: 7.5,
    estimatedTax: 195,
    isGrandfathered: false,
    grandfatheredStatus: 'Not Applicable',
    advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
    ...overrides,
  };
}

function createMockBackendResponse(overrides: Partial<SimulationSellResponse> = {}): SimulationSellResponse {
  return {
    assetName: 'HDFC Top 100 Fund',
    unitsToSell: 50,
    estimatedValue: 6000,
    totalGain: 1500,
    taxableGain: 1500,
    estimatedTax: 195,
    exitLoad: 60,
    taxBreakdown: {
      stcg: { amount: 0, tax: 0, cess: 0 },
      ltcg: { amount: 1500, tax: 187.5, cess: 7.5 },
      slab: { amount: 0, tax: 0, cess: 0 },
      totalTax: 195,
    },
    matchedLots: [createMockRealizedGain()],
    ...overrides,
  };
}

describe('Tax Simulation Service (Backend-Shared with Offline Fallback)', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Online Backend Simulation', () => {
    it('calls backend API POST /api/tax/simulate-sell with JWT token when server is reachable', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://127.0.0.1:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'jwt-test-token');

      // Health check response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      // Simulation API response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createMockBackendResponse(),
      });

      const result = await simulateWithdrawal({
        folioId: 'folio-hdfc-1',
        schemeName: 'HDFC Top 100 Fund',
        unitsToSell: 50,
        currentNav: 120,
        assetClass: 'EQUITY',
        taxSlab: 0.30,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify health check call
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall?.[0]).toContain('/health');

      // Verify simulate-sell call
      const secondCall = mockFetch.mock.calls[1];
      expect(secondCall?.[0]).toBe('http://10.0.2.2:8080/api/tax/simulate-sell');
      expect(secondCall?.[1]).toMatchObject({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-test-token',
        },
      });

      const sentBody = JSON.parse(secondCall?.[1]?.body as string) as Record<string, unknown>;
      expect(sentBody['folioId']).toBe('folio-hdfc-1');
      expect(sentBody['units']).toBe(50);
      expect(sentBody['currentPrice']).toBe(120);
      expect(result.schemeName).toBe('HDFC Top 100 Fund');
    });

    it('converts backend SimulationSellResponse to SimulationSellResult with exact figures', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'jwt-token-xyz');

      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () =>
          createMockBackendResponse({
            estimatedValue: 10000,
            totalGain: 2500,
            estimatedTax: 325,
            exitLoad: 100,
            taxBreakdown: {
              stcg: { amount: 500, tax: 100, cess: 4 },
              ltcg: { amount: 2000, tax: 212.5, cess: 8.5 },
              slab: { amount: 0, tax: 0, cess: 0 },
              totalTax: 325,
            },
          }),
      });

      const result = await simulateWithdrawal({
        folioId: 'folio-1',
        schemeName: 'HDFC Top 100 Fund',
        unitsToSell: 50,
        currentNav: 200,
        assetClass: 'EQUITY',
      });

      expect(result.grossValue).toBe(10000);
      expect(result.totalGain).toBe(2500);
      expect(result.stcgGain).toBe(500);
      expect(result.ltcgGain).toBe(2000);
      expect(result.slabGain).toBe(0);
      expect(result.exitLoad).toBe(100);
      expect(result.baseTax).toBe(312.5); // 100 + 212.5
      expect(result.cess).toBe(12.5); // 4 + 8.5
      expect(result.totalTax).toBe(325);
      expect(result.netProceeds).toBe(9575); // 10000 - 100 - 325
      expect(result.unitsSold).toBe(50);
      expect(result.isLocked).toBe(false);
      expect(result.matchedLots).toHaveLength(1);
      expect(result.matchedLots[0]?.taxType).toBe('LTCG');
      expect(result.matchedLots[0]?.holdingDays).toBe(1408);
    });
  });

  describe('Offline Fallback & Error Handling', () => {
    it('gracefully falls back to local simulateSellRedemption when server is unreachable', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://192.168.1.100:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'token-offline');

      // Health check fails (network timeout/error)
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const lots: SimulationLot[] = [
        {
          lotId: 'LOT-1',
          buyDate: '2023-01-01',
          units: 100,
          buyPrice: 50,
        },
      ];

      const result = await simulateWithdrawal({
        folioId: 'folio-offline-1',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        unitsToSell: 50,
        currentNav: 100,
        assetClass: 'EQUITY',
        lots,
      });

      expect(result.unitsSold).toBe(50);
      expect(result.grossValue).toBe(5000); // 50 * 100
      expect(result.totalCost).toBe(2500); // 50 * 50
      expect(result.totalGain).toBe(2500);
      expect(result.ltcgGain).toBe(2500);
      expect(result.isLocked).toBe(false);
      expect(result.matchedLots).toHaveLength(1);
    });

    it('gracefully falls back to local simulation when backend returns 500 error', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'token-500');

      // Health check passes
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      // API call returns 500 Internal Server Error
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: async () => ({ message: 'Internal server error' }),
      });

      const lots: SimulationLot[] = [
        {
          lotId: 'LOT-DEBT-1',
          buyDate: '2024-01-01',
          units: 20,
          buyPrice: 100,
        },
      ];

      const result = await simulateWithdrawal({
        schemeName: 'Aditya Birla Sun Life Liquid Fund',
        unitsToSell: 10,
        currentNav: 110,
        assetClass: 'DEBT',
        taxSlab: 0.30,
        lots,
      });

      expect(result.unitsSold).toBe(10);
      expect(result.grossValue).toBe(1100);
      expect(result.totalGain).toBe(100);
      expect(result.slabGain).toBe(100);
      expect(result.matchedLots[0]?.taxType).toBe('SLAB');
    });

    it('falls back to local simulation when no stored server credentials exist', async () => {
      // No credentials stored
      const result = await simulateWithdrawal({
        schemeName: 'SBI Small Cap Fund',
        unitsToSell: 10,
        currentNav: 150,
        assetClass: 'EQUITY',
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.unitsSold).toBe(10);
      expect(result.grossValue).toBe(1500);
      expect(result.matchedLots).toHaveLength(1);
    });

    it('correctly handles ELSS statutory 3-year lock-in in offline fallback', async () => {
      // Recent ELSS lot within 3 years
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 1); // 1 year ago
      const buyDateStr = recentDate.toISOString().split('T')[0] ?? '2025-11-23';

      const lots: SimulationLot[] = [
        {
          lotId: 'LOT-ELSS-LOCKED',
          buyDate: buyDateStr,
          units: 100,
          buyPrice: 50,
          isElss: true,
        },
      ];

      const result = await simulateWithdrawal({
        schemeName: 'Mirae Asset ELSS Tax Saver Fund',
        unitsToSell: 50,
        currentNav: 80,
        assetClass: 'EQUITY',
        isElss: true,
        lots,
      });

      expect(result.isLocked).toBe(true);
      expect(result.lockedUnits).toBe(100);
      expect(result.unitsSold).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('surfaces backend HTTP 400 UnitsLocked error instead of falling back to offline simulation', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'token-locked');

      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        json: async () => ({
          error: 'Cannot redeem locked ELSS units. Available: 0, Locked: 100',
          code: 'UNITS_LOCKED',
        }),
      });

      await expect(
        simulateWithdrawal({
          folioId: 'uuid-elss-folio-1',
          schemeName: 'Mirae Asset ELSS Tax Saver Fund',
          unitsToSell: 50,
          currentNav: 80,
          assetClass: 'EQUITY',
          isElss: true,
        }),
      ).rejects.toThrowError(SimulationBackendError);
    });

    it('surfaces backend HTTP 422 validation error instead of falling back to offline simulation', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:8080');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'token-422');

      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      mockFetch.mockResolvedValueOnce({
        status: 422,
        ok: false,
        json: async () => ({
          message: 'Units to sell must be greater than zero',
        }),
      });

      await expect(
        simulateWithdrawal({
          folioId: 'uuid-folio-2',
          schemeName: 'HDFC Top 100 Fund',
          unitsToSell: 0,
          currentNav: 100,
        }),
      ).rejects.toThrow('Units to sell must be greater than zero');
    });
  });
});
