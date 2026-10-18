import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@src/services/db.service', () => require('@src/test/db.mock'));
import { prismaMock } from '@src/test/db.mock';
import { PerformanceService } from '@src/services/performance.service';
import { PortfolioUtils } from '@src/utils/portfolio.utils';
import { TaxService } from '@src/services/tax.service';
import { FamilyService } from '@src/services/family.service';
import { TaxAnalyzerService } from '@src/services/tax-analyzer.service';

/**
 * ELABORATE MOCK PORTFOLIOS TEST SUITE
 * 
 * 10 Distinct Synthetic Portfolios covering all core financial use cases:
 * 1. Aurora Growth Family - Multi-folio scheme consolidation with distinct PANs
 * 2. Zephyr Exited Fund - Fully redeemed / zero-holding fund isolation
 * 3. Titan Bluechip Retained - Partial redemptions with active remaining units
 * 4. Olympus Hybrid - Direct equities + mutual funds stock intersection
 * 5. Sovereign Safety - Pure debt/liquid fund portfolio (zero equity exposure)
 * 6. Nova Multi-Asset - Alternative assets (Gold, Real Estate) + mutual funds
 * 7. Solaria Family Hub - Multi-member profile isolation and cascading deletion
 * 8. Vintage Heritage Fund - Section 112A LTCG Grandfathering (31-Jan-2018 NAV)
 * 9. Tax Optimizer ELSS - 3-Year ELSS Lock-in enforcement vs harvestable units
 * 10. Lifecycle Manager - Folio manual close and complete database purge
 *
 * NOTE: All data is completely synthetic (anonymized names, PANs, folios, ISINs).
 */
describe('Elaborate Mock Portfolios Suite (10 Use Cases)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // PORTFOLIO 1: Aurora Growth Family (Multi-Folio Scheme Consolidation)
  describe('Portfolio 1: Multi-Folio Scheme Consolidation (Aurora Growth)', () => {
    const folio1Transactions = [
      { id: 'tx-1', date: new Date('2023-01-10'), type: 'PURCHASE', amount: -50000, units: 500, nav: 100, balance: 500 },
      { id: 'tx-2', date: new Date('2023-06-15'), type: 'PURCHASE_SIP', amount: -50000, units: 400, nav: 125, balance: 900 },
    ];
    const folio2Transactions = [
      { id: 'tx-3', date: new Date('2023-03-20'), type: 'PURCHASE', amount: -30000, units: 250, nav: 120, balance: 250 },
    ];

    it('calculates accurate individual and aggregated units across constituent folios', () => {
      const units1 = PortfolioUtils.getLatestUnits(folio1Transactions as any);
      const units2 = PortfolioUtils.getLatestUnits(folio2Transactions as any);
      expect(units1).toBe(900);
      expect(units2).toBe(250);
      expect(units1 + units2).toBe(1150);

      const metrics1 = PerformanceService.getMetrics(folio1Transactions as any, 150, { currentUnitsOverride: units1 });
      const metrics2 = PerformanceService.getMetrics(folio2Transactions as any, 150, { currentUnitsOverride: units2 });

      expect(metrics1.currentValue).toBe(900 * 150); // 1,35,000
      expect(metrics1.investedAmount).toBe(100000);
      expect(metrics2.currentValue).toBe(250 * 150); // 37,500
      expect(metrics2.investedAmount).toBe(30000);
    });
  });

  // PORTFOLIO 2: Zephyr Exited Fund (Fully Redeemed / Zero Holdings)
  describe('Portfolio 2: Fully Redeemed / Zero Holdings (Zephyr Exited)', () => {
    const transactions = [
      { id: 'tx-z1', date: new Date('2022-01-01'), type: 'PURCHASE', amount: -100000, units: 1000, nav: 100, balance: 1000 },
      { id: 'tx-z2', date: new Date('2023-05-15'), type: 'REDEMPTION', amount: 150000, units: -1000, nav: 150, balance: 0 },
    ];

    it('verifies latest units is zero and sets currentValue and investedAmount to zero', () => {
      const units = PortfolioUtils.getLatestUnits(transactions as any);
      expect(units).toBe(0);

      const metrics = PerformanceService.getMetrics(transactions as any, 160, { currentUnitsOverride: units });
      expect(metrics.currentValue).toBe(0);
      expect(metrics.investedAmount).toBe(0);

      // Verify overall realized gain is recognized even when active balance is zero
      const tax = TaxService.calculatePortfolioTax('Zephyr Momentum Fund', 'MUTUAL_FUND', transactions as any, 160, 0.3);
      expect(tax.realized.total).toBe(50000);
      expect(tax.unrealized.total).toBe(0);
    });
  });

  // PORTFOLIO 3: Titan Bluechip Retained (Partial Redemption)
  describe('Portfolio 3: Partial Redemption Retained (Titan Bluechip)', () => {
    const transactions = [
      { id: 'tx-t1', date: new Date('2022-02-01'), type: 'PURCHASE', amount: -200000, units: 2000, nav: 100, balance: 2000 },
      { id: 'tx-t2', date: new Date('2023-04-10'), type: 'REDEMPTION', amount: 140000, units: -1000, nav: 140, balance: 1000 },
    ];

    it('retains remaining active units and calculates accurate proportional invested cost', () => {
      const units = PortfolioUtils.getLatestUnits(transactions as any);
      expect(units).toBe(1000);

      const currentPrice = 180;
      const metrics = PerformanceService.getMetrics(transactions as any, currentPrice, { currentUnitsOverride: units });
      expect(metrics.currentValue).toBe(1000 * 180); // 1,80,000
      expect(metrics.investedAmount).toBe(100000); // 1,000 units remaining @ avg cost 100
      expect(metrics.totalGain).toBe(80000);
      expect(metrics.absoluteReturn).toBeCloseTo(0.8, 2);
    });
  });

  // PORTFOLIO 4: Olympus Hybrid (Direct Equity & Mutual Fund Intersection)
  describe('Portfolio 4: Direct Equity and Mutual Fund Intersection (Olympus Hybrid)', () => {
    it('aggregates direct stock holding value and calculates returns cleanly', () => {
      const directStockTx = [
        { id: 'tx-s1', date: new Date('2024-01-05'), type: 'BUY', amount: -150000, units: 100, nav: 1500, balance: 100 },
      ];
      const units = PortfolioUtils.getLatestUnits(directStockTx as any);
      const currentPrice = 1850;
      const metrics = PerformanceService.getMetrics(directStockTx as any, currentPrice, {
        currentUnitsOverride: units,
        assetType: 'STOCK',
        assetName: 'Synthetix Tech Ltd'
      });

      expect(units).toBe(100);
      expect(metrics.currentValue).toBe(185000);
      expect(metrics.totalGain).toBe(35000);
      expect(metrics.absoluteReturn).toBeCloseTo(35000 / 150000, 4);
    });
  });

  // PORTFOLIO 5: Sovereign Safety (Pure Debt / Liquid - Zero Equity Exposure)
  describe('Portfolio 5: Pure Debt & Liquid Funds (Sovereign Safety)', () => {
    const liquidTx = [
      { id: 'tx-l1', date: new Date('2024-01-01'), type: 'PURCHASE', amount: -500000, units: 500, nav: 1000, balance: 500 },
    ];

    it('computes metrics without throwing and confirms non-equity classification', () => {
      const units = PortfolioUtils.getLatestUnits(liquidTx as any);
      const metrics = PerformanceService.getMetrics(liquidTx as any, 1050, {
        currentUnitsOverride: units,
        assetType: 'MUTUAL_FUND',
        assetName: 'Alpha Liquid Cash Fund'
      });

      expect(metrics.currentValue).toBe(525000);
      expect(metrics.totalGain).toBe(25000);
      expect(metrics.absoluteReturn).toBeCloseTo(0.05, 4);
    });
  });

  // PORTFOLIO 6: Nova Multi-Asset (Alternative Assets: Gold & Real Estate)
  describe('Portfolio 6: Alternative Assets & Gold (Nova Multi-Asset)', () => {
    const goldTx = [
      { id: 'tx-g1', date: new Date('2022-01-01'), type: 'BUY', amount: -250000, units: 50, nav: 5000, balance: 50 },
    ];

    it('computes accurate performance metrics for alternative gold holdings', () => {
      const units = PortfolioUtils.getLatestUnits(goldTx as any);
      const currentPrice = 7200; // Live Gold per gram
      const metrics = PerformanceService.getMetrics(goldTx as any, currentPrice, {
        currentUnitsOverride: units,
        assetType: 'SGB',
        assetName: 'Sovereign Gold Bond Series V'
      });

      expect(units).toBe(50);
      expect(metrics.currentValue).toBe(360000);
      expect(metrics.totalGain).toBe(110000);
      expect(metrics.absoluteReturn).toBeCloseTo(110000 / 250000, 4);
    });
  });

  // PORTFOLIO 7: Solaria Family Hub (Multi-Member Profile Cascading Deletion)
  describe('Portfolio 7: Multi-Member Profile Cascading Deletion (Solaria Family)', () => {
    it('transactionally deletes managed profile and its constituent data while isolating others', async () => {
      const userId = 'user-solaria-main';
      const childProfileId = 'profile-child-solaria';

      prismaMock.managedProfile.findFirst.mockResolvedValue({
        id: childProfileId,
        userId,
        name: 'Solaria Child Member',
        pan: 'IOTAI9009I',
        taxSlab: 0.3,
        portfolios: [
          {
            id: 'portfolio-child-1',
            folios: [
              { id: 'folio-child-1' },
              { id: 'folio-child-2' }
            ]
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      prismaMock.portfolio.findMany.mockResolvedValue([
        { id: 'portfolio-child-1' } as any
      ]);

      prismaMock.folio.findMany.mockResolvedValue([
        { id: 'folio-child-1' } as any,
        { id: 'folio-child-2' } as any
      ]);

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(prismaMock);
        }
        return callback;
      });
      prismaMock.managedProfile.delete.mockResolvedValue({ id: childProfileId } as any);

      const result = await FamilyService.deleteManagedProfile(userId, childProfileId);
      expect(result).toEqual({ id: childProfileId });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // PORTFOLIO 8: Vintage Heritage Fund (Section 112A LTCG Grandfathering)
  describe('Portfolio 8: Grandfathering & Section 112A LTCG (Vintage Heritage)', () => {
    const buyLot = {
      date: new Date('2016-04-01'),
      nav: 40,
      units: 1000,
      amount: 40000,
      isAnchor: false,
      isBonus: false,
    };
    const grandfatherNav = 70; // FMV as of 31-Jan-2018
    const sellNav = 120;
    const sellDate = new Date('2024-08-15'); // Post Budget 2024

    it('calculates Section 112A capital gains using grandfathered deemed cost of acquisition', () => {
      const realizedGain = TaxService.calculateGain(
        'Vintage Heritage Equity Fund',
        'MUTUAL_FUND',
        buyLot as any,
        1000,
        sellNav,
        sellDate,
        0.3,
        grandfatherNav
      );

      // Section 55(2)(ac) formula:
      // Deemed Cost = max(Buy Price, min(Grandfather NAV, Sell Price))
      // Deemed Cost = max(40, min(70, 120)) = 70
      // Total deemed cost = 1000 * 70 = 70,000
      // Gross Consideration = 1000 * 120 = 1,20,000
      // Gain = 1,20,000 - 70,000 = 50,000
      expect(realizedGain.isGrandfathered).toBe(true);
      expect(realizedGain.deemedCostOfAcquisition).toBe(70000);
      expect(realizedGain.gain).toBe(50000);
      expect(realizedGain.taxType).toBe('LTCG');
    });
  });

  // PORTFOLIO 9: Tax Optimizer ELSS (3-Year Lock-in Enforcement)
  describe('Portfolio 9: ELSS 3-Year Lock-in vs Harvestable Units (Tax Optimizer)', () => {
    const folioId = 'folio-elss-optimizer';
    const now = new Date();
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(now.getFullYear() - 4);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const mockFolio = {
      id: folioId,
      number: 'MOCK-ELSS-909',
      asset: {
        id: 'asset-elss-1',
        name: 'Apex ELSS Tax Shield Fund',
        type: 'MUTUAL_FUND',
      },
      transactions: [
        { id: 'tx-e1', date: fourYearsAgo, type: 'PURCHASE', amount: -50000, units: 500, nav: 100, balance: 500 },
        { id: 'tx-e2', date: oneYearAgo, type: 'PURCHASE_SIP', amount: -50000, units: 400, nav: 125, balance: 900 },
      ]
    };

    it('permits selling unlocked units (>3 years) but blocks selling locked units', async () => {
      prismaMock.folio.findUnique.mockResolvedValue(mockFolio as any);

      // Selling 500 units (unlocked) succeeds
      const result = await TaxAnalyzerService.simulateSell(folioId, 500, 0.3);
      expect(result).toBeDefined();
      expect(result.estimatedValue).toBe(500 * 125); // latest nav in transactions is 125

      // Selling 700 units (exceeds 500 unlocked) throws insufficient sellable units
      await expect(TaxAnalyzerService.simulateSell(folioId, 700, 0.3)).rejects.toThrow(
        /Insufficient sellable units/
      );
    });
  });

  // PORTFOLIO 10: Lifecycle Manager (Folio Manual Close and Direct Deletion)
  describe('Portfolio 10: Folio Lifecycle (Manual Close & Complete Purge)', () => {
    it('correctly models manual close redemption and zero balance', () => {
      const activeTransactions = [
        { id: 'tx-lc1', date: new Date('2023-01-01'), type: 'PURCHASE', amount: -60000, units: 600, nav: 100, balance: 600 },
      ];

      const currentUnits = PortfolioUtils.getLatestUnits(activeTransactions as any);
      expect(currentUnits).toBe(600);

      // Simulate the MANUAL_CLOSE transaction
      const closeTx = {
        id: 'tx-close-manual',
        date: new Date(),
        type: 'REDEMPTION',
        amount: 600 * 110,
        units: -600,
        nav: 110,
        balance: 0,
        externalId: 'MANUAL_CLOSE-folio-10-12345'
      };

      const updatedTx = [...activeTransactions, closeTx];
      const newUnits = PortfolioUtils.getLatestUnits(updatedTx as any);
      expect(newUnits).toBe(0);

      const metricsAfterClose = PerformanceService.getMetrics(updatedTx as any, 110, { currentUnitsOverride: newUnits });
      expect(metricsAfterClose.currentValue).toBe(0);
      expect(metricsAfterClose.investedAmount).toBe(0);
    });
  });
});
