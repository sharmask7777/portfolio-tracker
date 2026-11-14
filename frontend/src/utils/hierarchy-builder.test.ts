/**
 * @file hierarchy-builder.test.ts
 * @description Comprehensive unit and mathematical invariant tests for the Portfolio Hierarchy Tree Engine.
 *
 * Enforces:
 * 1. Value Conservation Law: For every non-leaf node u, val(u) = sum(v in Children(u)) val(v) +/- 0.01.
 * 2. Look-Through Coverage Gap Reconciliation: Undisclosed mutual fund holdings synthesize a deterministic tail node.
 * 3. Three-Denominator Ratios: Unambiguous evaluation of % of Portfolio, % of Asset Class, and % of Parent.
 * 4. Hare-Niemeyer Rounding Parity: Sibling percentages sum to exactly 100.00% without floating point drift.
 * 5. Numerical Safeguards: Zero divide-by-zero or NaN in pure debt/liquid portfolios.
 * 6. Arbitrage / Hedging Segregation: Clean isolation of cash-futures strategies under excludeArbitrage toggle.
 * 7. Indian Financial Numbering: Compact and formatted representations across Crores, Lakhs, and Thousands.
 * 8. Micro-Allocation Coalescing: Clustered rendering for holdings under 0.3% portfolio weight.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPortfolioHierarchy,
  distributeBasisPoints,
  formatPercentagesWithParity,
  formatIndianRupee,
  SECTOR_PALETTE,
  getSectorColor,
  type HierarchyNode,
  type StockExposure,
  type XRayData,
} from './hierarchy-builder';

describe('Hierarchy Tree Transformation Engine & Financial Invariants', () => {
  // Base synthetic test portfolio data
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
    {
      name: 'Tata Consultancy Services Ltd.',
      sector: 'Technology',
      absoluteValue: 75000,
      percentage: 0.075,
      contributions: [
        { schemeName: 'HDFC Flexi Cap Fund', value: 75000, weight: 7.5 },
      ],
    },
    {
      name: 'Sun Pharmaceutical Industries Ltd.',
      sector: 'Healthcare',
      absoluteValue: 120000,
      percentage: 0.12,
      contributions: [
        { schemeName: 'Nippon India Pharma Fund', value: 120000, weight: 12.0 },
      ],
    },
  ];

  /**
   * Recursive invariant validator verifying the Value Conservation Law:
   * For every non-leaf node u, val(u) = sum_{v in Children(u)} val(v) +/- 0.01.
   */
  const assertValueConservation = (node: HierarchyNode) => {
    if (node.children && node.children.length > 0) {
      const sumChildren = node.children.reduce((acc, child) => acc + child.metrics.signedValue, 0);
      expect(Math.abs(node.metrics.signedValue - sumChildren)).toBeLessThanOrEqual(0.01);
      for (const child of node.children) {
        assertValueConservation(child);
      }
    }
  };

  it('test_tree_value_conservation_law: asserts val(u) = sum(val(v)) within 0.01 across all tree depths', () => {
    const data = createMockXRayData();
    const exposures = createMockExposures();

    const root = buildPortfolioHierarchy(data, exposures);

    // Root value must match total portfolio net worth
    expect(root.metrics.signedValue).toBe(1000000);
    expect(root.depth).toBe('root');

    // Recursively assert Value Conservation Law across all depths
    assertValueConservation(root);
  });

  it('test_lookthrough_coverage_gap_reconciliation: creates synthetic Other Scheme Holdings node for residual sector balance', () => {
    const customData: XRayData = {
      totalValue: 100000,
      assetAllocation: {
        equity: { percentage: 100, value: 100000 },
        debt: { percentage: 0, value: 0 },
        cash: { percentage: 0, value: 0 },
        gold: { percentage: 0, value: 0 },
        other: { percentage: 0, value: 0 },
      },
      sectors: [
        { name: 'Financial Services', percentage: 50, value: 50000 },
        { name: 'Technology', percentage: 50, value: 50000 },
      ],
      marketCap: {
        large: { percentage: 100, value: 100000 },
        mid: { percentage: 0, value: 0 },
        small: { percentage: 0, value: 0 },
      },
    };

    // Financial Services sector has value 50,000, but disclosed stocks sum to 38,000 (20k + 18k)
    // Residual coverage gap = 12,000
    const customExposures: StockExposure[] = [
      {
        name: 'HDFC Bank Ltd.',
        sector: 'Financial Services',
        absoluteValue: 20000,
        percentage: 0.20,
        contributions: [{ schemeName: 'Flexi Cap Fund', value: 20000, weight: 20.0 }],
      },
      {
        name: 'ICICI Bank Ltd.',
        sector: 'Financial Services',
        absoluteValue: 18000,
        percentage: 0.18,
        contributions: [{ schemeName: 'Flexi Cap Fund', value: 18000, weight: 18.0 }],
      },
      {
        name: 'Infosys Ltd.',
        sector: 'Technology',
        absoluteValue: 50000,
        percentage: 0.50,
        contributions: [{ schemeName: 'Tech Fund', value: 50000, weight: 50.0 }],
      },
    ];

    const root = buildPortfolioHierarchy(customData, customExposures);

    const equity = root.children?.find(c => c.name === 'Equity');
    expect(equity).toBeDefined();

    const finServices = equity?.children?.find(c => c.name === 'Financial Services');
    expect(finServices).toBeDefined();

    // Financial Services must have 3 children: HDFC Bank, ICICI Bank, and the synthetic tail node
    expect(finServices?.children).toHaveLength(3);

    const syntheticTail = finServices?.children?.find(
      c => c.name === 'Other Scheme Holdings (Financial Services)'
    );
    expect(syntheticTail).toBeDefined();
    expect(syntheticTail?.isSynthetic).toBe(true);
    expect(syntheticTail?.isTail).toBe(true);
    expect(syntheticTail?.depth).toBe('stock');
    expect(syntheticTail?.metrics.signedValue).toBe(12000);
    expect(syntheticTail?.metrics.weightOfParent).toBeCloseTo(12000 / 50000, 4);

    // Sum of children must equal 50,000
    const sumChildren = finServices?.children?.reduce((acc, c) => acc + c.metrics.signedValue, 0);
    expect(sumChildren).toBe(50000);

    // Verify tree conservation
    assertValueConservation(root);
  });

  it('test_three_denominator_ratios: accurately evaluates weightOfPortfolio, weightOfAssetClass, weightOfParent, and weightOfSector', () => {
    const data = createMockXRayData();
    const exposures = createMockExposures();

    const root = buildPortfolioHierarchy(data, exposures);

    // Root ratios
    expect(root.metrics.weightOfPortfolio).toBe(1.0);
    expect(root.metrics.weightOfAssetClass).toBe(1.0);
    expect(root.metrics.weightOfParent).toBe(1.0);
    expect(root.metrics.weightOfSector).toBeUndefined();

    // Equity Asset Class node
    const equity = root.children?.find(c => c.name === 'Equity')!;
    expect(equity).toBeDefined();
    expect(equity.metrics.signedValue).toBe(700000);
    expect(equity.metrics.weightOfPortfolio).toBeCloseTo(700000 / 1000000, 6); // 0.70
    expect(equity.metrics.weightOfAssetClass).toBe(1.0);
    expect(equity.metrics.weightOfParent).toBeCloseTo(700000 / 1000000, 6); // 0.70
    expect(equity.metrics.weightOfSector).toBeUndefined();

    // Sector node: Financial Services
    const finServices = equity.children?.find(c => c.name === 'Financial Services')!;
    expect(finServices).toBeDefined();
    expect(finServices.metrics.signedValue).toBe(280000);
    expect(finServices.metrics.weightOfPortfolio).toBeCloseTo(280000 / 1000000, 6); // 0.28
    expect(finServices.metrics.weightOfAssetClass).toBeCloseTo(280000 / 700000, 6); // 0.40
    expect(finServices.metrics.weightOfParent).toBeCloseTo(280000 / 700000, 6); // 0.40
    expect(finServices.metrics.weightOfSector).toBe(1.0);

    // Stock node: HDFC Bank Ltd. (value 160,000)
    const hdfc = finServices.children?.find(c => c.name === 'HDFC Bank Ltd.')!;
    expect(hdfc).toBeDefined();
    expect(hdfc.metrics.signedValue).toBe(160000);
    expect(hdfc.metrics.weightOfPortfolio).toBeCloseTo(160000 / 1000000, 6); // 0.16
    expect(hdfc.metrics.weightOfAssetClass).toBeCloseTo(160000 / 700000, 6); // ~0.228571
    expect(hdfc.metrics.weightOfParent).toBeCloseTo(160000 / 280000, 6); // ~0.571428
    expect(hdfc.metrics.weightOfSector).toBeCloseTo(160000 / 280000, 6); // ~0.571428

    // Debt Asset Class node (shallower depth leaf)
    const debt = root.children?.find(c => c.name === 'Debt')!;
    expect(debt).toBeDefined();
    expect(debt.metrics.signedValue).toBe(200000);
    expect(debt.metrics.weightOfPortfolio).toBeCloseTo(200000 / 1000000, 6); // 0.20
    expect(debt.metrics.weightOfAssetClass).toBe(1.0);
    expect(debt.metrics.weightOfParent).toBeCloseTo(200000 / 1000000, 6); // 0.20
    expect(debt.metrics.weightOfSector).toBeUndefined();
  });

  it('test_hare_niemeyer_percentage_parity: sibling percentages sum exactly to 100.00% without rounding drift', () => {
    // 3 equal weights of 100
    const threeWeights = [100, 100, 100];
    const threeBps = distributeBasisPoints(threeWeights, 10000);
    expect(threeBps.reduce((a, b) => a + b, 0)).toBe(10000);

    const formattedThree = formatPercentagesWithParity(threeWeights);
    expect(formattedThree).toEqual(['33.34%', '33.33%', '33.33%']);
    const sumFormattedThree = formattedThree.reduce(
      (sum, p) => sum + parseFloat(p.replace('%', '')),
      0
    );
    expect(sumFormattedThree).toBe(100.00);

    // 7 equal weights: naive 100 / 7 = 14.2857% -> naive round 14.29% * 7 = 100.03% (drift!)
    const sevenWeights = [1, 1, 1, 1, 1, 1, 1];
    const sevenBps = distributeBasisPoints(sevenWeights, 10000);
    expect(sevenBps.reduce((a, b) => a + b, 0)).toBe(10000);

    const formattedSeven = formatPercentagesWithParity(sevenWeights);
    const sumFormattedSeven = formattedSeven.reduce(
      (sum, p) => sum + parseFloat(p.replace('%', '')),
      0
    );
    expect(sumFormattedSeven).toBe(100.00);

    // Empty array and zero weights safety
    expect(distributeBasisPoints([])).toEqual([]);
    expect(distributeBasisPoints([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('test_zero_equity_debt_portfolio: constructs valid hierarchy without 0/0 or NaN in pure debt/liquid allocation', () => {
    const pureDebtData: XRayData = {
      totalValue: 500000,
      assetAllocation: {
        equity: { percentage: 0, value: 0 },
        debt: { percentage: 80, value: 400000 },
        cash: { percentage: 20, value: 100000 },
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

    const root = buildPortfolioHierarchy(pureDebtData, []);

    expect(root.metrics.signedValue).toBe(500000);
    expect(root.children).toBeDefined();

    // Must not have NaN in any metric
    const assertNoNaN = (node: HierarchyNode) => {
      expect(Number.isNaN(node.metrics.signedValue)).toBe(false);
      expect(Number.isNaN(node.metrics.layoutValue)).toBe(false);
      expect(Number.isNaN(node.metrics.weightOfPortfolio)).toBe(false);
      expect(Number.isNaN(node.metrics.weightOfAssetClass)).toBe(false);
      expect(Number.isNaN(node.metrics.weightOfParent)).toBe(false);
      if (node.metrics.weightOfSector !== undefined) {
        expect(Number.isNaN(node.metrics.weightOfSector)).toBe(false);
      }
      if (node.children) {
        for (const child of node.children) {
          assertNoNaN(child);
        }
      }
    };

    assertNoNaN(root);

    const debtChild = root.children?.find(c => c.name === 'Debt');
    expect(debtChild).toBeDefined();
    expect(debtChild?.metrics.signedValue).toBe(400000);
    expect(debtChild?.metrics.weightOfPortfolio).toBe(0.8);

    const cashChild = root.children?.find(c => c.name === 'Cash & Equivalents');
    expect(cashChild).toBeDefined();
    expect(cashChild?.metrics.signedValue).toBe(100000);
    expect(cashChild?.metrics.weightOfPortfolio).toBe(0.2);

    // Value conservation holds
    assertValueConservation(root);
  });

  it('test_exclude_arbitrage_branching: isolates arbitrage funds into a dedicated root asset class when excludeArbitrage is true', () => {
    const data = createMockXRayData();
    const exposures = createMockExposures();

    // 1. excludeArbitrage: false -> Arbitrage is absorbed within standard asset allocation
    const standardRoot = buildPortfolioHierarchy(data, exposures, { excludeArbitrage: false });
    const standardArbitrage = standardRoot.children?.find(
      c => c.name === 'Arbitrage / Hedged Strategies'
    );
    expect(standardArbitrage).toBeUndefined();
    expect(standardRoot.children?.find(c => c.name === 'Equity')?.metrics.signedValue).toBe(700000);

    // 2. excludeArbitrage: true -> Dedicated Arbitrage asset class isolated
    const exArbRoot = buildPortfolioHierarchy(data, exposures, { excludeArbitrage: true });
    const isolatedArb = exArbRoot.children?.find(c => c.name === 'Arbitrage / Hedged Strategies');
    expect(isolatedArb).toBeDefined();
    expect(isolatedArb?.depth).toBe('assetClass');
    expect(isolatedArb?.metrics.signedValue).toBe(150000);
    expect(isolatedArb?.isHedged).toBe(true);

    // Pure equity is reduced from 700k to 550k
    const pureEquity = exArbRoot.children?.find(c => c.name === 'Equity');
    expect(pureEquity?.metrics.signedValue).toBe(550000);

    // Value conservation holds in ex-arbitrage view: 550k + 200k + 50k + 50k + 150k = 1,000,000
    assertValueConservation(exArbRoot);
  });

  it('test_indian_rupee_formatting: formats across Crores, Lakhs, and Thousands with compact and exact options', () => {
    // Crores (>= 1 Cr = 1,00,00,000)
    expect(formatIndianRupee(15000000)).toBe('₹1.50 Cr');
    expect(formatIndianRupee(23456789)).toBe('₹2.35 Cr');
    expect(formatIndianRupee(10000000)).toBe('₹1.00 Cr');

    // Lakhs (>= 1 L = 1,00,000 and < 1 Cr)
    expect(formatIndianRupee(450000)).toBe('₹4.50 L');
    expect(formatIndianRupee(100000)).toBe('₹1.00 L');
    expect(formatIndianRupee(999000)).toBe('₹9.99 L');

    // Thousands and smaller (< 1 L)
    expect(formatIndianRupee(45000)).toBe('₹45,000');
    expect(formatIndianRupee(1234)).toBe('₹1,234');
    expect(formatIndianRupee(500)).toBe('₹500');
    expect(formatIndianRupee(0)).toBe('₹0');

    // Negative values
    expect(formatIndianRupee(-15000000)).toBe('-₹1.50 Cr');
    expect(formatIndianRupee(-45000)).toBe('-₹45,000');

    // Formatting options
    expect(formatIndianRupee(15000000, { includeSymbol: false })).toBe('1.50 Cr');
    expect(formatIndianRupee(45000, { includeSymbol: false })).toBe('45,000');
    expect(formatIndianRupee(15000000, { compact: false })).toBe('₹1,50,00,000');
    expect(formatIndianRupee(450000, { decimals: 1 })).toBe('₹4.5 L');
  });

  it('test_micro_allocation_coalescing: coalesces holdings below 0.3% threshold into Other cluster', () => {
    const data: XRayData = {
      totalValue: 1000000, // 0.3% threshold = 3,000
      assetAllocation: {
        equity: { percentage: 100, value: 1000000 },
        debt: { percentage: 0, value: 0 },
        cash: { percentage: 0, value: 0 },
        gold: { percentage: 0, value: 0 },
        other: { percentage: 0, value: 0 },
      },
      sectors: [{ name: 'Technology', percentage: 100, value: 1000000 }],
      marketCap: {
        large: { percentage: 80, value: 800000 },
        mid: { percentage: 20, value: 200000 },
        small: { percentage: 0, value: 0 },
      },
    };

    const exposuresWithMicro: StockExposure[] = [
      {
        name: 'Infosys Ltd.',
        sector: 'Technology',
        absoluteValue: 500000, // 50%
        percentage: 0.5,
        contributions: [{ schemeName: 'Tech Fund', value: 500000, weight: 50 }],
      },
      {
        name: 'Tata Consultancy Services Ltd.',
        sector: 'Technology',
        absoluteValue: 300000, // 30%
        percentage: 0.3,
        contributions: [{ schemeName: 'Tech Fund', value: 300000, weight: 30 }],
      },
      {
        name: 'MicroStock Alpha',
        sector: 'Technology',
        absoluteValue: 2000, // 0.20% (< 0.3%)
        percentage: 0.002,
        contributions: [{ schemeName: 'Tech Fund', value: 2000, weight: 0.2 }],
      },
      {
        name: 'MicroStock Beta',
        sector: 'Technology',
        absoluteValue: 800, // 0.08% (< 0.3%)
        percentage: 0.0008,
        contributions: [{ schemeName: 'Tech Fund', value: 800, weight: 0.08 }],
      },
    ];

    const root = buildPortfolioHierarchy(data, exposuresWithMicro, {
      coalesceThreshold: 0.003, // 0.3%
    });

    const equity = root.children?.find(c => c.name === 'Equity');
    const techSector = equity?.children?.find(c => c.name === 'Technology');
    expect(techSector).toBeDefined();

    // MicroStock Alpha and MicroStock Beta should NOT appear individually
    const alpha = techSector?.children?.find(c => c.name === 'MicroStock Alpha');
    const beta = techSector?.children?.find(c => c.name === 'MicroStock Beta');
    expect(alpha).toBeUndefined();
    expect(beta).toBeUndefined();

    // Instead, a coalesced cluster node 'Other (<0.3%)' of value 2,800 should be present
    const microCluster = techSector?.children?.find(c => c.name === 'Other (<0.3%)');
    expect(microCluster).toBeDefined();
    expect(microCluster?.isTail).toBe(true);
    expect(microCluster?.isSynthetic).toBe(true);
    expect(microCluster?.metrics.signedValue).toBe(2800);

    // And undisclosed holdings should be: 1,000,000 - (500,000 + 300,000 + 2,800) = 197,200
    const syntheticTail = techSector?.children?.find(
      c => c.name === 'Other Scheme Holdings (Technology)'
    );
    expect(syntheticTail).toBeDefined();
    expect(syntheticTail?.metrics.signedValue).toBe(197200);

    // Value Conservation Law must hold with exact precision
    assertValueConservation(root);
  });

  it('SECTOR_PALETTE provides accessible high-contrast colors for all major sectors', () => {
    expect(SECTOR_PALETTE['Financial Services']).toBeDefined();
    expect(SECTOR_PALETTE['Technology']).toBeDefined();
    expect(SECTOR_PALETTE['Healthcare']).toBeDefined();

    const finColor = getSectorColor('Financial Services');
    expect(finColor.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(finColor.text).toBe('#ffffff');

    // Unknown sector gracefully falls back to Other palette
    const unknownColor = getSectorColor('Biotechnology & Novel Genomics');
    expect(unknownColor).toBeDefined();
    expect(unknownColor.bg).toBe(SECTOR_PALETTE['Other']?.bg);

    // Dark mode variant
    const darkColor = getSectorColor('Financial Services', true);
    expect(darkColor.bg).toBe(SECTOR_PALETTE['Financial Services']?.darkBg);
  });

  it('tests edge cases: dark mode, includeSchemes, empty/negative values, and other asset allocation', () => {
    const dataWithOther: XRayData = {
      totalValue: 500000,
      assetAllocation: {
        equity: { percentage: 60, value: 300000 },
        debt: { percentage: 20, value: 100000 },
        cash: { percentage: 10, value: 50000 },
        gold: { percentage: 0, value: 0 },
        other: { percentage: 10, value: 50000 },
      },
      sectors: [
        { name: 'Financial Services', percentage: 50, value: 150000 },
        { name: 'Technology', percentage: 30, value: 90000 },
        // Disclosed sectors sum = 240,000 < 300,000 -> Triggers synthetic Other Sectors under Equity
      ],
      marketCap: {
        large: { percentage: 70, value: 210000 },
        mid: { percentage: 20, value: 60000 },
        small: { percentage: 10, value: 30000 },
      },
    };

    const exposures: StockExposure[] = [
      {
        name: 'HDFC Bank Ltd.',
        sector: 'Financial Services',
        absoluteValue: 100000,
        percentage: 0.2,
        contributions: [
          { schemeName: 'Kotak Equity Fund', value: 60000, weight: 12 },
          { schemeName: 'HDFC Arbitrage Fund', value: 40000, weight: 8 },
        ],
      },
    ];

    const rootDark = buildPortfolioHierarchy(dataWithOther, exposures, {
      isDarkMode: true,
      includeSchemes: true,
      excludeArbitrage: false,
    });

    expect(rootDark.color).toBe('#0f172a');
    expect(rootDark.children?.length).toBe(4); // Equity, Debt, Cash, Other Assets

    const otherAsset = rootDark.children?.find(c => c.name === 'Other Assets');
    expect(otherAsset).toBeDefined();
    expect(otherAsset?.metrics.signedValue).toBe(50000);

    const equity = rootDark.children?.find(c => c.name === 'Equity');
    expect(equity).toBeDefined();

    // Check synthetic Other Sectors node under Equity
    const otherSectors = equity?.children?.find(c => c.name === 'Other Sectors');
    expect(otherSectors).toBeDefined();
    expect(otherSectors?.metrics.signedValue).toBe(60000); // 300k - (150k + 90k) = 60k

    // Check scheme children under HDFC Bank
    const finSector = equity?.children?.find(c => c.name === 'Financial Services');
    const hdfc = finSector?.children?.find(c => c.name === 'HDFC Bank Ltd.');
    expect(hdfc?.isHedged).toBe(true); // contains arbitrage fund contribution
    expect(hdfc?.children?.length).toBe(2);
    expect(hdfc?.children?.[0]?.depth).toBe('scheme');

    assertValueConservation(rootDark);

    // Empty/zero portfolio edge case
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
    const emptyRoot = buildPortfolioHierarchy(emptyData);
    expect(emptyRoot.metrics.signedValue).toBe(0);
    expect(emptyRoot.children?.length).toBe(0);
  });
});
