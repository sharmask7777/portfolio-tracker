/**
 * @file mobile-feature-parity.test.ts
 * @description Unit tests for Mobile Feature Parity (P1):
 * 1. Transaction Ledger Sheet & Repository
 * 2. Closed Positions Section
 * 3. Schedule CG CSV Exporter
 * 4. Expense Ratio Analysis Card & Calculator
 * 5. Manual Asset Onboarding Service & Modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
}));
import {
  escapeCsvField,
  generateScheduleCgCsv,
  exportScheduleCgCsv,
} from '../src/services/itr-csv-service';
import {
  calculateExpenseAnalysis,
} from '../src/services/expense-calculation-service';
import {
  addManualAsset,
  type AddManualAssetPayload,
} from '../src/services/manual-asset-service';
import type { EnrichedHolding } from '../src/services/portfolio-service';
import {
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
} from '../src/services/tax-harvesting';
import {
  upsertTransaction,
  getTransactionsByFolio,
  deleteFolioAndTransactions,
} from '../src/db/transaction-repository';
import { createInMemoryDatabase } from '../src/e2e/test-harness';
import { CREATE_TABLES_SQL } from '../src/db/schema';
import { Share } from 'react-native';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
  Share: {
    share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
  },
  StyleSheet: { create: (s: Record<string, unknown>) => s, hairlineWidth: 1 },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  Modal: (props: Record<string, unknown>) => ({ type: 'Modal', props }),
  FlatList: (props: Record<string, unknown>) => ({ type: 'FlatList', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
}));

describe('Mobile Feature Parity Unit Tests', () => {
  describe('Schedule CG CSV Exporter', () => {
    it('escapes CSV fields properly according to RFC 4180', () => {
      expect(escapeCsvField('hello')).toBe('hello');
      expect(escapeCsvField('hello,world')).toBe('"hello,world"');
      expect(escapeCsvField('hello"world')).toBe('"hello""world"');
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('generates statutory Schedule CG Table F and Capital Gains Tax CSV', () => {
      const taxResult = computeTaxBreakdowns([], '2024-25');
      const matrix = buildAdvanceTaxMatrix([]);
      const csv = generateScheduleCgCsv('2024-25', taxResult, matrix);

      expect(csv).toContain('CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)');
      expect(csv).toContain('Financial Year: 2024-25');
      expect(csv).toContain('ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)');
      expect(csv).toContain('Q1 (01/04 - 15/06),15/06/2024');
      expect(csv).toContain('Q4 (16/12 - 15/03),15/03/2025');
      expect(csv).toContain('Equity LTCG,Section 112A,12.5% statutory');
      expect(csv).toContain('Equity STCG,Section 111A,20% statutory');
      expect(csv).toContain('Specified Debt / MLD,Section 50AA,Slab rate');
    });

    it('triggers Share.share with formatted CSV filename and message', async () => {
      const taxResult = computeTaxBreakdowns([], '2024-25');
      const matrix = buildAdvanceTaxMatrix([]);
      await exportScheduleCgCsv('2024-25', taxResult, matrix);

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Schedule_CG_2024-25.csv',
          message: expect.stringContaining('CAPITAL GAINS TAX AUDIT REPORT'),
        }),
      );
    });
  });

  describe('Expense Analysis Calculator', () => {
    it('computes annual fee drag and weighted average TER accurately', () => {
      const mockHoldings: EnrichedHolding[] = [
        {
          id: 'h1',
          folio_number: '123/0',
          scheme_name: 'Parag Parikh Flexi Cap Fund - Direct Plan',
          units: 100,
          current_nav: 50,
          current_value: 100000,
          invested_cost: 80000,
          asset_class: 'EQUITY',
          nav_date: '2026-11-20',
          updated_at: '2026-11-20',
          dayChange: 500,
          dayChangePct: 0.5,
          gainLoss: 20000,
          gainLossPct: 25,
          amfi_code: '122639',
          isin: 'INF879O01027',
        },
        {
          id: 'h2',
          folio_number: '124/0',
          scheme_name: 'HDFC Liquid Fund - Regular Plan',
          units: 50,
          current_nav: 1000,
          current_value: 100000,
          invested_cost: 100000,
          asset_class: 'DEBT',
          nav_date: '2026-11-20',
          updated_at: '2026-11-20',
          dayChange: 20,
          dayChangePct: 0.02,
          gainLoss: 0,
          gainLossPct: 0,
          amfi_code: '119062',
          isin: 'INF179K01965',
        },
      ];

      const res = calculateExpenseAnalysis(mockHoldings);
      expect(res.totalAnnualFees).toBeGreaterThan(0);
      expect(res.weightedAvgTer).toBeGreaterThan(0);
      expect(res.categoryBreakdown.length).toBe(2);

      const equityCat = res.categoryBreakdown.find((c) => c.category === 'Equity Funds');
      expect(equityCat).toBeDefined();
      expect(equityCat?.avgTer).toBe(0.75); // Direct equity rule: 0.75%

      const debtCat = res.categoryBreakdown.find((c) => c.category === 'Debt Funds' || c.category === 'Liquid / Money Market');
      expect(debtCat).toBeDefined();
    });

    it('handles empty holdings with zero fees and TER', () => {
      const res = calculateExpenseAnalysis([]);
      expect(res.totalAnnualFees).toBe(0);
      expect(res.weightedAvgTer).toBe(0);
      expect(res.categoryBreakdown).toEqual([]);
    });
  });

  describe('Transactions Repository & Folio Lifecycle in SQLite', () => {
    let db: ReturnType<typeof createInMemoryDatabase>;

    beforeEach(async () => {
      db = createInMemoryDatabase();
      await db.execAsync(CREATE_TABLES_SQL);
    });

    it('inserts, retrieves, and deletes transactions by folio number', async () => {
      await upsertTransaction(db, {
        id: 'tx-1',
        folio_number: 'FOLIO-TEST-1',
        date: '2026-01-15',
        type: 'PURCHASE',
        units: 50,
        nav: 100,
        amount: 5000,
        created_at: '2026-01-15T00:00:00Z',
      });

      await upsertTransaction(db, {
        id: 'tx-2',
        folio_number: 'FOLIO-TEST-1',
        date: '2026-03-20',
        type: 'REDEMPTION',
        units: -20,
        nav: 110,
        amount: 2200,
        created_at: '2026-03-20T00:00:00Z',
      });

      const txs = await getTransactionsByFolio(db, 'FOLIO-TEST-1');
      expect(txs.length).toBe(2);
      expect(txs[0]?.id).toBe('tx-2'); // Sorted descending by date
      expect(txs[1]?.id).toBe('tx-1');

      await deleteFolioAndTransactions(db, 'FOLIO-TEST-1');
      const emptyTxs = await getTransactionsByFolio(db, 'FOLIO-TEST-1');
      expect(emptyTxs.length).toBe(0);
    });
  });

  describe('Manual Asset Onboarding Service', () => {
    let db: ReturnType<typeof createInMemoryDatabase>;

    beforeEach(async () => {
      db = createInMemoryDatabase();
      await db.execAsync(CREATE_TABLES_SQL);
    });

    it('onboards manual physical gold or SGB with synthetic folio and holding', async () => {
      const payload: AddManualAssetPayload = {
        type: 'SGB',
        name: 'Sovereign Gold Bond 2026-27 Series I',
        units: 10,
        balanceDate: '2026-11-20',
        pan: 'ABCDE1234F',
      };

      await addManualAsset(payload, db);
      const holdings = await db.getAllAsync<{ folio_number: string; asset_class: string; units: number }>(
        'SELECT * FROM holdings WHERE scheme_name = ?',
        ['Sovereign Gold Bond 2026-27 Series I'],
      );
      expect(holdings.length).toBe(1);
      expect(holdings[0]?.asset_class).toBe('GOLD');
      expect(holdings[0]?.units).toBe(10);
      expect(holdings[0]?.folio_number).toContain('MANUAL_SGB_');

      const txs = await getTransactionsByFolio(db, holdings[0]!.folio_number);
      expect(txs.length).toBe(1);
      expect(txs[0]?.type).toBe('PURCHASE');
    });

    it('onboards manual real estate holding correctly', async () => {
      const payload: AddManualAssetPayload = {
        type: 'REAL_ESTATE',
        name: 'Residential Apartment, Pune',
        units: 1,
        balanceDate: '2026-11-20',
      };

      await addManualAsset(payload, db);
      const holdings = await db.getAllAsync<{ asset_class: string }>(
        'SELECT * FROM holdings WHERE scheme_name = ?',
        ['Residential Apartment, Pune'],
      );
      expect(holdings.length).toBe(1);
      expect(holdings[0]?.asset_class).toBe('REAL_ESTATE');
    });
  });
});
