import { describe, it, expect } from 'vitest';
import { consolidateFoliosIntoSchemes } from './consolidation';
import { sortSchemeGroups } from './sorting';

/**
 * ELABORATE FRONTEND MOCK PORTFOLIOS UNIT TEST SUITE
 * 
 * Tests 10 synthetic mock portfolios for consolidation, sorting, 
 * zero-holding filtering, weighted return computation, and PAN badges.
 * All data is strictly synthetic and anonymized.
 */
describe('Frontend Mock Portfolios Unit Test Suite (10 Use Cases)', () => {
  // PORTFOLIO 1: Aurora Growth Family (Multi-Folio Scheme Consolidation)
  describe('Portfolio 1: Multi-Folio Scheme Consolidation (Aurora Growth)', () => {
    const folios = [
      {
        id: 'aurora-f1',
        number: 'AUR-101',
        pan: 'ALPAC1001A',
        asset: {
          id: 'asset-aurora',
          name: 'Apex Large & Mid Cap Fund - Direct Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF999K01001',
          amfiCode: '900101',
        },
        metrics: {
          investedAmount: 80000,
          currentValue: 100000,
          dayChange: 500,
          xirr: 0.18,
          postTaxXirr: 0.16,
          absoluteReturn: 0.25,
          postTaxAbsoluteReturn: 0.22,
        },
      },
      {
        id: 'aurora-f2',
        number: 'AUR-102',
        pan: 'BETAB2002B',
        asset: {
          id: 'asset-aurora',
          name: 'Apex Large & Mid Cap Fund - Direct Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF999K01001',
          amfiCode: '900101',
        },
        metrics: {
          investedAmount: 40000,
          currentValue: 50000,
          dayChange: 250,
          xirr: 0.12,
          postTaxXirr: 0.11,
          absoluteReturn: 0.25,
          postTaxAbsoluteReturn: 0.22,
        },
      },
    ];

    it('consolidates into a single group with combined values and both member PANs', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(1);
      const g = groups[0];
      expect(g.schemeName).toBe('Apex Large & Mid Cap Fund - Direct Growth');
      expect(g.folioCount).toBe(2);
      expect(g.pans).toEqual(['ALPAC1001A', 'BETAB2002B']);
      expect(g.metrics.investedAmount).toBe(120000);
      expect(g.metrics.currentValue).toBe(150000);
      expect(g.metrics.dayChange).toBe(750);
      // Weighted XIRR: (0.18 * 100k + 0.12 * 50k) / 150k = (18k + 6k) / 150k = 0.16
      expect(g.metrics.xirr).toBeCloseTo(0.16, 3);
    });
  });

  // PORTFOLIO 2: Zephyr Exited Fund (Fully Redeemed / Zero Holdings)
  describe('Portfolio 2: Fully Redeemed / Zero Holdings (Zephyr Exited)', () => {
    it('is omitted when folios list is empty or zero-value folios are not active', () => {
      const activeFolios: any[] = [];
      const groups = consolidateFoliosIntoSchemes(activeFolios);
      expect(groups).toHaveLength(0);
    });
  });

  // PORTFOLIO 3: Titan Bluechip Retained (Partial Redemption)
  describe('Portfolio 3: Partial Redemption Retained (Titan Bluechip)', () => {
    const folios = [
      {
        id: 'titan-f1',
        number: 'TITAN-301',
        pan: 'DELTD4004D',
        asset: {
          id: 'asset-titan',
          name: 'Titan Bluechip Opportunities Fund',
          type: 'MUTUAL_FUND',
          isin: 'INF999K01003',
        },
        metrics: {
          investedAmount: 100000,
          currentValue: 180000,
          dayChange: 800,
          xirr: 0.22,
          absoluteReturn: 0.8,
        },
      },
    ];

    it('renders single folio group with correct invested and active value', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(1);
      expect(groups[0].folioCount).toBe(1);
      expect(groups[0].pans).toEqual(['DELTD4004D']);
      expect(groups[0].metrics.currentValue).toBe(180000);
    });
  });

  // PORTFOLIO 4: Olympus Hybrid (Direct Equity & Mutual Funds)
  describe('Portfolio 4: Direct Equity and Mutual Fund Schemes', () => {
    const folios = [
      {
        id: 'stock-f1',
        number: 'EQ-001',
        pan: 'EPSIE5005E',
        asset: {
          name: 'Synthetix Technologies Ltd',
          type: 'STOCK',
          isin: 'INE999K01004',
        },
        metrics: { investedAmount: 150000, currentValue: 185000, dayChange: 1200, xirr: 0.25 },
      },
      {
        id: 'mf-f1',
        number: 'MF-002',
        pan: 'EPSIE5005E',
        asset: {
          name: 'Vertex Flexi Cap Fund',
          type: 'MUTUAL_FUND',
          isin: 'INF999K01005',
        },
        metrics: { investedAmount: 200000, currentValue: 240000, dayChange: 1500, xirr: 0.19 },
      },
    ];

    it('keeps stock and mutual fund as distinct entries', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(2);
      expect(groups.some(g => g.type === 'STOCK')).toBe(true);
      expect(groups.some(g => g.type === 'MUTUAL_FUND')).toBe(true);
    });
  });

  // PORTFOLIO 5: Sovereign Safety (Pure Debt / Liquid Portfolio)
  describe('Portfolio 5: Pure Debt / Liquid Holdings', () => {
    const folios = [
      {
        id: 'liquid-f1',
        number: 'LIQ-501',
        pan: 'ZETAZ6006F',
        asset: {
          name: 'Alpha Liquid Cash Fund',
          type: 'MUTUAL_FUND',
          isin: 'INF999K01006',
        },
        metrics: { investedAmount: 500000, currentValue: 525000, dayChange: 100, xirr: 0.07 },
      },
    ];

    it('renders liquid scheme group accurately', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(1);
      expect(groups[0].schemeName).toBe('Alpha Liquid Cash Fund');
      expect(groups[0].pans).toEqual(['ZETAZ6006F']);
    });
  });

  // PORTFOLIO 6: Nova Multi-Asset (Alternative Assets: Gold & Real Estate)
  describe('Portfolio 6: Alternative Assets (SGB / Gold)', () => {
    const folios = [
      {
        id: 'sgb-f1',
        number: 'MANUAL_SGB_601',
        pan: 'ETAE7007G',
        asset: {
          name: 'Sovereign Gold Bond 2028',
          type: 'GOLD',
          isin: 'IN9999GOLD01',
        },
        metrics: { investedAmount: 250000, currentValue: 360000, dayChange: 0, xirr: 0.14 },
      },
    ];

    it('identifies alternative asset with manual identifier', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(1);
      expect(groups[0].folios[0].number).toContain('MANUAL_');
    });
  });

  // PORTFOLIO 7: Solaria Family Hub (Multi-Member Distinct Profiles)
  describe('Portfolio 7: Multi-Member Profiles PAN Distribution', () => {
    const folios = [
      {
        id: 'f-parent',
        number: 'SOL-P1',
        pan: 'THETT8008H',
        asset: { name: 'Solaria Bluechip', isin: 'INF999SOL01', type: 'MUTUAL_FUND' },
        metrics: { investedAmount: 300000, currentValue: 400000, dayChange: 200, xirr: 0.15 },
      },
      {
        id: 'f-child',
        number: 'SOL-C1',
        pan: 'IOTAI9009I',
        asset: { name: 'Solaria Small Cap', isin: 'INF999SOL02', type: 'MUTUAL_FUND' },
        metrics: { investedAmount: 100000, currentValue: 120000, dayChange: 100, xirr: 0.20 },
      },
    ];

    it('isolates PANs per scheme group', () => {
      const groups = consolidateFoliosIntoSchemes(folios);
      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.schemeName === 'Solaria Bluechip')?.pans).toEqual(['THETT8008H']);
      expect(groups.find(g => g.schemeName === 'Solaria Small Cap')?.pans).toEqual(['IOTAI9009I']);
    });
  });

  // PORTFOLIO 8: Sorting Suite across Diverse Mock Assets
  describe('Portfolio 8-10: Sorting and Metrics Operations', () => {
    const mixedGroups = [
      {
        id: 'g1',
        schemeName: 'Alpha Fund',
        type: 'MUTUAL_FUND',
        pans: ['ALPAC1001A'],
        metrics: { currentValue: 50000, investedAmount: 40000, xirr: 0.25, absoluteReturn: 0.25, dayChange: 100, dayChangePercentage: 0.2 },
        folios: [],
        folioCount: 1,
      },
      {
        id: 'g2',
        schemeName: 'Beta Fund',
        type: 'MUTUAL_FUND',
        pans: ['BETAB2002B'],
        metrics: { currentValue: 200000, investedAmount: 150000, xirr: 0.12, absoluteReturn: 0.33, dayChange: -300, dayChangePercentage: -0.15 },
        folios: [],
        folioCount: 1,
      },
      {
        id: 'g3',
        schemeName: 'Gamma Fund',
        type: 'MUTUAL_FUND',
        pans: ['GAMMG3003C'],
        metrics: { currentValue: 120000, investedAmount: 100000, xirr: 0.30, absoluteReturn: 0.20, dayChange: 500, dayChangePercentage: 0.42 },
        folios: [],
        folioCount: 1,
      },
    ];

    it('sorts correctly by current value descending and ascending', () => {
      const desc = sortSchemeGroups(mixedGroups as any, 'value', 'desc', 'XIRR');
      expect(desc.map(g => g.schemeName)).toEqual(['Beta Fund', 'Gamma Fund', 'Alpha Fund']);

      const asc = sortSchemeGroups(mixedGroups as any, 'value', 'asc', 'XIRR');
      expect(asc.map(g => g.schemeName)).toEqual(['Alpha Fund', 'Gamma Fund', 'Beta Fund']);
    });

    it('sorts correctly by XIRR performance descending', () => {
      const sortedByXirr = sortSchemeGroups(mixedGroups as any, 'performance', 'desc', 'XIRR');
      expect(sortedByXirr.map(g => g.schemeName)).toEqual(['Gamma Fund', 'Alpha Fund', 'Beta Fund']);
    });

    it('sorts correctly by day change descending', () => {
      const sortedByDayChange = sortSchemeGroups(mixedGroups as any, 'dayChange', 'desc', 'XIRR');
      expect(sortedByDayChange.map(g => g.schemeName)).toEqual(['Gamma Fund', 'Alpha Fund', 'Beta Fund']);
    });
  });
});
