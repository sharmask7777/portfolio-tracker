import type {
  HierarchyNode,
  HierarchyOptions,
  StockExposure,
  PaletteColor,
} from './hierarchy-types';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function filterNonArbitrageExposures(
  exposures: StockExposure[],
  sectorName: string,
  excludeArbitrage: boolean,
  rootValue: number
): StockExposure[] {
  return exposures
    .filter(e => e.sector.trim().toLowerCase() === sectorName.trim().toLowerCase())
    .map(stock => {
      if (!excludeArbitrage || !stock.contributions || stock.contributions.length === 0) {
        return stock;
      }
      const nonArb = stock.contributions.filter(
        c => !c.schemeName.toLowerCase().includes('arbitrage')
      );
      if (nonArb.length === stock.contributions.length) {
        return stock;
      }
      const recomputedVal = nonArb.reduce((sum, c) => sum + c.value, 0);
      return {
        ...stock,
        absoluteValue: recomputedVal,
        percentage: rootValue > 0 ? recomputedVal / rootValue : 0,
        contributions: nonArb,
      };
    })
    .filter(stock => stock.absoluteValue > 0.001);
}

export function scaleMatchingStocks(
  matchingStocks: StockExposure[],
  sectorValue: number
): StockExposure[] {
  const rawSum = matchingStocks.reduce((sum, s) => sum + s.absoluteValue, 0);
  if (rawSum <= sectorValue || rawSum <= 0) return matchingStocks;

  const scale = sectorValue / rawSum;
  return matchingStocks.map(stock => ({
    ...stock,
    absoluteValue: stock.absoluteValue * scale,
    percentage: (stock.percentage ?? 0) * scale,
    contributions: stock.contributions.map(c => ({ ...c, value: c.value * scale })),
  }));
}

export interface StockContext {
  rootValue: number;
  equityValue: number;
  sectorValue: number;
  sectorName: string;
  sectorPalette: PaletteColor;
}

function buildSchemeNodes(
  stock: StockExposure,
  ctx: StockContext
): HierarchyNode[] {
  const stockVal = stock.absoluteValue;
  const { rootValue, equityValue, sectorValue, sectorName, sectorPalette } = ctx;
  return stock.contributions.map(contrib => ({
    id: `stock-${slugify(stock.name)}-scheme-${slugify(contrib.schemeName)}`,
    name: contrib.schemeName,
    depth: 'scheme' as const,
    metrics: {
      signedValue: contrib.value,
      layoutValue: Math.max(0, contrib.value),
      weightOfPortfolio: rootValue > 0 ? contrib.value / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? contrib.value / equityValue : 0,
      weightOfParent: stockVal > 0 ? contrib.value / stockVal : 0,
      weightOfSector: sectorValue > 0 ? contrib.value / sectorValue : 0,
    },
    color: sectorPalette.bg,
    textColor: sectorPalette.text,
    isHedged: contrib.schemeName.toLowerCase().includes('arbitrage'),
    sector: sectorName,
  }));
}

export function buildStandardStockNode(
  stock: StockExposure,
  ctx: StockContext,
  options: HierarchyOptions
): HierarchyNode {
  const stockVal = stock.absoluteValue;
  const { rootValue, equityValue, sectorValue, sectorName, sectorPalette } = ctx;
  const isHedgedStock =
    !options.excludeArbitrage &&
    stock.contributions.some(c => c.schemeName.toLowerCase().includes('arbitrage'));

  let children: HierarchyNode[] | undefined;
  if (options.includeSchemes && stock.contributions && stock.contributions.length > 0) {
    children = buildSchemeNodes(stock, ctx);
  }

  return {
    id: `stock-${slugify(stock.name)}`,
    name: stock.name,
    depth: 'stock',
    metrics: {
      signedValue: stockVal,
      layoutValue: Math.max(0, stockVal),
      weightOfPortfolio: rootValue > 0 ? stockVal / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? stockVal / equityValue : 0,
      weightOfParent: sectorValue > 0 ? stockVal / sectorValue : 0,
      weightOfSector: sectorValue > 0 ? stockVal / sectorValue : 0,
    },
    color: sectorPalette.bg,
    textColor: sectorPalette.text,
    ...(children ? { children } : {}),
    contributions: stock.contributions,
    isHedged: isHedgedStock,
    sector: sectorName,
    schemeCount: stock.contributions?.length ?? 1,
  };
}

export function buildMicroClusterNode(
  microStocks: StockExposure[],
  ctx: StockContext,
  coalesceThreshold: number
): HierarchyNode {
  const microSum = microStocks.reduce((sum, s) => sum + s.absoluteValue, 0);
  const allMicroContributions = microStocks.flatMap(s => s.contributions);
  const uniqueSchemes = new Set(allMicroContributions.map(c => c.schemeName)).size;
  const thresholdPercentStr = (coalesceThreshold * 100).toFixed(1);
  const { rootValue, equityValue, sectorValue, sectorName, sectorPalette } = ctx;

  return {
    id: `sector-${slugify(sectorName)}-micro-cluster`,
    name: `Other (<${thresholdPercentStr}%)`,
    depth: 'stock',
    metrics: {
      signedValue: microSum,
      layoutValue: Math.max(0, microSum),
      weightOfPortfolio: rootValue > 0 ? microSum / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? microSum / equityValue : 0,
      weightOfParent: sectorValue > 0 ? microSum / sectorValue : 0,
      weightOfSector: sectorValue > 0 ? microSum / sectorValue : 0,
    },
    color: sectorPalette.bg,
    textColor: sectorPalette.text,
    contributions: allMicroContributions,
    isSynthetic: true,
    isTail: true,
    sector: sectorName,
    schemeCount: uniqueSchemes,
  };
}

export function buildSyntheticTailNode(
  sectorGap: number,
  ctx: StockContext
): HierarchyNode {
  const { rootValue, equityValue, sectorValue, sectorName, sectorPalette } = ctx;
  return {
    id: `sector-${slugify(sectorName)}-synthetic-tail`,
    name: `Other Scheme Holdings (${sectorName})`,
    depth: 'stock',
    metrics: {
      signedValue: sectorGap,
      layoutValue: Math.max(0, sectorGap),
      weightOfPortfolio: rootValue > 0 ? sectorGap / rootValue : 0,
      weightOfAssetClass: equityValue > 0 ? sectorGap / equityValue : 0,
      weightOfParent: sectorValue > 0 ? sectorGap / sectorValue : 0,
      weightOfSector: sectorValue > 0 ? sectorGap / sectorValue : 0,
    },
    color: sectorPalette.bg,
    textColor: sectorPalette.text,
    isSynthetic: true,
    isTail: true,
    sector: sectorName,
    schemeCount: 0,
  };
}
