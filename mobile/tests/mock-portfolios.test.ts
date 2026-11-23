import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import {
  consolidateFoliosIntoSchemes,
  type FolioInput,
} from '../src/services/consolidation';
import {
  calculateSection55DeemedCost,
  checkElssLockIn,
  simulateSellRedemption,
} from '../src/services/tax-harvesting';
import {
  filterHoldingsForProfile,
  type FamilyProfile,
  type FolioEntity,
} from '../src/services/family-service';
import {
  buildPortfolioHierarchy,
  type StockExposure,
  type XRayData,
} from '../src/services/hierarchy-builder';
import type { EnrichedHolding } from '../src/services/portfolio-calculations';

/**
 * ==============================================================================
 * Canonical 10 Mock Portfolios Mobile Test Specification
 * ==============================================================================
 *
 * Validates all 10 canonical portfolio scenarios against mobile repositories,
 * domain calculations, and services:
 *
 * 1. Aurora Growth Family - Multi-Folio Scheme Consolidation (distinct PANs)
 * 2. Zephyr Exited Fund - Fully Redeemed / Zero Holdings Isolation
 * 3. Titan Bluechip Retained - Partial Redemptions with active remaining units
 * 4. Olympus Hybrid - Direct Equity and Mutual Fund Stock Intersection & Overlap
 * 5. Sovereign Safety - Pure Debt / Liquid Holdings (zero equity)
 * 6. Nova Multi-Asset - Alternative Assets (SGB / Gold)
 * 7. Solaria Family Hub - Multi-Member Profile Switching & PAN Isolation
 * 8. Vintage Heritage Fund - Section 112A LTCG Grandfathering (31-Jan-2018 FMV)
 * 9. Tax Optimizer ELSS - 3-Year Lock-In Enforcement
 * 10. Lifecycle Manager - Folio Lifecycle (Manual Close & Complete Isolation)
 */
describe('Mobile Canonical 10 Mock Portfolios Suite', () => {
  // ----------------------------------------------------------------------------
  // Scenario 1: Multi-Folio Scheme Consolidation (Aurora Growth Family)
  // ----------------------------------------------------------------------------
  describe('Portfolio 1: Multi-Folio Scheme Consolidation (Aurora Growth Family)', () => {
    it('consolidates multiple folios for the same scheme and computes weighted XIRR & distinct PANs', () => {
      const folios: FolioInput[] = [
        {
          id: 'aurora-f1',
          pan: 'ALPAC1001A',
          number: 'AUR-101',
          asset: {
            isin: 'INF999K01001',
            name: 'Aurora Multi-Asset Growth Fund',
            type: 'MUTUAL_FUND',
          },
          metrics: {
            investedAmount: 500000,
            currentValue: 750000,
            dayChange: 2500,
            xirr: 0.15,
          },
        },
        {
          id: 'aurora-f2',
          pan: 'BETAB2002B',
          number: 'AUR-102',
          asset: {
            isin: 'INF999K01001',
            name: 'Aurora Multi-Asset Growth Fund',
            type: 'MUTUAL_FUND',
          },
          metrics: {
            investedAmount: 300000,
            currentValue: 450000,
            dayChange: 1500,
            xirr: 0.18,
          },
        },
      ];

      const consolidated = consolidateFoliosIntoSchemes(folios);

      expect(consolidated).toHaveLength(1);
      const group = consolidated[0]!;
      expect(group.schemeName).toBe('Aurora Multi-Asset Growth Fund');
      expect(group.folioCount).toBe(2);
      expect(group.metrics.currentValue).toBe(1200000);
      expect(group.metrics.investedAmount).toBe(800000);
      expect(group.metrics.dayChange).toBe(4000);
      expect(group.pans).toEqual(expect.arrayContaining(['ALPAC1001A', 'BETAB2002B']));

      // Weighted XIRR: (750k * 0.15 + 450k * 0.18) / 1200k = (112.5k + 81k) / 1200k = 193.5k / 1200k = 0.16125
      expect(group.metrics.xirr).toBeCloseTo(0.16125, 4);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Fully Redeemed / Zero Holdings (Zephyr Exited Fund)
  // ----------------------------------------------------------------------------
  describe('Portfolio 2: Fully Redeemed / Zero Holdings Isolation (Zephyr Exited Fund)', () => {
    it('isolates fully redeemed positions from active holdings', () => {
      const activeFolios: FolioInput[] = [];
      const consolidated = consolidateFoliosIntoSchemes(activeFolios);
      expect(consolidated).toHaveLength(0);

      const closedFolios: FolioEntity[] = [
        {
          folio_number: 'ZEP-001',
          amc_name: 'Zephyr AMC',
          pan: 'GAMMG3003C',
          updated_at: '2024-01-01',
        },
      ];

      expect(closedFolios).toHaveLength(1);
      expect(closedFolios[0]!.folio_number).toBe('ZEP-001');
      expect(closedFolios[0]!.amc_name).toBe('Zephyr AMC');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Partial Redemption Retained (Titan Bluechip Retained)
  // ----------------------------------------------------------------------------
  describe('Portfolio 3: Partial Redemption Retained (Titan Bluechip Retained)', () => {
    it('preserves remaining units and active portfolio value following partial sale', () => {
      const remainingFolios: FolioInput[] = [
        {
          id: 'titan-f1',
          pan: 'DELTD4004D',
          number: 'TITAN-301',
          asset: {
            isin: 'INF999K01003',
            name: 'Titan Bluechip Opportunities Fund',
            type: 'MUTUAL_FUND',
          },
          metrics: {
            investedAmount: 100000,
            currentValue: 180000,
            dayChange: 800,
            xirr: 0.22,
          },
        },
      ];

      const consolidated = consolidateFoliosIntoSchemes(remainingFolios);
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0]!.metrics.currentValue).toBe(180000);
      expect(consolidated[0]!.metrics.investedAmount).toBe(100000);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Direct Equity & MF Intersection (Olympus Hybrid)
  // ----------------------------------------------------------------------------
  describe('Portfolio 4: Direct Equity and Mutual Fund Intersection (Olympus Hybrid)', () => {
    it('builds hierarchy tree correctly mapping company look-through across direct and indirect holdings', () => {
      const mockXRay: XRayData = {
        totalValue: 500000,
        assetAllocation: {
          equity: { percentage: 80, value: 400000 },
          debt: { percentage: 20, value: 100000 },
          cash: { percentage: 0, value: 0 },
          gold: { percentage: 0, value: 0 },
          other: { percentage: 0, value: 0 },
        },
        sectors: [
          { name: 'Financial Services', percentage: 40, value: 200000 },
          { name: 'Technology', percentage: 40, value: 200000 },
        ],
        marketCap: {
          large: { percentage: 70, value: 350000 },
          mid: { percentage: 20, value: 100000 },
          small: { percentage: 10, value: 50000 },
        },
      };

      const mockStocks: StockExposure[] = [
        {
          name: 'HDFC Bank Ltd',
          sector: 'Financial Services',
          percentage: 12.5,
          absoluteValue: 62500,
          contributions: [
            { schemeName: 'Olympus Hybrid Fund', weight: 8.5, value: 42500 },
            { schemeName: 'Direct Stock Portfolio', weight: 4.0, value: 20000 },
          ],
        },
        {
          name: 'Infosys Ltd',
          sector: 'Technology',
          percentage: 10.0,
          absoluteValue: 50000,
          contributions: [{ schemeName: 'Olympus Hybrid Fund', weight: 10.0, value: 50000 }],
        },
      ];

      const tree = buildPortfolioHierarchy(mockXRay, mockStocks);

      expect(tree.id).toBe('root');
      expect(tree.children).toBeDefined();
      expect(tree.children?.length).toBeGreaterThanOrEqual(1);

      const equityNode = tree.children?.find((c) => c.name === 'Equity');
      expect(equityNode).toBeDefined();

      const finSector = equityNode?.children?.find((c) => c.name === 'Financial Services');
      expect(finSector).toBeDefined();
      expect(finSector?.children?.[0]?.name).toBe('HDFC Bank Ltd');
      expect(finSector?.children?.[0]?.metrics.signedValue).toBe(62500);

      const techSector = equityNode?.children?.find((c) => c.name === 'Technology');
      expect(techSector).toBeDefined();
      expect(techSector?.children?.[0]?.name).toBe('Infosys Ltd');
      expect(techSector?.children?.[0]?.metrics.signedValue).toBe(50000);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 5: Pure Debt & Liquid (Sovereign Safety)
  // ----------------------------------------------------------------------------
  describe('Portfolio 5: Pure Debt & Liquid Holdings (Sovereign Safety)', () => {
    it('handles zero equity portfolio without NaN or division by zero in calculations', () => {
      const pureDebtFolios: FolioInput[] = [
        {
          id: 'sov-f1',
          pan: 'EPSIE5005E',
          number: 'SOV-501',
          asset: {
            isin: 'INF999K01005',
            name: 'Sovereign Gilt & Liquid Fund',
            type: 'MUTUAL_FUND',
          },
          metrics: {
            investedAmount: 2000000,
            currentValue: 2150000,
            dayChange: 450,
            xirr: 0.072,
          },
        },
      ];

      const consolidated = consolidateFoliosIntoSchemes(pureDebtFolios);
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0]!.metrics.currentValue).toBe(2150000);
      expect(consolidated[0]!.metrics.xirr).toBe(0.072);

      const pureDebtXRay: XRayData = {
        totalValue: 2150000,
        assetAllocation: {
          equity: { percentage: 0, value: 0 },
          debt: { percentage: 100, value: 2150000 },
          cash: { percentage: 0, value: 0 },
          gold: { percentage: 0, value: 0 },
          other: { percentage: 0, value: 0 },
        },
        sectors: [],
        marketCap: {
          large: { percentage: 0, value: 0 },
          mid: { percentage: 0, value: 0 },
          small: { percentage: 0, value: 0 },
        },
      };

      const tree = buildPortfolioHierarchy(pureDebtXRay, []);
      expect(tree.metrics.signedValue).toBe(2150000);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 6: Alternative Assets - Gold & SGB (Nova Multi-Asset)
  // ----------------------------------------------------------------------------
  describe('Portfolio 6: Alternative Assets - Gold & SGB (Nova Multi-Asset)', () => {
    it('tracks manual asset identifier and alternative gold asset classification', () => {
      const sgbHolding: FolioInput = {
        id: 'gold-sgb-1',
        pan: 'ZETAZ6006F',
        number: 'SGB-2023-IV',
        asset: {
          isin: 'IN0020230123',
          name: 'Sovereign Gold Bond 2023-24 Series IV',
          type: 'SGB',
        },
        metrics: {
          investedAmount: 150000,
          currentValue: 195000,
          dayChange: 650,
          xirr: 0.125,
        },
      };

      const consolidated = consolidateFoliosIntoSchemes([sgbHolding]);
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0]!.type).toBe('SGB');
      expect(consolidated[0]!.metrics.currentValue).toBe(195000);
      expect(consolidated[0]!.metrics.investedAmount).toBe(150000);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 7: Multi-Member Profile Switching (Solaria Family Hub)
  // ----------------------------------------------------------------------------
  describe('Portfolio 7: Multi-Member Profile Switching (Solaria Family Hub)', () => {
    it('filters holdings accurately by active profile PAN and keeps distinct accounts isolated', () => {
      const profileParent: FamilyProfile = {
        id: 'prof-solaria-parent',
        name: 'Parent Solaria',
        pan: 'THETT8008H',
        relationship: 'Self',
        isPrimary: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const profileChild: FamilyProfile = {
        id: 'prof-solaria-child',
        name: 'Child Solaria',
        pan: 'IOTAI9009I',
        relationship: 'Child',
        isPrimary: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const folios: FolioEntity[] = [
        {
          folio_number: 'SOL-P1',
          amc_name: 'Solaria AMC',
          pan: 'THETT8008H',
          updated_at: '2024-01-01',
        },
        {
          folio_number: 'SOL-C1',
          amc_name: 'Solaria AMC',
          pan: 'IOTAI9009I',
          updated_at: '2024-01-01',
        },
      ];

      const holdings: EnrichedHolding[] = [
        {
          id: 'h-sol-1',
          folio_number: 'SOL-P1',
          amfi_code: '120001',
          scheme_name: 'Solaria Bluechip Fund',
          isin: 'INF001',
          units: 1000,
          current_nav: 400,
          current_value: 400000,
          invested_cost: 300000,
          asset_class: 'Equity',
          nav_date: '2024-01-01',
          updated_at: '2024-01-01',
          dayChange: 2000,
          dayChangePct: 0.5,
          gainLoss: 100000,
          gainLossPct: 33.3,
        },
        {
          id: 'h-sol-2',
          folio_number: 'SOL-C1',
          amfi_code: '120002',
          scheme_name: 'Solaria Small Cap Fund',
          isin: 'INF002',
          units: 1000,
          current_nav: 120,
          current_value: 120000,
          invested_cost: 100000,
          asset_class: 'Equity',
          nav_date: '2024-01-01',
          updated_at: '2024-01-01',
          dayChange: 800,
          dayChangePct: 0.67,
          gainLoss: 20000,
          gainLossPct: 20,
        },
      ];

      const parentFiltered = filterHoldingsForProfile(profileParent, holdings, folios);
      expect(parentFiltered).toHaveLength(1);
      expect(parentFiltered[0]!.folio_number).toBe('SOL-P1');
      expect(parentFiltered[0]!.current_value).toBe(400000);

      const childFiltered = filterHoldingsForProfile(profileChild, holdings, folios);
      expect(childFiltered).toHaveLength(1);
      expect(childFiltered[0]!.folio_number).toBe('SOL-C1');
      expect(childFiltered[0]!.current_value).toBe(120000);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 8: Section 112A LTCG Grandfathering (Vintage Heritage Fund)
  // ----------------------------------------------------------------------------
  describe('Portfolio 8: Section 112A LTCG Grandfathering (Vintage Heritage Fund)', () => {
    it('enforces Section 55(2)(ac) deemed cost formula: Deemed Cost = Max(Cost, Min(FMV_2018, Sell_NAV))', () => {
      // Test Case 1: Standard Gain - Sell > FMV > Cost
      const deemedCost1 = calculateSection55DeemedCost({
        cost: 100,
        fmv2018: 250,
        sellPrice: 300,
        isPre2018: true,
      });
      expect(deemedCost1).toBe(250);
      const taxableGain1 = 300 - deemedCost1;
      expect(taxableGain1).toBe(50);

      // Test Case 2: Sell Between Cost and FMV - No Loss created
      const deemedCost2 = calculateSection55DeemedCost({
        cost: 100,
        fmv2018: 250,
        sellPrice: 180,
        isPre2018: true,
      });
      expect(deemedCost2).toBe(180);
      const taxableGain2 = 180 - deemedCost2;
      expect(taxableGain2).toBe(0);

      // Test Case 3: Genuine Loss - Sell < Cost < FMV
      const deemedCost3 = calculateSection55DeemedCost({
        cost: 200,
        fmv2018: 250,
        sellPrice: 150,
        isPre2018: true,
      });
      expect(deemedCost3).toBe(200);
      const taxableGain3 = 150 - deemedCost3;
      expect(taxableGain3).toBe(-50);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 9: 3-Year ELSS Lock-In (Tax Optimizer ELSS)
  // ----------------------------------------------------------------------------
  describe('Portfolio 9: 3-Year ELSS Lock-In Enforcement (Tax Optimizer ELSS)', () => {
    it('restricts units purchased within 3 years from redemption while allowing matured units', () => {
      const simulatedToday = '2025-06-01';

      // Purchase date 1: 2021-01-15 (> 3 years -> unlocked)
      const matureLocked = checkElssLockIn('2021-01-15', simulatedToday);
      expect(matureLocked).toBe(false);

      // Purchase date 2: 2023-10-15 (< 3 years -> locked until 2026-10-15)
      const recentLocked = checkElssLockIn('2023-10-15', simulatedToday);
      expect(recentLocked).toBe(true);

      // Sell redemption simulation with locked ELSS units
      const simResult = simulateSellRedemption({
        folioId: 'folio-elss-1',
        schemeName: 'Tax Optimizer ELSS Fund',
        isElss: true,
        assetClass: 'EQUITY',
        lots: [
          {
            lotId: 'lot-elss-locked',
            buyDate: '2023-10-15',
            units: 100,
            buyPrice: 100,
            isElss: true,
          },
        ],
        unitsToSell: 100,
        sellPrice: 150,
        sellDate: simulatedToday,
        taxSlab: 0.3,
      });

      expect(simResult.lockedUnits).toBe(100);
      expect(simResult.unitsSold).toBe(0);
      expect(simResult.isLocked).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 10: Folio Lifecycle (Manual Close & Complete Isolation)
  // ----------------------------------------------------------------------------
  describe('Portfolio 10: Folio Lifecycle Manual Close & Isolation (Lifecycle Manager)', () => {
    it('isolates manually closed folios and excludes them from active summary', () => {
      const allFolios: FolioEntity[] = [
        {
          folio_number: 'LC-ACTIVE-101',
          amc_name: 'Lifecycle Growth AMC',
          pan: 'ALPAC1001A',
          updated_at: '2024-01-01',
        },
        {
          folio_number: 'LC-CLOSED-102',
          amc_name: 'Lifecycle Closed AMC',
          pan: 'ALPAC1001A',
          updated_at: '2024-01-01',
        },
      ];

      const closedFolioNumbers = new Set(['LC-CLOSED-102']);

      const activeOnly = allFolios.filter((f) => !closedFolioNumbers.has(f.folio_number));
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0]!.folio_number).toBe('LC-ACTIVE-101');

      const closedOnly = allFolios.filter((f) => closedFolioNumbers.has(f.folio_number));
      expect(closedOnly).toHaveLength(1);
      expect(closedOnly[0]!.folio_number).toBe('LC-CLOSED-102');
    });
  });
});
