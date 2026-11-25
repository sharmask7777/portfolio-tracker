import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const { mockLocalAuth, mockStorage } = vi.hoisted(() => ({
  mockLocalAuth: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    authenticateAsync: vi.fn(),
  },
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => createInMemoryTestDatabase()),
}));

vi.mock('expo-local-authentication', () => mockLocalAuth);
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

import type { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase, closeDatabase, setDatabaseInstance } from '../db/client';
import {
  savePortfolioSnapshot,
  updateHoldingNav,
  type PortfolioSnapshotInput,
} from '../db/repository';
import {
  getDashboardSummary,
  getEnrichedHoldings,
  filterHoldings,
  groupHoldingsByAssetClass,
  normalizeAssetClass,
  formatInr,
  formatPct,
  checkServerReachable,
  syncWithServer,
  syncWithPublicFeed,
  refreshPortfolio,
  computeOverallPortfolioXirr,
  mergeServerMetricsIntoSummary,
} from './portfolio-service';
import { syncWithServerWithOptions } from './portfolio-sync-service';
import type { HoldingEntity } from '../db/schema';

type SqlInput = null | number | bigint | string | Uint8Array;

function extractParams(args: unknown[]): SqlInput[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as SqlInput[];
  }
  return args as SqlInput[];
}

function createInMemoryTestDatabase(): SQLiteDatabase {
  const nodeDb = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => {
      nodeDb.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        lastInsertRowId: Number(res.lastInsertRowid),
        changes: Number(res.changes),
      };
    },
    getAllAsync: async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      return stmt.all(...params) as unknown as T[];
    },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.get(...params);
      return (res ?? null) as unknown as T | null;
    },
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      nodeDb.exec('BEGIN TRANSACTION;');
      try {
        const result = await task();
        nodeDb.exec('COMMIT;');
        return result;
      } catch (err) {
        nodeDb.exec('ROLLBACK;');
        throw err;
      }
    },
    closeAsync: async () => {
      nodeDb.close();
    },
  } as unknown as SQLiteDatabase;
}

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('portfolio-service', () => {
  let db: SQLiteDatabase;

  const sampleHoldings: HoldingEntity[] = [
    {
      id: 'hld-1',
      folio_number: '12345/A',
      amfi_code: '120503',
      scheme_name: 'HDFC Top 100 Fund - Growth',
      isin: 'INF179K01BE2',
      units: 100,
      invested_cost: 50000,
      current_nav: 600,
      current_value: 60000,
      asset_class: 'EQUITY',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
    },
    {
      id: 'hld-2',
      folio_number: '67890/B',
      amfi_code: '119551',
      scheme_name: 'SBI Liquid Fund - Direct Growth',
      isin: 'INF200K01VA8',
      units: 20,
      invested_cost: 60000,
      current_nav: 3300,
      current_value: 66000,
      asset_class: 'DEBT',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockStorage.clear();
    mockFetch.mockReset();
    db = createInMemoryTestDatabase();
    await initDatabase(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
    setDatabaseInstance(null);
  });

  describe('Formatting & Normalization', () => {
    it('normalizes asset classes into standard categories', () => {
      expect(normalizeAssetClass('EQUITY')).toBe('Equity');
      expect(normalizeAssetClass('Large Cap Stock')).toBe('Equity');
      expect(normalizeAssetClass('DEBT_SHORT_TERM')).toBe('Debt');
      expect(normalizeAssetClass('Liquid Fund')).toBe('Cash');
      expect(normalizeAssetClass('HDFC Balanced Advantage Fund')).toBe('Hybrid');
      expect(normalizeAssetClass('Kotak Arbitrage Fund')).toBe('Arbitrage');
      expect(normalizeAssetClass('Gold ETF')).toBe('Gold');
      expect(normalizeAssetClass('')).toBe('Other');
    });

    it('formats Indian rupee currency correctly', () => {
      expect(formatInr(123456.78)).toBe('₹1,23,456.78');
      expect(formatInr(-5000.5)).toBe('-₹5,000.50');
      expect(formatInr(0)).toBe('₹0.00');
    });

    it('formats percentages with proper sign prefix', () => {
      expect(formatPct(12.345)).toBe('+12.35%');
      expect(formatPct(-4.5)).toBe('-4.50%');
      expect(formatPct(0)).toBe('0.00%');
    });
  });

  describe('Dashboard Summary Computation', () => {
    it('returns zeroes when portfolio has no active holdings', async () => {
      const summary = await getDashboardSummary(db);
      expect(summary.totalCurrentValue).toBe(0);
      expect(summary.totalInvestedCost).toBe(0);
      expect(summary.unrealizedGain).toBe(0);
      expect(summary.unrealizedGainPct).toBe(0);
      expect(summary.holdingsCount).toBe(0);
      expect(summary.assetAllocation).toEqual([]);
    });

    it('calculates net worth, gain, and asset allocation from cached holdings', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary Portfolio', updated_at: '2026-11-17T10:00:00Z' },
        folios: [
          { folio_number: '12345/A', amc_name: 'HDFC AMC', pan: 'ABCDE1234F', updated_at: '2026-11-17T10:00:00Z' },
          { folio_number: '67890/B', amc_name: 'SBI AMC', pan: 'ABCDE1234F', updated_at: '2026-11-17T10:00:00Z' },
        ],
        holdings: sampleHoldings,
      };
      await savePortfolioSnapshot(db, snapshot);

      const summary = await getDashboardSummary(db);
      expect(summary.totalCurrentValue).toBe(126000);
      expect(summary.totalInvestedCost).toBe(110000);
      expect(summary.unrealizedGain).toBe(16000);
      expect(summary.unrealizedGainPct).toBe(14.55);
      expect(summary.holdingsCount).toBe(2);

      expect(summary.assetAllocation).toHaveLength(2);
      const equityAlloc = summary.assetAllocation.find((a) => a.name === 'Equity');
      expect(equityAlloc).toBeDefined();
      expect(equityAlloc?.amount).toBe(60000);
      expect(equityAlloc?.percentage).toBe(47.6);

      const debtAlloc = summary.assetAllocation.find((a) => a.name === 'Debt');
      expect(debtAlloc).toBeDefined();
      expect(debtAlloc?.amount).toBe(66000);
      expect(debtAlloc?.percentage).toBe(52.4);
    });

    it('computes day change from historical nav records', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary', updated_at: '2026-11-17T10:00:00Z' },
        folios: [{ folio_number: '12345/A', amc_name: 'HDFC AMC', pan: 'ABCDE1234F', updated_at: '2026-11-17T10:00:00Z' }],
        holdings: [sampleHoldings[0]!],
      };
      await savePortfolioSnapshot(db, snapshot);

      // Insert previous and latest NAV in nav_history
      await updateHoldingNav(db, '120503', { nav: 580, navDate: '2026-11-16' });
      await updateHoldingNav(db, '120503', { nav: 600, navDate: '2026-11-17' });

      const summary = await getDashboardSummary(db);
      // diff is 20 per unit * 100 units = 2000 day gain
      expect(summary.dayGain).toBe(2000);
      expect(summary.dayGainPct).toBe(3.45);
    });

    it('uses server day_change and day_change_pct directly without nav_history', async () => {
      const holdingWithServerChange: HoldingEntity = {
        ...sampleHoldings[0]!,
        day_change: 1500,
        day_change_pct: 2.5,
      };
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary', updated_at: '2026-11-17T10:00:00Z' },
        folios: [{ folio_number: '12345/A', amc_name: 'HDFC AMC', pan: 'ABCDE1234F', updated_at: '2026-11-17T10:00:00Z' }],
        holdings: [holdingWithServerChange],
      };
      await savePortfolioSnapshot(db, snapshot);

      const enriched = await getEnrichedHoldings(db);
      expect(enriched).toHaveLength(1);
      expect(enriched[0]?.dayChange).toBe(1500);
      expect(enriched[0]?.dayChangePct).toBe(2.5);

      const summary = await getDashboardSummary(db);
      expect(summary.dayGain).toBe(1500);
      expect(summary.dayGainPct).toBe(2.56);
    });
  });

  describe('Holdings Filtering and Grouping', () => {
    it('filters holdings by scheme name and folio number', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary', updated_at: '2026-11-17T10:00:00Z' },
        folios: [],
        holdings: sampleHoldings,
      };
      await savePortfolioSnapshot(db, snapshot);

      const enriched = await getEnrichedHoldings(db);
      expect(filterHoldings(enriched, 'HDFC')).toHaveLength(1);
      expect(filterHoldings(enriched, '12345')).toHaveLength(1);
      expect(filterHoldings(enriched, 'SBI')).toHaveLength(1);
      expect(filterHoldings(enriched, 'NonExistent')).toHaveLength(0);
    });

    it('filters holdings by asset class', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary', updated_at: '2026-11-17T10:00:00Z' },
        folios: [],
        holdings: sampleHoldings,
      };
      await savePortfolioSnapshot(db, snapshot);

      const enriched = await getEnrichedHoldings(db);
      expect(filterHoldings(enriched, undefined, 'Equity')).toHaveLength(1);
      expect(filterHoldings(enriched, undefined, 'Debt')).toHaveLength(1);
      expect(filterHoldings(enriched, undefined, 'Hybrid')).toHaveLength(0);
    });

    it('groups holdings by asset class with aggregate totals', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Primary', updated_at: '2026-11-17T10:00:00Z' },
        folios: [],
        holdings: sampleHoldings,
      };
      await savePortfolioSnapshot(db, snapshot);

      const enriched = await getEnrichedHoldings(db);
      const groups = groupHoldingsByAssetClass(enriched);
      expect(groups).toHaveLength(2);
      expect(groups[0]?.assetClass).toBe('Equity');
      expect(groups[0]?.totalValue).toBe(60000);
      expect(groups[1]?.assetClass).toBe('Debt');
      expect(groups[1]?.totalValue).toBe(66000);
    });
  });

  describe('Server Reachability & Sync', () => {
    it('returns false when server is not reachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const reachable = await checkServerReachable('http://localhost:3000');
      expect(reachable).toBe(false);
    });

    it('returns true when server responds with 200 OK', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
      });
      const reachable = await checkServerReachable('http://localhost:3000');
      expect(reachable).toBe(true);
    });

    it('syncs portfolio snapshot from server response into local SQLite', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'server-p1',
          name: 'Remote Portfolio',
          folios: [
            {
              id: 'folio-uuid-1',
              number: 'FOLIO-SERVER-1',
              amc: 'Parag Parikh AMC',
              pan: 'ABCDE1234F',
              units: 50,
              asset: {
                name: 'Parag Parikh Flexi Cap Fund',
                amfiCode: '122639',
                isin: 'INF879O01027',
                assetType: 'EQUITY',
              },
              metrics: {
                investedAmount: 25000,
                currentPrice: 75.5,
                currentValue: 3775,
              },
            },
          ],
        }),
      });

      const success = await syncWithServer('http://localhost:3000', 'valid-jwt', db);
      expect(success).toBe(true);

      const summary = await getDashboardSummary(db);
      expect(summary.totalCurrentValue).toBe(3775);
      expect(summary.holdingsCount).toBe(1);
    });
  });

  describe('Pull-to-Refresh & Offline Fallback', () => {
    it('syncs with server when server credentials exist and server is reachable', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:3000');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'test-token');

      // Health check response
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      // Summary API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'server-p1',
          name: 'Remote Portfolio',
          folios: [],
        }),
      });

      const result = await refreshPortfolio(db);
      expect(result.success).toBe(true);
      expect(result.source).toBe('server');
    });

    it('falls back to public NAV fetcher when server is unreachable', async () => {
      mockStorage.set('PORTFOLIO_SERVER_URL', 'http://localhost:3000');
      mockStorage.set('PORTFOLIO_DEVICE_TOKEN', 'test-token');

      // Seed local holding
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Local', updated_at: '2026-11-17T10:00:00Z' },
        folios: [{ folio_number: '12345/A', amc_name: 'HDFC AMC', pan: 'ABCDE1234F', updated_at: '2026-11-17T10:00:00Z' }],
        holdings: [sampleHoldings[0]!],
      };
      await savePortfolioSnapshot(db, snapshot);

      // Server health check fails (offline / docker down)
      mockFetch.mockRejectedValueOnce(new Error('Network offline'));

      // Public AMFI API succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          data: [
            { date: '18-11-2026', nav: '610.50' },
            { date: '17-11-2026', nav: '600.00' },
          ],
        }),
      });

      const result = await refreshPortfolio(db);
      expect(result.success).toBe(true);
      expect(result.source).toBe('public_feed');
      // dayGain should reflect 10.5 diff * 100 units = 1050
      expect(result.dayGain).toBe(1050);
    });

    it('returns offline_cache when no server credentials and no holdings with AMFI code', async () => {
      const result = await refreshPortfolio(db);
      expect(result.success).toBe(true);
      expect(result.source).toBe('offline_cache');
    });

    it('syncWithPublicFeed returns public_feed day change calculation', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: { id: 'p1', name: 'Local', updated_at: '2026-11-17T10:00:00Z' },
        folios: [],
        holdings: [sampleHoldings[0]!],
      };
      await savePortfolioSnapshot(db, snapshot);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          data: [
            { date: '18-11-2026', nav: '610.00' },
            { date: '17-11-2026', nav: '600.00' },
          ],
        }),
      });

      const feedResult = await syncWithPublicFeed(db);
      expect(feedResult.success).toBe(true);
      expect(feedResult.source).toBe('public_feed');
      expect(feedResult.dayGain).toBe(1000);
    });
  });

  describe('computeOverallPortfolioXirr', () => {
    it('returns undefined for empty holdings or non-positive valuation', () => {
      expect(computeOverallPortfolioXirr([])).toBeUndefined();

      const zeroValHolding = {
        ...sampleHoldings[0]!,
        current_value: 0,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 0,
        gainLossPct: 0,
      };
      expect(computeOverallPortfolioXirr([zeroValHolding])).toBeUndefined();
    });

    it('computes value-weighted XIRR when all holdings have valid xirr', () => {
      const h1 = {
        ...sampleHoldings[0]!,
        current_value: 60000,
        xirr: 0.15,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 10000,
        gainLossPct: 20,
      };
      const h2 = {
        ...sampleHoldings[1]!,
        current_value: 40000,
        xirr: 0.10,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 5000,
        gainLossPct: 14.28,
      };

      // (60000 * 0.15 + 40000 * 0.10) / 100000 = (9000 + 4000) / 100000 = 0.13
      const result = computeOverallPortfolioXirr([h1, h2]);
      expect(result).toBeCloseTo(0.13, 4);
    });

    it('falls back to absolute_return or gainLossPct when xirr is absent or zero', () => {
      const h1 = {
        ...sampleHoldings[0]!,
        current_value: 50000,
        xirr: 0.12,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 5000,
        gainLossPct: 10,
      };
      const h2 = {
        ...sampleHoldings[1]!,
        current_value: 50000,
        xirr: 0, // uncomputed XIRR
        absolute_return: 0.08,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 4000,
        gainLossPct: 8,
      };
      const h3 = {
        ...sampleHoldings[0]!,
        id: 'h3',
        current_value: 50000,
        xirr: undefined,
        absolute_return: undefined,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss: 3000,
        gainLossPct: 6, // 6% -> 0.06
      };

      // (50000 * 0.12 + 50000 * 0.08 + 50000 * 0.06) / 150000 = (6000 + 4000 + 3000) / 150000 = 13000 / 150000 ≈ 0.08667
      const result = computeOverallPortfolioXirr([h1, h2, h3]);
      expect(result).toBeCloseTo(0.08667, 4);
    });
  });

  describe('SSOT Sync & Scope Merging', () => {
    it('sends cpiInflationRate, marginalTaxBracket, and profileId query params and preserves consolidated holdings', async () => {
      await savePortfolioSnapshot(db, {
        portfolio: { id: 'p-1', name: 'Main', updated_at: '2026-11-25T00:00:00Z' },
        folios: [{ folio_number: 'F-1', amc_name: 'HDFC', pan: 'ABCDE1234F', updated_at: '2026-11-25T00:00:00Z' }],
        holdings: [sampleHoldings[0]!],
      });

      mockFetch.mockImplementation(async (input: string) => {
        if (input.includes('/api/portfolio/summary')) {
          return {
            ok: true,
            json: async () => ({
              id: 'prof-1',
              metrics: {
                totalInvested: 50000,
                totalValue: 60000,
                postTaxTotalValue: 58500,
                netRealizableValue: 58500,
                totalGain: 10000,
                absoluteReturn: 0.2,
                xirr: 0.14,
                postTaxXirr: 0.12,
                estimatedTax: 1500,
                dayChange: 100,
                dayChangePercentage: 0.17,
              },
              assetAllocation: [{ name: 'Hybrid', amount: 60000, percentage: 100, color: '#8b5cf6' }],
            }),
          };
        }
        return { ok: true, json: async () => [] };
      });

      const ok = await syncWithServerWithOptions({
        serverUrl: 'https://api.example.com',
        token: 'tok-1',
        targetDb: db,
        options: { cpi: 0.06, taxBracket: 0.30, profileId: 'prof-1' },
      });

      expect(ok).toBe(true);
      const summaryCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('/api/portfolio/summary'));
      expect(String(summaryCall?.[0])).toContain('cpiInflationRate=0.06');
      expect(String(summaryCall?.[0])).toContain('marginalTaxBracket=0.3');
      expect(String(summaryCall?.[0])).toContain('profileId=prof-1');

      const historyCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('/api/portfolio/prof-1/history'));
      expect(historyCall).toBeDefined();

      const holdingsAfter = await getEnrichedHoldings(db);
      expect(holdingsAfter).toHaveLength(1);
    });

    it('copies postTaxXirr and backend assetAllocation in mergeServerMetricsIntoSummary', () => {
      const merged = mergeServerMetricsIntoSummary(
        {
          totalCurrentValue: 0,
          totalInvestedCost: 0,
          unrealizedGain: 0,
          unrealizedGainPct: 0,
          dayGain: 0,
          dayGainPct: 0,
          assetAllocation: [],
          holdingsCount: 1,
          lastUpdated: null,
        },
        {
          totalInvested: 50000,
          totalValue: 60000,
          postTaxTotalValue: 58500,
          netRealizableValue: 58500,
          totalGain: 10000,
          absoluteReturn: 0.2,
          xirr: 0.14,
          postTaxXirr: 0.115,
          estimatedTax: 1500,
          dayChange: 100,
          dayChangePercentage: 0.17,
        },
        [{ name: 'Hybrid', amount: 60000, percentage: 100, color: '#8b5cf6' }],
      );

      expect(merged.postTaxXirr).toBe(0.115);
      expect(merged.postTaxTotalValue).toBe(58500);
      expect(merged.assetAllocation[0]?.name).toBe('Hybrid');
    });
  });
});
