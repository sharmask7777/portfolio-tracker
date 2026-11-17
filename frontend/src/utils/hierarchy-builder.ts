/**
 * @file hierarchy-builder.ts
 * @module utils/hierarchy-builder
 * @description Institutional-grade portfolio hierarchy transformation engine.
 *
 * Transforms flat and macro portfolio analytical data (XRayData) and look-through equity exposures
 * (StockExposure[]) into an N-level normalized, mathematically reconciled hierarchy tree (HierarchyNode).
 */

import type {
  StockExposure,
  XRayData,
  HierarchyNode,
  HierarchyOptions,
} from './hierarchy-types';
import {
  SECTOR_PALETTE,
  ASSET_CLASS_PALETTE,
  getSectorColor,
  getAssetClassColor,
  distributeBasisPoints,
  formatPercentagesWithParity,
  formatIndianRupee,
} from './hierarchy-formatters';
import {
  slugify,
  filterNonArbitrageExposures,
  scaleMatchingStocks,
  buildStandardStockNode,
  buildMicroClusterNode,
  buildSyntheticTailNode,
  type StockContext,
} from './hierarchy-stock-builder';

// Re-export public types and formatters
export type {
  StockExposure,
  XRayData,
  HierarchyNode,
  HierarchyOptions,
};
export {
  SECTOR_PALETTE,
  ASSET_CLASS_PALETTE,
  getSectorColor,
  getAssetClassColor,
  distributeBasisPoints,
  formatPercentagesWithParity,
  formatIndianRupee,
};

// ============================================================================
// Internal Asset & Sector Builders
// ============================================================================

interface SectorStockBuildParams {
  sectorItem: { name: string; percentage: number; value: number };
  equityValue: number;
  rootValue: number;
  exposures: StockExposure[];
  options: HierarchyOptions;
}

function buildSectorStockNodes(params: SectorStockBuildParams): HierarchyNode[] {
  const { sectorItem, equityValue, rootValue, exposures, options } = params;
  const sectorValue = sectorItem.value;
  const sectorPalette = getSectorColor(sectorItem.name, options.isDarkMode ?? false);
  const coalesceThreshold = options.coalesceThreshold ?? 0;

  const ctx: StockContext = {
    rootValue,
    equityValue,
    sectorValue,
    sectorName: sectorItem.name,
    sectorPalette,
  };

  const nonArbStocks = filterNonArbitrageExposures(
    exposures,
    sectorItem.name,
    options.excludeArbitrage ?? false,
    rootValue
  );
  const matchingStocks = scaleMatchingStocks(nonArbStocks, sectorValue);

  let standardStocks = matchingStocks;
  let microStocks: StockExposure[] = [];

  if (coalesceThreshold > 0 && rootValue > 0) {
    standardStocks = matchingStocks.filter(s => s.absoluteValue / rootValue >= coalesceThreshold);
    microStocks = matchingStocks.filter(s => s.absoluteValue / rootValue < coalesceThreshold);
  }

  const stockNodes: HierarchyNode[] = standardStocks.map(stock =>
    buildStandardStockNode(stock, ctx, options)
  );

  if (microStocks.length > 0) {
    stockNodes.push(buildMicroClusterNode(microStocks, ctx, coalesceThreshold));
  }

  // Look-through coverage gap reconciliation
  const effectiveSum = stockNodes.reduce((sum, s) => sum + s.metrics.signedValue, 0);
  const sectorGap = sectorValue - effectiveSum;

  if (sectorGap > 0.01) {
    stockNodes.push(buildSyntheticTailNode(sectorGap, ctx));
  }

  return stockNodes;
}

interface EquityTreeParams {
  equityValue: number;
  rootValue: number;
  activeSectors: { name: string; percentage: number; value: number }[];
  exposures?: StockExposure[] | undefined;
  options: HierarchyOptions;
}

function buildSectorNodes(params: EquityTreeParams): HierarchyNode[] {
  const { equityValue, rootValue, activeSectors, exposures, options } = params;
  const sectorNodes: HierarchyNode[] = [];
  const validSectors = activeSectors.filter(s => s.value > 0);
  const disclosedSectorsSum = validSectors.reduce((sum, s) => sum + s.value, 0);

  for (const sectorItem of validSectors) {
    const sectorValue = sectorItem.value;
    const sectorPalette = getSectorColor(sectorItem.name, options.isDarkMode ?? false);

    let stockNodes: HierarchyNode[] | undefined;
    if (exposures && exposures.length > 0) {
      stockNodes = buildSectorStockNodes({
        sectorItem,
        equityValue,
        rootValue,
        exposures,
        options,
      });
    }

    sectorNodes.push({
      id: `sector-${slugify(sectorItem.name)}`,
      name: sectorItem.name,
      depth: 'sector',
      metrics: {
        signedValue: sectorValue,
        layoutValue: Math.max(0, sectorValue),
        weightOfPortfolio: rootValue > 0 ? sectorValue / rootValue : 0,
        weightOfAssetClass: equityValue > 0 ? sectorValue / equityValue : 0,
        weightOfParent: equityValue > 0 ? sectorValue / equityValue : 0,
        weightOfSector: 1.0,
      },
      color: sectorPalette.bg,
      textColor: sectorPalette.text,
      ...(stockNodes ? { children: stockNodes } : {}),
      sector: sectorItem.name,
    });
  }

  // Synthesize Other Sectors if disclosed sectors sum to less than total equity
  const sectorGapUnderEquity = equityValue - disclosedSectorsSum;
  if (sectorGapUnderEquity > 0.01) {
    const otherPalette = getSectorColor('Other', options.isDarkMode ?? false);
    sectorNodes.push({
      id: 'sector-other-equity-synthetic',
      name: 'Other Sectors',
      depth: 'sector',
      metrics: {
        signedValue: sectorGapUnderEquity,
        layoutValue: Math.max(0, sectorGapUnderEquity),
        weightOfPortfolio: rootValue > 0 ? sectorGapUnderEquity / rootValue : 0,
        weightOfAssetClass: equityValue > 0 ? sectorGapUnderEquity / equityValue : 0,
        weightOfParent: equityValue > 0 ? sectorGapUnderEquity / equityValue : 0,
        weightOfSector: 1.0,
      },
      color: otherPalette.bg,
      textColor: otherPalette.text,
      isSynthetic: true,
      isTail: true,
      sector: 'Other',
    });
  }

  return sectorNodes;
}

function buildEquityAssetNode(params: EquityTreeParams): HierarchyNode | null {
  const { equityValue, rootValue, options } = params;
  if (equityValue <= 0) return null;

  const equityPalette = getAssetClassColor('equity', options.isDarkMode ?? false);
  const sectorNodes = buildSectorNodes(params);

  return {
    id: 'asset-equity',
    name: 'Equity',
    depth: 'assetClass',
    metrics: {
      signedValue: equityValue,
      layoutValue: Math.max(0, equityValue),
      weightOfPortfolio: rootValue > 0 ? equityValue / rootValue : 0,
      weightOfAssetClass: 1.0,
      weightOfParent: rootValue > 0 ? equityValue / rootValue : 0,
    },
    color: equityPalette.bg,
    textColor: equityPalette.text,
    ...(sectorNodes.length > 0 ? { children: sectorNodes } : {}),
  };
}

interface SimpleAssetParams {
  id: string;
  name: string;
  assetKey: 'debt' | 'cash' | 'gold' | 'other' | 'arbitrage';
  value: number;
  rootValue: number;
  isDarkMode: boolean;
  isHedged?: boolean;
}

function buildSimpleAssetNode(params: SimpleAssetParams): HierarchyNode | null {
  const { id, name, assetKey, value, rootValue, isDarkMode, isHedged } = params;
  if (value <= 0) return null;
  const palette = getAssetClassColor(assetKey, isDarkMode);

  return {
    id,
    name,
    depth: 'assetClass',
    metrics: {
      signedValue: value,
      layoutValue: Math.max(0, value),
      weightOfPortfolio: rootValue > 0 ? value / rootValue : 0,
      weightOfAssetClass: 1.0,
      weightOfParent: rootValue > 0 ? value / rootValue : 0,
    },
    color: palette.bg,
    textColor: palette.text,
    ...(isHedged ? { isHedged: true } : {}),
  };
}

interface MacroAllocations {
  debt?: { value: number } | undefined;
  cash?: { value: number } | undefined;
  gold?: { value: number } | undefined;
  arbitrage?: { value: number } | undefined;
  other?: { value: number } | undefined;
}

function buildFixedIncomeAndOtherNodes(
  alloc: MacroAllocations,
  rootValue: number,
  isDarkMode: boolean
): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];
  const entries: Array<{
    id: string;
    name: string;
    assetKey: 'debt' | 'cash' | 'gold' | 'other' | 'arbitrage';
    value: number;
    isHedged?: boolean;
  }> = [
    { id: 'asset-debt', name: 'Debt', assetKey: 'debt', value: alloc.debt?.value ?? 0 },
    { id: 'asset-cash', name: 'Cash & Equivalents', assetKey: 'cash', value: alloc.cash?.value ?? 0 },
    { id: 'asset-gold', name: 'Gold & Commodities', assetKey: 'gold', value: alloc.gold?.value ?? 0 },
    {
      id: 'asset-arbitrage',
      name: 'Arbitrage / Hedged Strategies',
      assetKey: 'arbitrage',
      value: alloc.arbitrage?.value ?? 0,
      isHedged: true,
    },
    { id: 'asset-other', name: 'Other Assets', assetKey: 'other', value: alloc.other?.value ?? 0 },
  ];

  for (const entry of entries) {
    const node = buildSimpleAssetNode({
      id: entry.id,
      name: entry.name,
      assetKey: entry.assetKey,
      value: entry.value,
      rootValue,
      isDarkMode,
      ...(entry.isHedged ? { isHedged: true } : {}),
    });
    if (node) nodes.push(node);
  }

  return nodes;
}

// ============================================================================
// Hierarchy Transformation Engine
// ============================================================================

function extractActiveSlices(data: XRayData | undefined, excludeArbitrage: boolean) {
  if (excludeArbitrage && data?.exArbitrage) {
    return {
      activeAllocation: data.exArbitrage.assetAllocation,
      activeSectors: data.exArbitrage.sectors,
    };
  }
  return {
    activeAllocation: data?.assetAllocation,
    activeSectors: data?.sectors ?? [],
  };
}

function resolveRootValue(rawVal: number | undefined): number {
  if (typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0) {
    return rawVal;
  }
  return 0;
}

function resolveEquityValue(rawVal: number | undefined): number {
  if (typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0) {
    return rawVal;
  }
  return 0;
}

/**
 * Transforms portfolio analytical data and look-through stock exposures into a fully reconciled,
 * invariant-checked hierarchy tree.
 *
 * @param data - Macro portfolio data containing asset allocations, sectors, and net worth.
 * @param exposures - Optional look-through company-level stock exposures and mutual fund contributions.
 * @param options - Optional configuration for arbitrage isolation, micro coalescing, and themes.
 * @returns Root node of the normalized hierarchy tree.
 */
export function buildPortfolioHierarchy(
  data: XRayData,
  exposures?: StockExposure[],
  options?: HierarchyOptions
): HierarchyNode {
  const opts = options ?? {};
  const isDarkMode = opts.isDarkMode ?? false;
  const excludeArbitrage = opts.excludeArbitrage ?? false;

  const { activeAllocation, activeSectors } = extractActiveSlices(data, excludeArbitrage);
  const rootValue = resolveRootValue(data?.totalValue);
  const equityValue = resolveEquityValue(activeAllocation?.equity?.value);

  const assetClassNodes: HierarchyNode[] = [];

  const equityNode = buildEquityAssetNode({
    equityValue,
    rootValue,
    activeSectors,
    exposures,
    options: opts,
  });
  if (equityNode) {
    assetClassNodes.push(equityNode);
  }

  const nonEquityNodes = buildFixedIncomeAndOtherNodes(
    activeAllocation ?? {},
    rootValue,
    isDarkMode
  );
  assetClassNodes.push(...nonEquityNodes);

  return {
    id: 'root',
    name: 'Total Portfolio',
    depth: 'root',
    metrics: {
      signedValue: rootValue,
      layoutValue: Math.max(0, rootValue),
      weightOfPortfolio: rootValue > 0 ? 1.0 : 0,
      weightOfAssetClass: 1.0,
      weightOfParent: 1.0,
    },
    color: isDarkMode ? '#0f172a' : '#1e293b',
    textColor: '#ffffff',
    children: assetClassNodes,
  };
}
