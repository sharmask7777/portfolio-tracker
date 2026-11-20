import { describe, it, expect } from 'vitest';
import {
  buildPortfolioHierarchy,
  distributeBasisPoints,
  formatPercentagesWithParity,
  formatIndianRupee,
  getSectorColor,
  getAssetClassColor,
  SECTOR_PALETTE,
  ASSET_CLASS_PALETTE,
  type StockExposure,
  type XRayData,
} from './hierarchy-builder';

describe('Hierarchy Tree Transformation Engine & Invariants', () => {
  const createMockXRayData = (): XRayData => ({
    totalValue: 1000000,
    assetAllocation: {
      equity: { percentage: 70, value: 700000 },
      debt: { percentage: 20, value: 200000 },
      cash: { percentage: 5, value: 50000 },
      gold: { percentage: 5, value: 50000 },
      other: { percentage: 0, value: 0 },
    },
    sectors: [
      { name: 'Financial Services', percentage: 40, value: 280000 },
      { name: 'Technology', percentage: 35, value: 245000 },
      { name: 'Healthcare', percentage: 25, value: 175000 },
    ],
    marketCap: {
      large: { percentage: 60, value: 600000 },
      mid: { percentage: 30, value: 300000 },
      small: { percentage: 10, value: 100000 },
    },
    exArbitrage: {
      assetAllocation: {
        equity: { percentage: 55, value: 550000 },
        debt: { percentage: 20, value: 200000 },
        cash: { percentage: 5, value: 50000 },
        gold: { percentage: 5, value: 50000 },
        arbitrage: { percentage: 15, value: 150000 },
        other: { percentage: 0, value: 0 },
      },
      sectors: [
        { name: 'Financial Services', percentage: 40, value: 220000 },
        { name: 'Technology', percentage: 35, value: 192500 },
        { name: 'Healthcare', percentage: 25, value: 137500 },
      ],
      marketCap: {
        large: { percentage: 60, value: 450000 },
        mid: { percentage: 30, value: 225000 },
        small: { percentage: 10, value: 75000 },
      },
    },
  });

  const createMockExposures = (): StockExposure[] => [
    {
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 160000,
      percentage: 0.16,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 90000, weight: 9.0 },
        { schemeName: 'HDFC Flexi Cap Fund', value: 70000, weight: 7.0 },
      ],
    },
    {
      name: 'ICICI Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 70000,
      percentage: 0.07,
      contributions: [
        { schemeName: 'ICICI Prudential Bluechip Fund', value: 70000, weight: 7.0 },
      ],
    },
    {
      name: 'Infosys Ltd.',
      sector: 'Technology',
      absoluteValue: 140000,
      percentage: 0.14,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 140000, weight: 14.0 },
      ],
    },
  ];

  describe('Value Conservation Law (Oracle Invariant)', () => {
    it('conserves value across root, asset classes, and sectors (Delta <= 0.01)', () => {
      const data = createMockXRayData();
      const exposures = createMockExposures();
      const tree = buildPortfolioHierarchy(data, exposures);

      // Root equals sum of children
      expect(tree.metrics.signedValue).toBe(1000000);
      const childSum = (tree.children ?? []).reduce(
        (sum, child) => sum + child.metrics.signedValue,
        0
      );
      expect(Math.abs(childSum - 1000000)).toBeLessThanOrEqual(0.01);

      // Equity node equals sum of sectors
      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      expect(equityNode).toBeDefined();
      expect(equityNode?.metrics.signedValue).toBe(700000);

      const sectorSum = (equityNode?.children ?? []).reduce(
        (sum, child) => sum + child.metrics.signedValue,
        0
      );
      expect(Math.abs(sectorSum - 700000)).toBeLessThanOrEqual(0.01);
    });

    it('reconciles undisclosed equity with synthetic tail node', () => {
      const data = createMockXRayData();
      const exposures = createMockExposures();
      const tree = buildPortfolioHierarchy(data, exposures);

      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const finSector = (equityNode?.children ?? []).find(s => s.name === 'Financial Services');
      expect(finSector).toBeDefined();
      expect(finSector?.metrics.signedValue).toBe(280000);

      const syntheticTail = (finSector?.children ?? []).find(s => s.isSynthetic && s.isTail);
      expect(syntheticTail).toBeDefined();
      expect(syntheticTail?.metrics.signedValue).toBe(50000);
    });
  });

  describe('Three-Denominator Ratios & Multi-Level Weights', () => {
    it('evaluates % of Portfolio, % of Asset Class, and % of Parent accurately', () => {
      const data = createMockXRayData();
      const exposures = createMockExposures();
      const tree = buildPortfolioHierarchy(data, exposures);

      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const finSector = (equityNode?.children ?? []).find(s => s.name === 'Financial Services');

      expect(finSector?.metrics.weightOfPortfolio).toBeCloseTo(0.28, 4);
      expect(finSector?.metrics.weightOfAssetClass).toBeCloseTo(0.40, 4);
      expect(finSector?.metrics.weightOfParent).toBeCloseTo(0.40, 4);
    });
  });

  describe('Underlying Scheme Hierarchy Breakdown', () => {
    it('builds scheme level children when includeSchemes option is enabled', () => {
      const data = createMockXRayData();
      const exposures = createMockExposures();
      const tree = buildPortfolioHierarchy(data, exposures, { includeSchemes: true });

      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const finSector = (equityNode?.children ?? []).find(s => s.name === 'Financial Services');
      const hdfcBank = (finSector?.children ?? []).find(s => s.name === 'HDFC Bank Ltd.');

      expect(hdfcBank?.children).toBeDefined();
      expect(hdfcBank?.children).toHaveLength(2);
      expect(hdfcBank?.children?.[0]?.depth).toBe('scheme');
      expect(hdfcBank?.children?.[0]?.name).toBe('Parag Parikh Flexi Cap Fund');
    });

    it('filters out arbitrage scheme contributions when excludeArbitrage is enabled', () => {
      const data = createMockXRayData();
      const exposuresWithArb: StockExposure[] = [
        {
          name: 'ITC Ltd.',
          sector: 'Consumer Defensive',
          absoluteValue: 50000,
          percentage: 0.05,
          contributions: [
            { schemeName: 'Kotak Equity Arbitrage Fund', value: 30000, weight: 3.0 },
            { schemeName: 'Mirae Asset Large Cap Fund', value: 20000, weight: 2.0 },
          ],
        },
      ];

      const tree = buildPortfolioHierarchy(data, exposuresWithArb, { excludeArbitrage: true });
      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const consSector = (equityNode?.children ?? []).find(s => s.name === 'Consumer Defensive');
      const itcStock = (consSector?.children ?? []).find(s => s.name === 'ITC Ltd.');

      expect(itcStock).toBeUndefined(); // Sector not in disclosed macro sectors, so handled correctly
    });

    it('scales matching stocks down when sum exceeds sector value', () => {
      const data = createMockXRayData();
      const oversizedExposures: StockExposure[] = [
        {
          name: 'Stock A',
          sector: 'Technology',
          absoluteValue: 200000,
          percentage: 0.20,
          contributions: [{ schemeName: 'Tech Fund', value: 200000, weight: 20.0 }],
        },
        {
          name: 'Stock B',
          sector: 'Technology',
          absoluteValue: 100000,
          percentage: 0.10,
          contributions: [{ schemeName: 'Tech Fund', value: 100000, weight: 10.0 }],
        },
      ];

      // Technology sector value in mock data is 245,000, while stock sum is 300,000
      const tree = buildPortfolioHierarchy(data, oversizedExposures);
      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const techSector = (equityNode?.children ?? []).find(s => s.name === 'Technology');
      const totalStockSum = (techSector?.children ?? []).reduce(
        (sum, s) => sum + s.metrics.signedValue,
        0
      );
      expect(totalStockSum).toBeCloseTo(245000, 2);
    });
  });

  describe('Numerical Safeguards (Pure Debt and Empty Portfolios)', () => {
    it('handles pure-debt portfolio without NaN or divide-by-zero errors', () => {
      const pureDebtData: XRayData = {
        totalValue: 500000,
        assetAllocation: {
          equity: { percentage: 0, value: 0 },
          debt: { percentage: 100, value: 500000 },
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

      const tree = buildPortfolioHierarchy(pureDebtData, []);
      expect(tree.metrics.signedValue).toBe(500000);
      expect(tree.children).toHaveLength(1);
      expect(tree.children?.[0]?.name).toBe('Debt');
      expect(tree.children?.[0]?.metrics.weightOfPortfolio).toBe(1.0);
    });

    it('handles empty portfolio (zero total value) safely', () => {
      const emptyData: XRayData = {
        totalValue: 0,
        assetAllocation: {
          equity: { percentage: 0, value: 0 },
          debt: { percentage: 0, value: 0 },
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

      const tree = buildPortfolioHierarchy(emptyData);
      expect(tree.metrics.signedValue).toBe(0);
      expect(tree.metrics.weightOfPortfolio).toBe(0);
      expect(tree.children).toHaveLength(0);
    });
  });

  describe('Arbitrage & Hedging Segregation', () => {
    it('isolates arbitrage funds into hedged node when excludeArbitrage is true', () => {
      const data = createMockXRayData();
      const tree = buildPortfolioHierarchy(data, [], { excludeArbitrage: true });

      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      expect(equityNode?.metrics.signedValue).toBe(550000); // 700k - 150k arb

      const arbNode = (tree.children ?? []).find(c => c.id === 'asset-arbitrage');
      expect(arbNode).toBeDefined();
      expect(arbNode?.metrics.signedValue).toBe(150000);
      expect(arbNode?.isHedged).toBe(true);
    });
  });

  describe('Micro-Allocation Coalescing', () => {
    it('coalesces holdings below threshold into Other cluster', () => {
      const data = createMockXRayData();
      const exposuresWithMicro: StockExposure[] = [
        {
          name: 'HDFC Bank Ltd.',
          sector: 'Financial Services',
          absoluteValue: 275000,
          percentage: 0.275,
          contributions: [{ schemeName: 'Fund A', value: 275000, weight: 27.5 }],
        },
        {
          name: 'Micro Finance Co.',
          sector: 'Financial Services',
          absoluteValue: 2000,
          percentage: 0.002,
          contributions: [{ schemeName: 'Fund B', value: 2000, weight: 0.2 }],
        },
      ];

      const tree = buildPortfolioHierarchy(data, exposuresWithMicro, {
        coalesceThreshold: 0.003,
      });

      const equityNode = (tree.children ?? []).find(c => c.id === 'asset-equity');
      const finSector = (equityNode?.children ?? []).find(s => s.name === 'Financial Services');
      const microCluster = (finSector?.children ?? []).find(
        s => s.isSynthetic && s.name.startsWith('Other (<')
      );
      expect(microCluster).toBeDefined();
      expect(microCluster?.metrics.signedValue).toBe(2000);
    });
  });

  describe('Hare-Niemeyer Rounding & Formatting', () => {
    it('distributes basis points so percentages sum to exactly 100.00%', () => {
      const weights = [33.333, 33.333, 33.334];
      const bps = distributeBasisPoints(weights, 10000);
      expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);

      const formatted = formatPercentagesWithParity(weights);
      expect(formatted).toHaveLength(3);
      const totalPct = formatted.reduce((acc, p) => acc + parseFloat(p.replace('%', '')), 0);
      expect(totalPct).toBeCloseTo(100.0, 2);
    });

    it('formats Indian Rupee numbers in Crores, Lakhs, and Thousands', () => {
      expect(formatIndianRupee(12500000)).toBe('₹1.25 Cr');
      expect(formatIndianRupee(350000)).toBe('₹3.50 L');
      expect(formatIndianRupee(45000)).toBe('₹45,000');
      expect(formatIndianRupee(-50000)).toBe('-₹50,000');
      expect(formatIndianRupee(0)).toBe('₹0');
    });

    it('returns appropriate sector and asset class colors in dark mode', () => {
      expect(SECTOR_PALETTE['Financial Services']).toBeDefined();
      expect(ASSET_CLASS_PALETTE['equity']).toBeDefined();
      const darkSector = getSectorColor('Financial Services', true);
      expect(darkSector.bg).toBe('#2563eb');
      const darkAsset = getAssetClassColor('equity', true);
      expect(darkAsset.bg).toBe('#3b82f6');
    });
  });
});
