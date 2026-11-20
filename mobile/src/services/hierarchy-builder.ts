import type {
  StockExposure,
  StockContribution,
  XRayData,
  HierarchyNode,
  HierarchyOptions,
  HierarchyDepth,
  NodeMetrics,
  PaletteColor,
  IndianRupeeFormatOptions,
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

export type {
  StockExposure,
  StockContribution,
  XRayData,
  HierarchyNode,
  HierarchyOptions,
  HierarchyDepth,
  NodeMetrics,
  PaletteColor,
  IndianRupeeFormatOptions,
};

export {
  SECTOR_PALETTE,
  ASSET_CLASS_PALETTE,
  getSectorColor,
  getAssetClassColor,
  distributeBasisPoints,
  formatPercentagesWithParity,
  formatIndianRupee,
  slugify,
};

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

  const ctx: StockContext = { rootValue, equityValue, sectorValue, sectorName: sectorItem.name, sectorPalette };
  const nonArbStocks = filterNonArbitrageExposures({
    exposures,
    sectorName: sectorItem.name,
    excludeArbitrage: options.excludeArbitrage ?? false,
    rootValue,
  });
  const matchingStocks = scaleMatchingStocks(nonArbStocks, sectorValue);

  let standardStocks = matchingStocks;
  let microStocks: StockExposure[] = [];
  if (coalesceThreshold > 0 && rootValue > 0) {
    standardStocks = matchingStocks.filter(s => s.absoluteValue / rootValue >= coalesceThreshold);
    microStocks = matchingStocks.filter(s => s.absoluteValue / rootValue < coalesceThreshold);
  }

  const stockNodes: HierarchyNode[] = standardStocks.map(s => buildStandardStockNode(s, ctx, options));
  if (microStocks.length > 0) stockNodes.push(buildMicroClusterNode(microStocks, ctx, coalesceThreshold));

  const effectiveSum = stockNodes.reduce((sum, s) => sum + s.metrics.signedValue, 0);
  const sectorGap = sectorValue - effectiveSum;
  if (sectorGap > 0.01) stockNodes.push(buildSyntheticTailNode(sectorGap, ctx));

  return stockNodes;
}

interface EquityTreeParams {
  equityValue: number;
  rootValue: number;
  activeSectors: { name: string; percentage: number; value: number }[];
  exposures?: StockExposure[] | undefined;
  options: HierarchyOptions;
}

interface OtherSectorNodeParams {
  gap: number;
  equityValue: number;
  rootValue: number;
  isDarkMode: boolean;
}

function buildOtherSectorsNode(params: OtherSectorNodeParams): HierarchyNode {
  const { gap, equityValue, rootValue, isDarkMode } = params;
  const otherPalette = getSectorColor('Other', isDarkMode);
  return {
    id: 'sector-other-equity-synthetic',
    name: 'Other Sectors',
    depth: 'sector',
    metrics: {
      signedValue: gap,
      layoutValue: Math.max(0, gap),
      weightOfPortfolio: rootValue > 0 ? gap / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? gap / equityValue : 0,
      weightOfParent: equityValue > 0 ? gap / equityValue : 0,
      weightOfSector: 1.0,
    },
    color: otherPalette.bg,
    textColor: otherPalette.text,
    isSynthetic: true,
    isTail: true,
    sector: 'Other',
  };
}

interface SingleSectorParams {
  item: { name: string; percentage: number; value: number };
  equityValue: number;
  rootValue: number;
  stockNodes?: HierarchyNode[] | undefined;
  isDarkMode?: boolean | undefined;
}

function buildSingleSectorNode(params: SingleSectorParams): HierarchyNode {
  const { item, equityValue, rootValue, stockNodes, isDarkMode = false } = params;
  const palette = getSectorColor(item.name, isDarkMode);
  return {
    id: `sector-${slugify(item.name)}`,
    name: item.name,
    depth: 'sector',
    metrics: {
      signedValue: item.value,
      layoutValue: Math.max(0, item.value),
      weightOfPortfolio: rootValue > 0 ? item.value / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? item.value / equityValue : 0,
      weightOfParent: equityValue > 0 ? item.value / equityValue : 0,
      weightOfSector: 1.0,
    },
    color: palette.bg,
    textColor: palette.text,
    ...(stockNodes !== undefined ? { children: stockNodes } : {}),
    sector: item.name,
  };
}

function buildSectorNodes(params: EquityTreeParams): HierarchyNode[] {
  const { equityValue, rootValue, activeSectors, exposures, options } = params;
  const validSectors = activeSectors.filter(s => s.value > 0);
  const disclosedSectorsSum = validSectors.reduce((sum, s) => sum + s.value, 0);
  const isDarkMode = options.isDarkMode ?? false;

  const sectorNodes = validSectors.map(item => {
    const stockNodes = (exposures && exposures.length > 0)
      ? buildSectorStockNodes({ sectorItem: item, equityValue, rootValue, exposures, options })
      : undefined;
    return buildSingleSectorNode({ item, equityValue, rootValue, stockNodes, isDarkMode });
  });

  const gap = equityValue - disclosedSectorsSum;
  if (gap > 0.01) {
    sectorNodes.push(buildOtherSectorsNode({ gap, equityValue, rootValue, isDarkMode }));
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
  isHedged?: boolean | undefined;
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

function getVal(node?: { value: number }): number {
  return node ? node.value : 0;
}

function buildFixedIncomeAndOtherNodes(
  alloc: MacroAllocations,
  rootValue: number,
  isDarkMode: boolean
): HierarchyNode[] {
  const specs: Array<{ id: string; name: string; assetKey: 'debt' | 'cash' | 'gold' | 'other' | 'arbitrage'; value: number; isHedged?: boolean }> = [
    { id: 'asset-debt', name: 'Debt', assetKey: 'debt', value: getVal(alloc.debt) },
    { id: 'asset-cash', name: 'Cash & Equivalents', assetKey: 'cash', value: getVal(alloc.cash) },
    { id: 'asset-gold', name: 'Gold & Commodities', assetKey: 'gold', value: getVal(alloc.gold) },
    { id: 'asset-arbitrage', name: 'Arbitrage / Hedged Strategies', assetKey: 'arbitrage', value: getVal(alloc.arbitrage), isHedged: true },
    { id: 'asset-other', name: 'Other Assets', assetKey: 'other', value: getVal(alloc.other) },
  ];

  const nodes: HierarchyNode[] = [];
  for (const entry of specs) {
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

function sanitizePositiveNumber(val: number | undefined): number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0;
}

export function buildPortfolioHierarchy(
  data: XRayData,
  exposures?: StockExposure[],
  options?: HierarchyOptions
): HierarchyNode {
  const opts = options ?? {};
  const isDarkMode = opts.isDarkMode ?? false;
  const excludeArbitrage = opts.excludeArbitrage ?? false;

  const { activeAllocation, activeSectors } = extractActiveSlices(data, excludeArbitrage);
  const rootValue = sanitizePositiveNumber(data.totalValue);
  const equityValue = sanitizePositiveNumber(activeAllocation?.equity?.value);

  const assetClassNodes: HierarchyNode[] = [];
  const equityNode = buildEquityAssetNode({ equityValue, rootValue, activeSectors, exposures, options: opts });
  if (equityNode) assetClassNodes.push(equityNode);

  const nonEquityNodes = buildFixedIncomeAndOtherNodes(activeAllocation ?? {}, rootValue, isDarkMode);
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
