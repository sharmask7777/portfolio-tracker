import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  initDatabase,
  closeDatabase,
  setDatabaseInstance,
} from '../db/client';
import {
  savePortfolioSnapshot,
  getPortfolioHoldings,
  getNavHistory,
} from '../db/repository';
import type { HoldingEntity } from '../db/schema';
import {
  parseMfApiDate,
  fetchSchemeNav,
  refreshSchemeNavs,
  calculateDayValuationChange,
} from './nav-fetcher';
import type { NavUpdateResult } from './types';

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
    getAllAsync: async <T>(sql: string, ...args: unknown[]) => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      return stmt.all(...params) as T[];
    },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]) => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const row = stmt.get(...params);
      return (row ?? null) as T | null;
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      nodeDb.exec('BEGIN TRANSACTION;');
      try {
        await task();
        nodeDb.exec('COMMIT;');
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

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => createInMemoryTestDatabase()),
}));

describe('Direct Public NAV Price Fetcher & Valuation Service', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    db = createInMemoryTestDatabase();
    await initDatabase(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
    setDatabaseInstance(null);
    vi.unstubAllGlobals();
  });

  describe('Date Parsing (parseMfApiDate)', () => {
    it('parses standard MFAPI DD-MM-YYYY format into ISO YYYY-MM-DD', () => {
      expect(parseMfApiDate('24-10-2026')).toBe('2026-10-24');
      expect(parseMfApiDate('01-01-2026')).toBe('2026-01-01');
      expect(parseMfApiDate('31-12-2025')).toBe('2025-12-31');
    });

    it('parses single digit day and month into padded ISO format', () => {
      expect(parseMfApiDate('5-4-2026')).toBe('2026-04-05');
      expect(parseMfApiDate('9-11-2026')).toBe('2026-11-09');
    });

    it('parses ISO format YYYY-MM-DD directly', () => {
      expect(parseMfApiDate('2026-10-24')).toBe('2026-10-24');
      expect(parseMfApiDate('2026-04-05')).toBe('2026-04-05');
    });

    it('handles leading and trailing whitespace', () => {
      expect(parseMfApiDate('  24-10-2026  ')).toBe('2026-10-24');
    });

    it('returns null for non-string or empty inputs', () => {
      expect(parseMfApiDate('')).toBeNull();
      expect(parseMfApiDate('   ')).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(parseMfApiDate(null as any)).toBeNull();
    });

    it('returns null for invalid dates and leap year violations', () => {
      expect(parseMfApiDate('invalid-date')).toBeNull();
      expect(parseMfApiDate('32-01-2026')).toBeNull();
      expect(parseMfApiDate('15-13-2026')).toBeNull();
      expect(parseMfApiDate('31-02-2026')).toBeNull(); // Feb never has 31
      expect(parseMfApiDate('29-02-2025')).toBeNull(); // 2025 not a leap year
      expect(parseMfApiDate('29-02-2024')).toBe('2024-02-29'); // 2024 is leap year
    });
  });

  describe('Single Scheme Fetcher (fetchSchemeNav)', () => {
    it('successfully fetches latest and previous close NAV with positive gain', async () => {
      const mockPayload = {
        meta: {
          scheme_code: 120503,
          scheme_name: 'Axis Small Cap Fund - Direct Plan - Growth',
          fund_house: 'Axis Mutual Fund',
        },
        data: [
          { date: '24-10-2026', nav: '105.5000' },
          { date: '23-10-2026', nav: '100.0000' },
        ],
        status: 'SUCCESS',
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      }));

      const result = await fetchSchemeNav('120503');

      expect(result.success).toBe(true);
      expect(result.amfiCode).toBe('120503');
      expect(result.latestNav).toBe(105.5);
      expect(result.previousNav).toBe(100.0);
      expect(result.navDate).toBe('2026-10-24');
      expect(result.dayChange).toBe(5.5);
      expect(result.dayGainPct).toBe(5.5);
      expect(result.error).toBeUndefined();
    });

    it('accurately calculates day loss when latest NAV is lower than previous', async () => {
      const mockPayload = {
        data: [
          { date: '24-10-2026', nav: '95.0000' },
          { date: '23-10-2026', nav: '100.0000' },
        ],
        status: 'SUCCESS',
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      }));

      const result = await fetchSchemeNav('120503');

      expect(result.success).toBe(true);
      expect(result.latestNav).toBe(95.0);
      expect(result.previousNav).toBe(100.0);
      expect(result.dayChange).toBe(-5.0);
      expect(result.dayGainPct).toBe(-5.0);
    });

    it('handles scheme with only single NAV record (no previous NAV)', async () => {
      const mockPayload = {
        data: [
          { date: '24-10-2026', nav: '10.5000' },
        ],
        status: 'SUCCESS',
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      }));

      const result = await fetchSchemeNav('199999');

      expect(result.success).toBe(true);
      expect(result.latestNav).toBe(10.5);
      expect(result.previousNav).toBeNull();
      expect(result.dayChange).toBe(0);
      expect(result.dayGainPct).toBe(0);
    });

    it('returns typed error for empty or blank AMFI code', async () => {
      const result = await fetchSchemeNav('  ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or empty AMFI code');
      expect(result.latestNav).toBe(0);
    });

    it('returns typed error on HTTP 404 response without throwing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }));

      const result = await fetchSchemeNav('999999');
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('returns typed error on network connection failure without throwing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network request failed')));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error: Network request failed');
    });

    it('returns typed error for invalid or empty data array in payload', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUCCESS', data: [] }),
      }));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No NAV records returned');
    });

    it('returns typed error when response body is not an object or data is not array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => 'not an object',
      }));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });

    it('returns typed error when first record is malformed or missing fields', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUCCESS', data: [{ date: 12345 }] }),
      }));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Malformed NAV record');
    });

    it('handles non-numeric previous NAV gracefully by setting previousNav to null', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: [
            { date: '24-10-2026', nav: '105.0' },
            { date: '23-10-2026', nav: 'N.A.' },
          ],
        }),
      }));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(true);
      expect(result.latestNav).toBe(105.0);
      expect(result.previousNav).toBeNull();
      expect(result.dayChange).toBe(0);
      expect(result.dayGainPct).toBe(0);
    });

    it('returns typed error for malformed NAV values', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: [{ date: '24-10-2026', nav: 'N.A.' }],
        }),
      }));

      const result = await fetchSchemeNav('120503');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid latest NAV value');
    });
  });

  describe('Batch Refresh & Local SQLite Integration (refreshSchemeNavs)', () => {
    it('refreshes multiple schemes and updates holdings in local database', async () => {
      await savePortfolioSnapshot(db, {
        portfolio: { id: 'port-1', name: 'Primary Portfolio', updated_at: '2026-03-31T00:00:00Z' },
        folios: [
          { folio_number: 'F-101', amc_name: 'Axis Mutual Fund', pan: 'ABCDE1234F', updated_at: '2026-03-31T00:00:00Z' },
          { folio_number: 'F-102', amc_name: 'Parag Parikh Mutual Fund', pan: 'ABCDE1234F', updated_at: '2026-03-31T00:00:00Z' },
        ],
        holdings: [
          {
            id: 'h-1',
            folio_number: 'F-101',
            amfi_code: '120503',
            scheme_name: 'Axis Small Cap Fund Direct Growth',
            isin: 'INF846K01EW2',
            units: 100,
            invested_cost: 10000,
            current_nav: 100.0,
            current_value: 10000.0,
            asset_class: 'Equity',
            nav_date: '2026-03-30',
            updated_at: '2026-03-30T18:00:00Z',
          },
          {
            id: 'h-2',
            folio_number: 'F-102',
            amfi_code: '122639',
            scheme_name: 'Parag Parikh Flexi Cap Fund Direct Growth',
            isin: 'INF879O01027',
            units: 50,
            invested_cost: 2500,
            current_nav: 50.0,
            current_value: 2500.0,
            asset_class: 'Equity',
            nav_date: '2026-03-30',
            updated_at: '2026-03-30T18:00:00Z',
          },
        ],
      });

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('120503')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'SUCCESS',
              data: [
                { date: '31-03-2026', nav: '110.0000' },
                { date: '30-03-2026', nav: '100.0000' },
              ],
            }),
          };
        }
        if (url.includes('122639')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'SUCCESS',
              data: [
                { date: '31-03-2026', nav: '55.0000' },
                { date: '30-03-2026', nav: '50.0000' },
              ],
            }),
          };
        }
        return { ok: false, status: 404 };
      }));

      const results = await refreshSchemeNavs(['120503', '122639'], db);

      expect(results.size).toBe(2);
      expect(results.get('120503')?.success).toBe(true);
      expect(results.get('120503')?.latestNav).toBe(110.0);
      expect(results.get('122639')?.success).toBe(true);
      expect(results.get('122639')?.latestNav).toBe(55.0);

      const holdings = await getPortfolioHoldings(db);
      const h1 = holdings.find((h) => h.amfi_code === '120503');
      const h2 = holdings.find((h) => h.amfi_code === '122639');

      expect(h1?.current_nav).toBe(110.0);
      expect(h1?.current_value).toBe(11000.0);
      expect(h1?.nav_date).toBe('2026-03-31');

      expect(h2?.current_nav).toBe(55.0);
      expect(h2?.current_value).toBe(2750.0);
      expect(h2?.nav_date).toBe('2026-03-31');

      const history1 = await getNavHistory(db, '120503');
      expect(history1).toHaveLength(1);
      expect(history1[0]?.nav).toBe(110.0);
      expect(history1[0]?.date).toBe('2026-03-31');
    });

    it('handles partial failures cleanly without interrupting valid schemes', async () => {
      await savePortfolioSnapshot(db, {
        portfolio: { id: 'port-1', name: 'Primary Portfolio', updated_at: '2026-03-31T00:00:00Z' },
        folios: [
          { folio_number: 'F-101', amc_name: 'Axis Mutual Fund', pan: 'ABCDE1234F', updated_at: '2026-03-31T00:00:00Z' },
        ],
        holdings: [
          {
            id: 'h-1',
            folio_number: 'F-101',
            amfi_code: '120503',
            scheme_name: 'Axis Small Cap Fund Direct Growth',
            isin: 'INF846K01EW2',
            units: 100,
            invested_cost: 10000,
            current_nav: 100.0,
            current_value: 10000.0,
            asset_class: 'Equity',
            nav_date: '2026-03-30',
            updated_at: '2026-03-30T18:00:00Z',
          },
        ],
      });

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('120503')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'SUCCESS',
              data: [{ date: '31-03-2026', nav: '112.0000' }, { date: '30-03-2026', nav: '100.0000' }],
            }),
          };
        }
        if (url.includes('404040')) {
          return { ok: false, status: 404 };
        }
        throw new Error('Socket timeout');
      }));

      const results = await refreshSchemeNavs(['120503', '404040', '505050'], db);

      expect(results.size).toBe(3);
      expect(results.get('120503')?.success).toBe(true);
      expect(results.get('404040')?.success).toBe(false);
      expect(results.get('404040')?.error).toContain('HTTP 404');
      expect(results.get('505050')?.success).toBe(false);
      expect(results.get('505050')?.error).toContain('Network error');

      const holdings = await getPortfolioHoldings(db);
      const h1 = holdings.find((h) => h.amfi_code === '120503');
      expect(h1?.current_nav).toBe(112.0);
      expect(h1?.current_value).toBe(11200.0);
    });

    it('deduplicates input AMFI codes and ignores empty inputs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: [{ date: '31-03-2026', nav: '110.0' }, { date: '30-03-2026', nav: '100.0' }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const results = await refreshSchemeNavs(['120503', '120503', '', '  ', '120503'], db);

      expect(results.size).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('captures database persistence errors without crashing', async () => {
      const failingDb = {
        ...db,
        withTransactionAsync: async () => {
          throw new Error('SQLite disk I/O error');
        },
      } as unknown as SQLiteDatabase;

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: [{ date: '31-03-2026', nav: '110.0' }, { date: '30-03-2026', nav: '100.0' }],
        }),
      }));

      const results = await refreshSchemeNavs(['120503'], failingDb);

      expect(results.get('120503')?.success).toBe(false);
      expect(results.get('120503')?.error).toContain('Failed to persist NAV: SQLite disk I/O error');
    });

    it('fetches schemes even when database instance is not provided or null', async () => {
      setDatabaseInstance(null);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUCCESS',
          data: [{ date: '31-03-2026', nav: '110.0' }, { date: '30-03-2026', nav: '100.0' }],
        }),
      }));

      const results = await refreshSchemeNavs(['120503'], undefined);
      expect(results.get('120503')?.success).toBe(true);
      expect(results.get('120503')?.latestNav).toBe(110.0);
    });
  });

  describe('Valuation Calculation (calculateDayValuationChange)', () => {
    it('computes accurate valuation and day gain summary across mixed holdings', () => {
      const holdings: HoldingEntity[] = [
        {
          id: 'h-1',
          folio_number: 'F-1',
          amfi_code: '120503',
          scheme_name: 'Axis Small Cap',
          isin: 'INF846K01EW2',
          units: 100,
          invested_cost: 10000,
          current_nav: 100.0,
          current_value: 10000.0,
          asset_class: 'Equity',
          nav_date: '2026-03-30',
          updated_at: '2026-03-30T18:00:00Z',
        },
        {
          id: 'h-2',
          folio_number: 'F-2',
          amfi_code: '122639',
          scheme_name: 'Parag Parikh Flexi Cap',
          isin: 'INF879O01027',
          units: 50,
          invested_cost: 2000,
          current_nav: 50.0,
          current_value: 2500.0,
          asset_class: 'Equity',
          nav_date: '2026-03-30',
          updated_at: '2026-03-30T18:00:00Z',
        },
        {
          id: 'h-3',
          folio_number: 'F-3',
          amfi_code: null, // SGB / Alternative asset
          scheme_name: 'Sovereign Gold Bond 2028',
          isin: 'IN0020180010',
          units: 10,
          invested_cost: 50000,
          current_nav: 6500.0,
          current_value: 65000.0,
          asset_class: 'Gold',
          nav_date: '2026-03-30',
          updated_at: '2026-03-30T18:00:00Z',
        },
      ];

      const updatedNavs = new Map<string, NavUpdateResult>([
        [
          '120503',
          {
            amfiCode: '120503',
            success: true,
            latestNav: 105.0,
            previousNav: 100.0,
            navDate: '2026-03-31',
            dayChange: 5.0,
            dayGainPct: 5.0,
          },
        ],
        [
          '122639',
          {
            amfiCode: '122639',
            success: true,
            latestNav: 48.0,
            previousNav: 50.0,
            navDate: '2026-03-31',
            dayChange: -2.0,
            dayGainPct: -4.0,
          },
        ],
      ]);

      const summary = calculateDayValuationChange(holdings, updatedNavs);

      // h1 new value: 100 * 105 = 10500, day gain = 100 * 5 = +500
      // h2 new value: 50 * 48 = 2400, day gain = 50 * -2 = -100
      // h3 un-updated: 65000, day gain = 0
      // Total current value: 10500 + 2400 + 65000 = 77900
      // Total day gain: 500 - 100 = 400
      // Previous total value: 10000 + 2500 + 65000 = 77500
      // Day gain pct: (400 / 77500) * 100 = 0.5161%
      expect(summary.totalCurrentValue).toBe(77900.0);
      expect(summary.totalDayGain).toBe(400.0);
      expect(summary.dayGain).toBe(400.0);
      expect(summary.totalDayGainPct).toBe(0.5161);
      expect(summary.dayGainPct).toBe(0.5161);
      expect(summary.totalInvestedCost).toBe(62000.0);
      expect(summary.totalHoldings).toBe(3);
      expect(summary.updatedCount).toBe(2);
      expect(summary.failedCount).toBe(1);
    });

    it('falls back to cached current_value when updatedNav is marked as failed', () => {
      const holdings: HoldingEntity[] = [
        {
          id: 'h-1',
          folio_number: 'F-1',
          amfi_code: '120503',
          scheme_name: 'Axis Small Cap',
          isin: 'INF846K01EW2',
          units: 100,
          invested_cost: 10000,
          current_nav: 100.0,
          current_value: 10000.0,
          asset_class: 'Equity',
          nav_date: '2026-03-30',
          updated_at: '2026-03-30T18:00:00Z',
        },
      ];

      const updatedNavs = new Map<string, NavUpdateResult>([
        [
          '120503',
          {
            amfiCode: '120503',
            success: false,
            latestNav: 0,
            previousNav: null,
            navDate: '',
            dayChange: 0,
            dayGainPct: 0,
            error: 'HTTP 404',
          },
        ],
      ]);

      const summary = calculateDayValuationChange(holdings, updatedNavs);

      expect(summary.totalCurrentValue).toBe(10000.0);
      expect(summary.totalDayGain).toBe(0);
      expect(summary.totalDayGainPct).toBe(0);
      expect(summary.updatedCount).toBe(0);
      expect(summary.failedCount).toBe(1);
    });

    it('handles empty holdings array without error', () => {
      const summary = calculateDayValuationChange([], new Map());

      expect(summary.totalCurrentValue).toBe(0);
      expect(summary.totalDayGain).toBe(0);
      expect(summary.totalDayGainPct).toBe(0);
      expect(summary.totalHoldings).toBe(0);
      expect(summary.updatedCount).toBe(0);
      expect(summary.failedCount).toBe(0);
    });
  });
});
