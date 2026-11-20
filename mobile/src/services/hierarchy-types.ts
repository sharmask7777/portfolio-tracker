/**
 * Depth tier in the portfolio hierarchy tree.
 */
export type HierarchyDepth = 'root' | 'assetClass' | 'sector' | 'stock' | 'scheme';

/**
 * Monetary metrics and multi-denominator proportional weights for a hierarchy node.
 */
export interface NodeMetrics {
  signedValue: number;
  layoutValue: number;
  weightOfPortfolio: number;
  weightOfAssetClass: number;
  weightOfParent: number;
  weightOfSector?: number | undefined;
}

/**
 * Contribution of an individual mutual fund scheme to an underlying company's exposure.
 */
export interface StockContribution {
  schemeName: string;
  value: number;
  weight: number;
}

/**
 * Aggregated look-through exposure in a single underlying publicly traded company.
 */
export interface StockExposure {
  name: string;
  sector: string;
  absoluteValue: number;
  percentage: number;
  contributions: StockContribution[];
}

/**
 * Macro portfolio analytical composition and allocations.
 */
export interface XRayData {
  totalValue: number;
  assetAllocation: {
    equity: { percentage: number; value: number };
    debt: { percentage: number; value: number };
    cash: { percentage: number; value: number };
    gold: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
  sectors: { name: string; percentage: number; value: number }[];
  marketCap: {
    large: { percentage: number; value: number };
    mid: { percentage: number; value: number };
    small: { percentage: number; value: number };
    other?: { percentage: number; value: number } | undefined;
  };
  exArbitrage?: {
    assetAllocation: {
      equity: { percentage: number; value: number };
      debt: { percentage: number; value: number };
      cash: { percentage: number; value: number };
      gold: { percentage: number; value: number };
      arbitrage: { percentage: number; value: number };
      other: { percentage: number; value: number };
    };
    sectors: { name: string; percentage: number; value: number }[];
    marketCap: {
      large: { percentage: number; value: number };
      mid: { percentage: number; value: number };
      small: { percentage: number; value: number };
      other?: { percentage: number; value: number } | undefined;
    };
  } | undefined;
}

/**
 * Normalized node in the portfolio hierarchy tree.
 */
export interface HierarchyNode {
  id: string;
  name: string;
  depth: HierarchyDepth;
  metrics: NodeMetrics;
  color: string;
  textColor: string;
  children?: HierarchyNode[] | undefined;
  contributions?: StockContribution[] | undefined;
  isSynthetic?: boolean | undefined;
  isTail?: boolean | undefined;
  isHedged?: boolean | undefined;
  sector?: string | undefined;
  schemeCount?: number | undefined;
}

export interface HierarchyOptions {
  excludeArbitrage?: boolean | undefined;
  coalesceThreshold?: number | undefined;
  isDarkMode?: boolean | undefined;
  includeSchemes?: boolean | undefined;
}

export interface PaletteColor {
  bg: string;
  text: string;
  border?: string | undefined;
  darkBg?: string | undefined;
  darkText?: string | undefined;
}

export interface IndianRupeeFormatOptions {
  compact?: boolean | undefined;
  decimals?: number | undefined;
  includeSymbol?: boolean | undefined;
}
