import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const { mockSecureStore } = vi.hoisted(() => ({
  mockSecureStore: new Map<string, string>(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => createInMemoryDatabase()),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, val: string) => {
    mockSecureStore.set(key, val);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

vi.mock('./auth-service', () => ({
  getStoredCredentials: vi.fn(async () => ({ serverUrl: null, token: null, user: null })),
}));

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  syncPortfolioAnalyticsFromServer,
  getCachedPortfolioAnalytics,
} from './analytics-sync-service';
import { savePortfolioAnalytics, getPortfolioAnalytics } from '../db/analytics-repository';
import { CREATE_PORTFOLIO_ANALYTICS_TABLE } from '../db/schema';

type SqlInput = null | number | bigint | string | Uint8Array;

function extractParams(args: unknown[]): SqlInput[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as SqlInput[];
  }
  return args as SqlInput[];
}

function createInMemoryDatabase(): SQLiteDatabase {
  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec(CREATE_PORTFOLIO_ANALYTICS_TABLE);

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
      return stmt.all(...params) as T[];
    },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const row = stmt.get(...params);
      return (row as T) ?? null;
    },
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      return task();
    },
  } as unknown as SQLiteDatabase;
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('analytics-sync-service', () => {
  let db: SQLiteDatabase;

  beforeEach(() => {
    db = createInMemoryDatabase();
    mockFetch.mockReset();
  });

  it('syncs XRay, exposures, and tax-summary from server into SQLite', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/xray')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ totalValue: 500000, assetAllocation: { equity: { percentage: 80, value: 400000 } } }),
        };
      }
      if (url.includes('/exposures?excludeArbitrage=false')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ name: 'HDFC Bank Ltd.', sector: 'Financial Services', absoluteValue: 50000, percentage: 0.1, contributions: [] }]),
        };
      }
      if (url.includes('/exposures?excludeArbitrage=true')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ name: 'HDFC Bank Ltd.', sector: 'Financial Services', absoluteValue: 45000, percentage: 0.09, contributions: [] }]),
        };
      }
      if (url.includes('/tax-summary')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ summary: { total: 10000 } }),
        };
      }
      return { ok: false, status: 404 };
    });

    await syncPortfolioAnalyticsFromServer({
      serverUrl: 'http://localhost:8082',
      portfolioId: 'test-port-1',
      token: 'test-token',
      db,
    });

    const cached = await getCachedPortfolioAnalytics(db, 'test-port-1');
    expect(cached.xrayData).toBeDefined();
    expect(cached.xrayData?.totalValue).toBe(500000);
    expect(cached.exposures).toHaveLength(1);
    expect(cached.exposures?.[0]?.name).toBe('HDFC Bank Ltd.');
    expect(cached.exposuresExArb?.[0]?.absoluteValue).toBe(45000);
    expect(cached.taxSummary).toBeDefined();
  });

  it('returns nulls when no analytics exist in SQLite', async () => {
    const cached = await getCachedPortfolioAnalytics(db, 'non-existent');
    expect(cached.xrayData).toBeNull();
    expect(cached.exposures).toBeNull();
    expect(cached.exposuresExArb).toBeNull();
    expect(cached.taxSummary).toBeNull();
  });

  it('directly saves and retrieves via repository functions', async () => {
    await savePortfolioAnalytics(db, {
      portfolio_id: 'port-direct',
      xray_json: JSON.stringify({ totalValue: 12345 }),
      exposures_json: JSON.stringify([{ name: 'Direct Stock', percentage: 0.5 }]),
      exposures_ex_arb_json: JSON.stringify([{ name: 'Direct Stock', percentage: 0.5 }]),
      tax_summary_json: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const entity = await getPortfolioAnalytics(db, 'port-direct');
    expect(entity).not.toBeNull();
    expect(entity?.portfolio_id).toBe('port-direct');

    const defaultEntity = await getPortfolioAnalytics(db, 'default');
    expect(defaultEntity).not.toBeNull();
    expect(defaultEntity?.portfolio_id).toBe('port-direct');
  });

  it('guards JSON.parse on empty strings so partial sync failures do not wipe out cached analytics', async () => {
    await savePortfolioAnalytics(db, {
      portfolio_id: 'port-partial',
      xray_json: '',
      exposures_json: '',
      exposures_ex_arb_json: '',
      tax_summary_json: JSON.stringify({ totalTax: 5000 }),
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const cached = await getCachedPortfolioAnalytics(db, 'port-partial');
    expect(cached.xrayData).toBeNull();
    expect(cached.exposures).toBeNull();
    expect(cached.exposuresExArb).toBeNull();
    expect(cached.taxSummary).toEqual({ totalTax: 5000 });
  });
});
