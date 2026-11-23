import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  initDatabase,
  getDatabaseInstance,
  setDatabaseInstance,
  closeDatabase,
} from './client';
import {
  savePortfolioSnapshot,
  getPortfolioHoldings,
  updateHoldingNav,
  getPendingUploads,
  enqueueUpload,
  updateQueueStatus,
  getQueueItemById,
  getAllUploads,
  getQueueCounts,
  getPortfolioById,
  getAllFolios,
  getNavHistory,
  generateUuid,
  type PortfolioSnapshotInput,
} from './repository';
import {
  savePortfolioHistory,
  getPortfolioHistory,
} from './history-repository';
import type {
  FolioEntity,
  HoldingEntity,
  PortfolioEntity,
} from './schema';

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

describe('Local Storage Engine & SQLite Database Layer', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createInMemoryTestDatabase();
    setDatabaseInstance(null);
    await initDatabase(db);
  });

  describe('Database Initialization & Schema Verification', () => {
    it('creates all tables idempotently', async () => {
      // Running initDatabase again must not throw
      await expect(initDatabase(db)).resolves.toBeDefined();

      interface TableRow {
        name: string;
      }
      const tables = await db.getAllAsync<TableRow>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
      );
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('portfolios');
      expect(tableNames).toContain('folios');
      expect(tableNames).toContain('holdings');
      expect(tableNames).toContain('nav_history');
      expect(tableNames).toContain('sync_queue');
    });

    it('creates all required indexes', async () => {
      interface IndexRow {
        name: string;
      }
      const indexes = await db.getAllAsync<IndexRow>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';",
      );
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_holdings_folio');
      expect(indexNames).toContain('idx_holdings_amfi');
      expect(indexNames).toContain('idx_sync_queue_status');
    });

    it('manages database singleton and closeDatabase correctly', async () => {
      setDatabaseInstance(db);
      expect(getDatabaseInstance()).toBe(db);

      await closeDatabase(db);
      expect(getDatabaseInstance()).toBeNull();
    });
  });

  describe('Portfolio Snapshot Upsert & Active Holdings Isolation', () => {
    const syntheticPortfolio: PortfolioEntity = {
      id: 'port-synthetic-001',
      name: 'Primary Synthetic Portfolio',
      updated_at: '2026-03-31T10:00:00.000Z',
    };

    const syntheticFolios: FolioEntity[] = [
      {
        folio_number: 'FOLIO-SYN-101',
        amc_name: 'Synthetic Mutual Fund AMC',
        pan: 'ABCDE1234F',
        updated_at: '2026-03-31T10:00:00.000Z',
      },
      {
        folio_number: 'FOLIO-SYN-102',
        amc_name: 'Apex Capital AMC',
        pan: 'ABCDE1234F',
        updated_at: '2026-03-31T10:00:00.000Z',
      },
    ];

    const syntheticHoldings: HoldingEntity[] = [
      {
        id: 'hold-syn-01',
        folio_number: 'FOLIO-SYN-101',
        amfi_code: '120503',
        scheme_name: 'Synthetic Bluechip Equity Direct Growth',
        isin: 'INF209K01157',
        units: 150.5,
        invested_cost: 15000.0,
        current_nav: 120.0,
        current_value: 18060.0,
        asset_class: 'EQUITY',
        nav_date: '2026-03-31',
        updated_at: '2026-03-31T10:00:00.000Z',
      },
      {
        id: 'hold-syn-02',
        folio_number: 'FOLIO-SYN-102',
        amfi_code: '118989',
        scheme_name: 'Synthetic Liquid Fund Direct Growth',
        isin: 'INF209K01199',
        units: 50.0,
        invested_cost: 50000.0,
        current_nav: 1050.0,
        current_value: 52500.0,
        asset_class: 'DEBT',
        nav_date: '2026-03-31',
        updated_at: '2026-03-31T10:00:00.000Z',
      },
      {
        // Fully redeemed holding (units = 0)
        id: 'hold-syn-03-redeemed',
        folio_number: 'FOLIO-SYN-101',
        amfi_code: '100045',
        scheme_name: 'Synthetic Midcap Fund - Closed Position',
        isin: 'INF209K01999',
        units: 0.0,
        invested_cost: 0.0,
        current_nav: 50.0,
        current_value: 0.0,
        asset_class: 'EQUITY',
        nav_date: '2026-03-31',
        updated_at: '2026-03-31T10:00:00.000Z',
      },
    ];

    it('atomically saves portfolio, folios, and holdings', async () => {
      const snapshot: PortfolioSnapshotInput = {
        portfolio: syntheticPortfolio,
        folios: syntheticFolios,
        holdings: syntheticHoldings,
      };

      await savePortfolioSnapshot(db, snapshot);

      const savedPortfolio = await getPortfolioById(db, 'port-synthetic-001');
      expect(savedPortfolio).toEqual(syntheticPortfolio);

      const folios = await getAllFolios(db);
      expect(folios).toHaveLength(2);
      expect(folios[0]?.folio_number).toBe('FOLIO-SYN-101');

      // getPortfolioHoldings must only return ACTIVE holdings (units > 0), isolating closed/redeemed holdings
      const activeHoldings = await getPortfolioHoldings(db);
      expect(activeHoldings).toHaveLength(2);
      expect(activeHoldings.map((h) => h.id)).not.toContain('hold-syn-03-redeemed');
    });

    it('filters active holdings by folio number', async () => {
      await savePortfolioSnapshot(db, {
        portfolio: syntheticPortfolio,
        folios: syntheticFolios,
        holdings: syntheticHoldings,
      });

      const folio101Holdings = await getPortfolioHoldings(db, 'FOLIO-SYN-101');
      expect(folio101Holdings).toHaveLength(1);
      expect(folio101Holdings[0]?.amfi_code).toBe('120503');

      const folio102Holdings = await getPortfolioHoldings(db, 'FOLIO-SYN-102');
      expect(folio102Holdings).toHaveLength(1);
      expect(folio102Holdings[0]?.amfi_code).toBe('118989');
    });

    it('persists and reads day_change, day_change_pct, xirr, absolute_return, asset_category', async () => {
      const holdingWithMetrics: HoldingEntity = {
        id: 'hold-metrics-01',
        folio_number: 'FOLIO-SYN-101',
        amfi_code: '120503',
        scheme_name: 'Synthetic Bluechip Equity Direct Growth',
        isin: 'INF209K01157',
        units: 100.0,
        invested_cost: 10000.0,
        current_nav: 125.0,
        current_value: 12500.0,
        asset_class: 'EQUITY',
        nav_date: '2026-03-31',
        updated_at: '2026-03-31T10:00:00.000Z',
        day_change: 250.5,
        day_change_pct: 2.04,
        xirr: 0.156,
        absolute_return: 0.25,
        asset_category: 'Equity Large Cap',
      };

      await savePortfolioSnapshot(db, {
        portfolio: syntheticPortfolio,
        folios: syntheticFolios,
        holdings: [holdingWithMetrics],
      });

      const holdings = await getPortfolioHoldings(db, 'FOLIO-SYN-101');
      expect(holdings).toHaveLength(1);
      const saved = holdings[0];
      expect(saved?.day_change).toBe(250.5);
      expect(saved?.day_change_pct).toBe(2.04);
      expect(saved?.xirr).toBe(0.156);
      expect(saved?.absolute_return).toBe(0.25);
      expect(saved?.asset_category).toBe('Equity Large Cap');
    });

    it('upserts existing records on subsequent snapshots without duplication', async () => {
      await savePortfolioSnapshot(db, {
        portfolio: syntheticPortfolio,
        folios: syntheticFolios,
        holdings: syntheticHoldings,
      });

      const updatedPortfolio: PortfolioEntity = {
        ...syntheticPortfolio,
        name: 'Renamed Synthetic Portfolio',
        updated_at: '2026-04-01T10:00:00.000Z',
      };

      const updatedHolding: HoldingEntity = {
        ...syntheticHoldings[0]!,
        units: 200.0,
        current_value: 24000.0,
        updated_at: '2026-04-01T10:00:00.000Z',
      };

      await savePortfolioSnapshot(db, {
        portfolio: updatedPortfolio,
        folios: syntheticFolios,
        holdings: [updatedHolding],
      });

      const fetchedPortfolio = await getPortfolioById(db, 'port-synthetic-001');
      expect(fetchedPortfolio?.name).toBe('Renamed Synthetic Portfolio');

      const holdings = await getPortfolioHoldings(db);
      const modifiedHolding = holdings.find((h) => h.id === 'hold-syn-01');
      expect(modifiedHolding?.units).toBe(200.0);
      expect(modifiedHolding?.current_value).toBe(24000.0);
    });
  });

  describe('Holding NAV Updates & History Tracking', () => {
    beforeEach(async () => {
      await savePortfolioSnapshot(db, {
        portfolio: {
          id: 'port-1',
          name: 'Test Portfolio',
          updated_at: '2026-03-31T00:00:00Z',
        },
        folios: [
          {
            folio_number: 'FOLIO-01',
            amc_name: 'AMC Test',
            pan: 'ABCDE1234F',
            updated_at: '2026-03-31T00:00:00Z',
          },
        ],
        holdings: [
          {
            id: 'hold-1',
            folio_number: 'FOLIO-01',
            amfi_code: '120503',
            scheme_name: 'Synthetic Bluechip Fund',
            isin: 'INF209K01157',
            units: 100.0,
            invested_cost: 10000.0,
            current_nav: 120.0,
            current_value: 12000.0,
            asset_class: 'EQUITY',
            nav_date: '2026-03-30',
            updated_at: '2026-03-30T00:00:00Z',
          },
        ],
      });
    });

    it('updates current_nav, current_value, and nav_date for holding', async () => {
      await updateHoldingNav(db, '120503', {
        nav: 125.5,
        navDate: '2026-03-31',
        updatedAt: '2026-03-31T18:00:00Z',
      });

      const holdings = await getPortfolioHoldings(db);
      const holding = holdings.find((h) => h.amfi_code === '120503');

      expect(holding).toBeDefined();
      expect(holding?.current_nav).toBe(125.5);
      // current_value = units (100) * current_nav (125.5) = 12550
      expect(holding?.current_value).toBe(12550.0);
      expect(holding?.nav_date).toBe('2026-03-31');
    });

    it('records NAV history points', async () => {
      await updateHoldingNav(db, '120503', {
        nav: 125.5,
        navDate: '2026-03-31',
      });
      await updateHoldingNav(db, '120503', {
        nav: 127.0,
        navDate: '2026-04-01',
      });

      const history = await getNavHistory(db, '120503');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        amfi_code: '120503',
        date: '2026-03-31',
        nav: 125.5,
      });
      expect(history[1]).toEqual({
        amfi_code: '120503',
        date: '2026-04-01',
        nav: 127.0,
      });
    });
  });

  describe('Sync Queue Operations & Status Transitions', () => {
    it('enqueues uploads with defaults and returns queue item', async () => {
      const item = await enqueueUpload(db, {
        filePath: '/data/documents/cas_2026_01.pdf',
        fileName: 'cas_2026_01.pdf',
      });

      expect(item.id).toBeDefined();
      expect(item.file_name).toBe('cas_2026_01.pdf');
      expect(item.status).toBe('PENDING');
      expect(item.password_key).toBeNull();
      expect(item.retry_count).toBe(0);

      const pending = await getPendingUploads(db);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(item.id);
    });

    it('enqueues uploads with custom options and maintains FIFO order', async () => {
      const first = await enqueueUpload(db, {
        filePath: '/data/cas1.pdf',
        fileName: 'cas1.pdf',
        createdAt: '2026-03-30T10:00:00Z',
      });

      const second = await enqueueUpload(db, {
        filePath: '/data/cas2.pdf',
        fileName: 'cas2.pdf',
        passwordKey: 'SECURE_KEY_SYNTHETIC',
        createdAt: '2026-03-30T11:00:00Z',
      });

      const pending = await getPendingUploads(db);
      expect(pending).toHaveLength(2);
      expect(pending[0]?.id).toBe(first.id);
      expect(pending[1]?.id).toBe(second.id);
      expect(pending[1]?.password_key).toBe('SECURE_KEY_SYNTHETIC');
    });

    it('transitions queue item status from PENDING -> PROCESSING -> COMPLETED', async () => {
      const item = await enqueueUpload(db, {
        filePath: '/data/cas_flow.pdf',
        fileName: 'cas_flow.pdf',
      });

      // Transition to PROCESSING
      await updateQueueStatus(db, item.id, 'PROCESSING');
      let current = await getQueueItemById(db, item.id);
      expect(current?.status).toBe('PROCESSING');

      // Processing items must not appear in pending list
      let pending = await getPendingUploads(db);
      expect(pending).toHaveLength(0);

      // Transition to COMPLETED
      await updateQueueStatus(db, item.id, 'COMPLETED');
      current = await getQueueItemById(db, item.id);
      expect(current?.status).toBe('COMPLETED');
      expect(current?.retry_count).toBe(0);

      pending = await getPendingUploads(db);
      expect(pending).toHaveLength(0);
    });

    it('increments retry_count when transition is FAILED', async () => {
      const item = await enqueueUpload(db, {
        filePath: '/data/cas_err.pdf',
        fileName: 'cas_err.pdf',
      });

      expect(item.retry_count).toBe(0);

      await updateQueueStatus(db, item.id, 'FAILED');
      let current = await getQueueItemById(db, item.id);
      expect(current?.status).toBe('FAILED');
      expect(current?.retry_count).toBe(1);

      // Subsequent failure increments again
      await updateQueueStatus(db, item.id, 'FAILED');
      current = await getQueueItemById(db, item.id);
      expect(current?.retry_count).toBe(2);
    });

    it('retrieves all uploads ordered by created_at DESC and aggregates queue counts', async () => {
      const u1 = await enqueueUpload(db, {
        filePath: '/data/cas1.pdf',
        fileName: 'cas1.pdf',
        createdAt: '2026-03-30T10:00:00Z',
      });
      const u2 = await enqueueUpload(db, {
        filePath: '/data/cas2.pdf',
        fileName: 'cas2.pdf',
        createdAt: '2026-03-30T11:00:00Z',
      });
      const u3 = await enqueueUpload(db, {
        filePath: '/data/cas3.pdf',
        fileName: 'cas3.pdf',
        createdAt: '2026-03-30T12:00:00Z',
      });

      await updateQueueStatus(db, u1.id, 'COMPLETED');
      await updateQueueStatus(db, u2.id, 'FAILED');

      const all = await getAllUploads(db);
      expect(all).toHaveLength(3);
      expect(all[0]?.id).toBe(u3.id);
      expect(all[1]?.id).toBe(u2.id);
      expect(all[2]?.id).toBe(u1.id);

      const counts = await getQueueCounts(db);
      expect(counts.total).toBe(3);
      expect(counts.pending).toBe(1);
      expect(counts.failed).toBe(1);
      expect(counts.completed).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    it('generates non-empty valid UUID strings', () => {
      const id1 = generateUuid();
      const id2 = generateUuid();
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('Portfolio History Repository & Service', () => {
    it('persists and retrieves chronological portfolio history checkpoints', async () => {
      const db = createInMemoryTestDatabase();
      await initDatabase(db);

      const points = [
        { date: '2026-01-01', value: 100000, investedAmount: 90000 },
        { date: '2026-02-01', value: 110000, investedAmount: 95000 },
      ];

      await savePortfolioHistory(db, 'port-1', points);
      const loaded = await getPortfolioHistory(db, 'port-1');
      expect(loaded).toEqual(points);

      const empty = await getPortfolioHistory(db, 'port-unknown');
      expect(empty).toEqual([]);

      const fallback = await getPortfolioHistory(db, 'default');
      expect(fallback).toEqual(points);
    });
  });
});
