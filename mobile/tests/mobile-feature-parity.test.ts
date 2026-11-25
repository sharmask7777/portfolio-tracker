/**
 * @file mobile-feature-parity.test.ts
 * @description Unit tests for Mobile Feature Parity (P1):
 * 1. Transaction Ledger Sheet & Repository
 * 2. Closed Positions Section
 * 3. Schedule CG CSV Exporter
 * 4. Expense Ratio Analysis Card & Calculator
 * 5. Manual Asset Onboarding Service & Modal
 * 6. Withdrawal Simulation Parity Check
 */

import React from 'react';

// Set up React hook dispatcher for testing functional components in Node
// @ts-expect-error React internals for test runner
React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
  useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, vi.fn()],
  useEffect: (fn: () => void) => fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => ({}),
};

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
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

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('lucide-react-native', () => ({
  Calculator: (props: Record<string, unknown>) => ({ type: 'Calculator', props }),
  ChevronDown: (props: Record<string, unknown>) => ({ type: 'ChevronDown', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
}));
import {
  SECURE_STORE_KEYS,
} from '../src/services/auth-service';
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
  simulateWithdrawal,
  type WithdrawalSimulationParams,
} from '../src/services/tax-simulation-service';
import type { SimulationSellRequest } from '../src/types/generated/SimulationSellRequest';
import type { SimulationSellResponse } from '../src/types/generated/SimulationSellResponse';
import type { RealizedGain } from '../src/types/generated/RealizedGain';
import { FolioChildRow } from '../src/components/Holdings/FolioChildRow';
import type { FolioInput } from '@portfolio/core-view';
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
      expect(holdings[0]?.folio_number).toMatch(/^MANUAL_\d+/);

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

  describe('Withdrawal Simulation Parity Check', () => {
    function findByTestId(tree: unknown, testID: string): Record<string, unknown> | null {
      if (!tree || typeof tree !== 'object') return null;
      const node = tree as { props?: Record<string, unknown>; type?: unknown };
      if (node.props?.['testID'] === testID) {
        return node.props;
      }
      if (typeof node.type === 'function') {
        try {
          const rendered = (node.type as (props: Record<string, unknown>) => unknown)(node.props ?? {});
          const foundInRendered = findByTestId(rendered, testID);
          if (foundInRendered) return foundInRendered;
        } catch {
          // Functional component evaluation fallback
        }
      }
      const children = node.props?.['children'];
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findByTestId(child, testID);
          if (found) return found;
        }
      } else if (children && typeof children === 'object') {
        return findByTestId(children, testID);
      }
      return null;
    }

    function createMockRealizedGain(overrides: Partial<RealizedGain> = {}): RealizedGain {
      return {
        assetName: 'Parag Parikh Flexi Cap Fund',
        folioNumber: 'PP-101',
        isin: 'INF879O01027',
        pan: 'ABCDE1234F',
        assetClass: 'Equity',
        section: 'Sec112A12_5',
        buyDate: '2023-01-15',
        sellDate: '2026-11-23',
        holdingPeriodDays: 1408,
        holdingType: 'LongTerm',
        units: 100,
        buyNav: 500,
        sellNav: 750,
        grossConsideration: 75000,
        costOfAcquisition: 50000,
        fmvAsOfJan312018: 0,
        totalFmvJan312018: 0,
        deemedCostOfAcquisition: 50000,
        transferExpenses: 0,
        gain: 25000,
        taxType: 'Ltcg',
        taxRate: 0.125,
        taxBeforeCess: 3125,
        cess: 125,
        estimatedTax: 3250,
        isGrandfathered: false,
        grandfatheredStatus: 'Not Applicable',
        advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
        ...overrides,
      };
    }

    function createMockBackendResponse(
      overrides: Partial<SimulationSellResponse> = {},
    ): SimulationSellResponse {
      return {
        assetName: 'Parag Parikh Flexi Cap Fund',
        unitsToSell: 50,
        estimatedValue: 7500,
        totalGain: 2500,
        taxableGain: 2500,
        estimatedTax: 325,
        exitLoad: 0,
        taxBreakdown: {
          stcg: { amount: 0, tax: 0, cess: 0 },
          ltcg: { amount: 2500, tax: 312.5, cess: 12.5 },
          slab: { amount: 0, tax: 0, cess: 0 },
          totalTax: 325,
        },
        matchedLots: [createMockRealizedGain()],
        ...overrides,
      };
    }

    beforeEach(() => {
      mockStorage.clear();
      mockFetch.mockReset();
    });

    describe('Contract Parity', () => {
      it('conforms to generated SimulationSellRequest schema and targets /api/tax/simulate-sell', async () => {
        mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.portfolio.local');
        mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'valid-jwt-token');

        let capturedUrl: string | undefined;
        let capturedMethod: string | undefined;
        let capturedHeaders: Record<string, string> | undefined;
        let capturedBody: SimulationSellRequest | undefined;

        mockFetch.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = url.toString();
          if (urlStr.includes('/health')) {
            return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
          }
          if (urlStr.includes('/api/tax/simulate-sell')) {
            capturedUrl = urlStr;
            capturedMethod = init?.method;
            capturedHeaders = init?.headers as Record<string, string>;
            if (init?.body) {
              capturedBody = JSON.parse(init.body as string) as SimulationSellRequest;
            }
            return {
              ok: true,
              status: 200,
              json: async () => createMockBackendResponse(),
            };
          }
          return { ok: false, status: 404 };
        });

        const params: WithdrawalSimulationParams = {
          folioId: 'FOLIO-CANONICAL-01',
          schemeName: 'Nippon India Large Cap Fund',
          assetClass: 'EQUITY',
          isElss: false,
          unitsToSell: 50,
          currentNav: 150,
          taxSlab: 0.30,
        };

        const result = await simulateWithdrawal(params);
        expect(result).toBeDefined();

        expect(capturedUrl).toBe('https://api.portfolio.local/api/tax/simulate-sell');
        expect(capturedMethod).toBe('POST');
        expect(capturedHeaders?.['Content-Type']).toBe('application/json');
        expect(capturedHeaders?.['Authorization']).toBe('Bearer valid-jwt-token');

        expect(capturedBody).toBeDefined();
        expect(capturedBody?.folioId).toBe('FOLIO-CANONICAL-01');
        expect(capturedBody?.assetName).toBe('Nippon India Large Cap Fund');
        expect(capturedBody?.assetType).toBe('MUTUAL_FUND');
        expect(capturedBody?.units).toBe(50);
        expect(capturedBody?.currentPrice).toBe(150);
        expect(capturedBody?.taxSlab).toBe(0.30);
        expect(typeof capturedBody?.sellDate).toBe('string');
      });

      it('maps DEBT asset class to DEBT assetType in request body', async () => {
        mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.portfolio.local');
        mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'valid-jwt-token');

        let capturedBody: SimulationSellRequest | undefined;
        mockFetch.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = url.toString();
          if (urlStr.includes('/health')) {
            return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
          }
          if (urlStr.includes('/api/tax/simulate-sell')) {
            if (init?.body) {
              capturedBody = JSON.parse(init.body as string) as SimulationSellRequest;
            }
            return {
              ok: true,
              status: 200,
              json: async () => createMockBackendResponse(),
            };
          }
          return { ok: false, status: 404 };
        });

        await simulateWithdrawal({
          folioId: 'DEBT-FOLIO-01',
          schemeName: 'HDFC Corporate Bond Fund',
          assetClass: 'DEBT',
          unitsToSell: 100,
          currentNav: 25,
        });

        expect(capturedBody?.assetType).toBe('DEBT');
      });
    });

    describe('Calculation Reconciliation', () => {
      it('preserves exact gross value, total gain, tax liability, exit load, and net in-hand proceeds (Delta = 0)', async () => {
        mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.portfolio.local');
        mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'valid-jwt-token');

        const backendResponse: SimulationSellResponse = {
          assetName: 'Parag Parikh Flexi Cap Fund',
          unitsToSell: 100,
          estimatedValue: 75000,
          totalGain: 25000,
          taxableGain: 25000,
          estimatedTax: 3250,
          exitLoad: 750,
          taxBreakdown: {
            stcg: { amount: 0, tax: 0, cess: 0 },
            ltcg: { amount: 25000, tax: 3125, cess: 125 },
            slab: { amount: 0, tax: 0, cess: 0 },
            totalTax: 3250,
          },
          matchedLots: [
            createMockRealizedGain({
              assetName: 'Parag Parikh Flexi Cap Fund',
              folioNumber: 'PP-101',
              units: 100,
              buyNav: 500,
              sellNav: 750,
              grossConsideration: 75000,
              costOfAcquisition: 50000,
              deemedCostOfAcquisition: 50000,
              gain: 25000,
              taxType: 'Ltcg',
              taxRate: 0.125,
              taxBeforeCess: 3125,
              cess: 125,
              estimatedTax: 3250,
            }),
          ],
        };

        mockFetch.mockImplementation(async (url: string | URL | Request) => {
          const urlStr = url.toString();
          if (urlStr.includes('/health')) {
            return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
          }
          if (urlStr.includes('/api/tax/simulate-sell')) {
            return {
              ok: true,
              status: 200,
              json: async () => backendResponse,
            };
          }
          return { ok: false, status: 404 };
        });

        const result = await simulateWithdrawal({
          folioId: 'PP-101',
          schemeName: 'Parag Parikh Flexi Cap Fund',
          assetClass: 'EQUITY',
          unitsToSell: 100,
          currentNav: 750,
        });

        // Exact Zero-Delta assertions
        expect(result.grossValue).toBe(backendResponse.estimatedValue);
        expect(result.totalGain).toBe(backendResponse.totalGain);
        expect(result.totalTax).toBe(backendResponse.estimatedTax);
        expect(result.exitLoad).toBe(backendResponse.exitLoad);

        // Net in-hand proceeds: grossValue - exitLoad - totalTax = 75000 - 750 - 3250 = 71000
        const expectedNetProceeds = backendResponse.estimatedValue - backendResponse.exitLoad - backendResponse.estimatedTax;
        expect(result.netProceeds).toBe(expectedNetProceeds);
        expect(result.netProceeds).toBe(71000);

        // Value Conservation Law: grossValue = netProceeds + totalTax + exitLoad (Delta = 0)
        expect(result.netProceeds + result.totalTax + result.exitLoad).toBe(result.grossValue);

        // Statutory cess reconciliation: baseTax + cess = totalTax
        expect(result.baseTax + result.cess).toBe(result.totalTax);
        expect(result.baseTax).toBe(3125);
        expect(result.cess).toBe(125);

        // FIFO matched lots preserved
        expect(result.matchedLots.length).toBe(1);
        expect(result.matchedLots[0]?.deemedCost).toBe(50000);
        expect(result.matchedLots[0]?.gain).toBe(25000);
      });
    });

    describe('Statutory Tax Rates', () => {
      it('preserves Budget 2024 LTCG (12.5% + 4% cess) identically in online backend mapping and offline fallback', async () => {
        // 1. Online mapping
        mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.portfolio.local');
        mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'valid-jwt-token');

        const onlineBackendResponse: SimulationSellResponse = {
          assetName: 'Mirae Asset Large Cap Fund',
          unitsToSell: 100,
          estimatedValue: 20000,
          totalGain: 10000,
          taxableGain: 10000,
          estimatedTax: 1300,
          exitLoad: 0,
          taxBreakdown: {
            stcg: { amount: 0, tax: 0, cess: 0 },
            ltcg: { amount: 10000, tax: 1250, cess: 50 },
            slab: { amount: 0, tax: 0, cess: 0 },
            totalTax: 1300,
          },
          matchedLots: [
            createMockRealizedGain({
              units: 100,
              gain: 10000,
              taxType: 'Ltcg',
              taxRate: 0.125,
              taxBeforeCess: 1250,
              cess: 50,
              estimatedTax: 1300,
            }),
          ],
        };

        mockFetch.mockImplementation(async (url: string | URL | Request) => {
          const urlStr = url.toString();
          if (urlStr.includes('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
          if (urlStr.includes('/api/tax/simulate-sell')) return { ok: true, status: 200, json: async () => onlineBackendResponse };
          return { ok: false, status: 404 };
        });

        const onlineResult = await simulateWithdrawal({
          unitsToSell: 100,
          currentNav: 200,
          assetClass: 'EQUITY',
        });

        expect(onlineResult.ltcgGain).toBe(10000);
        expect(onlineResult.baseTax).toBe(1250);
        expect(onlineResult.cess).toBe(50);
        expect(onlineResult.totalTax).toBe(1300);
        expect(onlineResult.matchedLots[0]?.taxRate).toBe(0.125);

        // 2. Offline fallback
        mockStorage.clear();
        mockFetch.mockReset();

        const offlineResult = await simulateWithdrawal({
          unitsToSell: 100,
          currentNav: 200,
          assetClass: 'EQUITY',
          lots: [
            {
              lotId: 'LOT-OFFLINE-LTCG',
              buyDate: '2023-01-15',
              units: 100,
              buyPrice: 100,
              isElss: false,
            },
          ],
        });

        expect(offlineResult.ltcgGain).toBe(10000);
        expect(offlineResult.matchedLots[0]?.taxRate).toBe(0.125);
        expect(offlineResult.baseTax).toBe(1250);
        expect(offlineResult.cess).toBe(50);
        expect(offlineResult.totalTax).toBe(1300);

        // Parity comparison (Delta = 0)
        expect(offlineResult.matchedLots[0]?.taxRate).toBe(onlineResult.matchedLots[0]?.taxRate);
        expect(offlineResult.baseTax).toBe(onlineResult.baseTax);
        expect(offlineResult.cess).toBe(onlineResult.cess);
        expect(offlineResult.totalTax).toBe(onlineResult.totalTax);
      });

      it('preserves Budget 2024 STCG (20% + 4% cess) identically in online backend mapping and offline fallback', async () => {
        // 1. Online mapping
        mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.portfolio.local');
        mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'valid-jwt-token');

        const onlineBackendResponse: SimulationSellResponse = {
          assetName: 'Axis Small Cap Fund',
          unitsToSell: 50,
          estimatedValue: 10000,
          totalGain: 4000,
          taxableGain: 4000,
          estimatedTax: 832,
          exitLoad: 0,
          taxBreakdown: {
            stcg: { amount: 4000, tax: 800, cess: 32 },
            ltcg: { amount: 0, tax: 0, cess: 0 },
            slab: { amount: 0, tax: 0, cess: 0 },
            totalTax: 832,
          },
          matchedLots: [
            createMockRealizedGain({
              units: 50,
              gain: 4000,
              taxType: 'Stcg',
              taxRate: 0.20,
              taxBeforeCess: 800,
              cess: 32,
              estimatedTax: 832,
            }),
          ],
        };

        mockFetch.mockImplementation(async (url: string | URL | Request) => {
          const urlStr = url.toString();
          if (urlStr.includes('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
          if (urlStr.includes('/api/tax/simulate-sell')) return { ok: true, status: 200, json: async () => onlineBackendResponse };
          return { ok: false, status: 404 };
        });

        const onlineResult = await simulateWithdrawal({
          unitsToSell: 50,
          currentNav: 200,
          assetClass: 'EQUITY',
        });

        expect(onlineResult.stcgGain).toBe(4000);
        expect(onlineResult.baseTax).toBe(800);
        expect(onlineResult.cess).toBe(32);
        expect(onlineResult.totalTax).toBe(832);
        expect(onlineResult.matchedLots[0]?.taxRate).toBe(0.20);

        // 2. Offline fallback
        mockStorage.clear();
        mockFetch.mockReset();

        const offlineResult = await simulateWithdrawal({
          unitsToSell: 50,
          currentNav: 200,
          assetClass: 'EQUITY',
          lots: [
            {
              lotId: 'LOT-OFFLINE-STCG',
              buyDate: '2026-09-01',
              units: 50,
              buyPrice: 120,
              isElss: false,
            },
          ],
        });

        expect(offlineResult.stcgGain).toBe(4000);
        expect(offlineResult.matchedLots[0]?.taxRate).toBe(0.20);
        expect(offlineResult.baseTax).toBe(800);
        expect(offlineResult.cess).toBe(32);
        expect(offlineResult.totalTax).toBe(832);

        // Parity comparison (Delta = 0)
        expect(offlineResult.matchedLots[0]?.taxRate).toBe(onlineResult.matchedLots[0]?.taxRate);
        expect(offlineResult.baseTax).toBe(onlineResult.baseTax);
        expect(offlineResult.cess).toBe(onlineResult.cess);
        expect(offlineResult.totalTax).toBe(onlineResult.totalTax);
      });
    });

    describe('Action Parity', () => {
      const sampleFolio: FolioInput = {
        id: 'folio-abc-123',
        number: '123456/78',
        folioNumber: '123456/78',
        amcName: 'SBI Mutual Fund',
        units: 250,
        currentNav: 120,
        pan: 'ABCDE1234F',
        metrics: {
          investedAmount: 25000,
          currentValue: 30000,
          dayChange: 600,
          dayChangePercentage: 2.04,
          xirr: 0.18,
          absoluteReturn: 0.20,
          currentPrice: 120,
        },
      };

      it('exposes withdrawal simulation button matching Web FolioRowActionButtons calculator trigger', () => {
        const onSimulateWithdrawal = vi.fn();
        const onSimulate = vi.fn();

        const element = FolioChildRow({
          folio: sampleFolio,
          performanceMode: 'XIRR',
          onSimulateWithdrawal,
          onSimulate,
        });

        // Matches Web's testID / action button presence
        const simButton = findByTestId(element, 'folio-simulate-btn-folio-abc-123');
        expect(simButton).not.toBeNull();
        expect(simButton?.['accessibilityRole']).toBe('button');
        expect(simButton?.['accessibilityLabel']).toBe('Simulate withdrawal for folio 123456/78');

        // Trigger simulate press
        const pressHandler = simButton?.['onPress'] as (() => void) | undefined;
        expect(typeof pressHandler).toBe('function');
        pressHandler?.();

        // Verifies both handlers invoked with the folio data
        expect(onSimulateWithdrawal).toHaveBeenCalledTimes(1);
        expect(onSimulateWithdrawal).toHaveBeenCalledWith(sampleFolio);
        expect(onSimulate).toHaveBeenCalledTimes(1);
        expect(onSimulate).toHaveBeenCalledWith(sampleFolio);
      });

      it('handles optional simulation callback safely without throw', () => {
        const element = FolioChildRow({
          folio: sampleFolio,
          performanceMode: 'ABS',
        });

        const simButton = findByTestId(element, 'folio-simulate-btn-folio-abc-123');
        expect(simButton).not.toBeNull();
        const pressHandler = simButton?.['onPress'] as (() => void) | undefined;
        expect(() => pressHandler?.()).not.toThrow();
      });
    });
  });
});
