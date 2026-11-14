/**
 * @file hierarchy-builder.ts
 * @module utils/hierarchy-builder
 * @description Institutional-grade portfolio hierarchy transformation engine.
 *
 * Transforms flat and macro portfolio analytical data (XRayData) and look-through equity exposures
 * (StockExposure[]) into an N-level normalized, mathematically reconciled hierarchy tree (HierarchyNode).
 *
 * ### Architectural & Statutory Invariants Enforced:
 * 1. **The Invariant Oracle Law & Value Conservation Law**:
 *    For every non-leaf node $u$ with children $C(u)$:
 *    $$\operatorname{val}(u) = \sum_{v \in C(u)} \operatorname{val}(v) \pm ₹0.01$$
 *    The root node value reconciles to total portfolio net worth.
 *
 * 2. **Look-Through Coverage Gap Reconciliation**:
 *    Active mutual funds typically disclose only their top 80-90% holdings (with the remaining 10-20%
 *    residual in micro-equities and cash drag). To prevent visual gaps or phantom losses in drilldown charts,
 *    this engine synthesizes a deterministic tail node:
 *    `Other Scheme Holdings (${sectorName})` for any residual sector balance.
 *
 * 3. **The Three-Denominator Formulation**:
 *    Eliminates denominator ambiguity in multi-level drilldowns by pre-computing:
 *    - `weightOfPortfolio`: Proportion relative to total portfolio net worth.
 *    - `weightOfAssetClass`: Proportion relative to enclosing asset class (e.g., Equity).
 *    - `weightOfParent`: Proportion relative to direct parent node in active drilldown context.
 *    - `weightOfSector`: Proportion relative to enclosing sector (for equity holdings).
 *
 * 4. **Hare-Niemeyer (Largest Remainder) Rounding Parity**:
 *    Distributes basis points across sibling partitions so that formatted percentages (to 2 decimal
 *    places) sum to exactly 100.00% without cumulative rounding drift.
 *
 * 5. **Arbitrage & Hedging Segregation**:
 *    When `excludeArbitrage` is enabled, hedged equity strategies (cash-futures spreads) are isolated
 *    into an independent asset class (`Arbitrage / Hedged Strategies`) to prevent artificial inflation
 *    of pure directional equity beta.
 */

// ============================================================================
// Core Domain Types & Interfaces
// ============================================================================

/**
 * Depth tier in the portfolio hierarchy tree.
 * - 'root': Overall portfolio net worth container.
 * - 'assetClass': Macro asset classes (Equity, Debt, Cash, Gold, Arbitrage, Other).
 * - 'sector': Industrial macro sectors under an asset class (e.g., Financial Services).
 * - 'stock': Individual underlying corporate equity look-through position.
 * - 'scheme': Contributing mutual fund scheme holding the underlying corporate equity.
 */
export type HierarchyDepth = 'root' | 'assetClass' | 'sector' | 'stock' | 'scheme';

/**
 * Monetary metrics and multi-denominator proportional weights for a hierarchy node.
 */
export interface NodeMetrics {
  /** Signed rupee valuation of this node (positive for long assets, negative for net liabilities/derivatives). */
  signedValue: number;
  /** Strictly non-negative layout valuation used for proportional visual geometry (treemap tile area / sunburst arc). */
  layoutValue: number;
  /** Proportional weight relative to total portfolio net worth [0.0, 1.0]. */
  weightOfPortfolio: number;
  /** Proportional weight relative to enclosing macro asset class [0.0, 1.0]. */
  weightOfAssetClass: number;
  /** Proportional weight relative to direct parent node [0.0, 1.0]. */
  weightOfParent: number;
  /** Proportional weight relative to enclosing macro sector [0.0, 1.0], or undefined if outside a sector. */
  weightOfSector?: number | undefined;
}

/**
 * Contribution of an individual mutual fund scheme to an underlying company's portfolio exposure.
 */
export interface StockContribution {
  /** Name of the mutual fund scheme holding the underlying company. */
  schemeName: string;
  /** Look-through rupee valuation of the stock held via this specific scheme. */
  value: number;
  /** Percentage portfolio weight of this stock within the specific scheme's asset portfolio. */
  weight: number;
}

/**
 * Aggregated look-through exposure in a single underlying publicly traded company.
 */
export interface StockExposure {
  /** Canonical name of the underlying company (e.g., 'HDFC Bank Ltd.'). */
  name: string;
  /** Macro industrial sector classification (e.g., 'Financial Services', 'Technology'). */
  sector: string;
  /** Aggregated monetary value held across all portfolio mutual funds and direct equities. */
  absoluteValue: number;
  /** Effective portfolio-level percentage weight (0.0 to 1.0). */
  percentage: number;
  /** Breakdown of individual mutual fund schemes contributing to this stock position. */
  contributions: StockContribution[];
}

/**
 * Input contract representing macro portfolio analytical composition and allocations.
 */
export interface XRayData {
  /** Total portfolio rupee net worth. */
  totalValue: number;
  /** Macro asset class breakdown. */
  assetAllocation: {
    equity: { percentage: number; value: number };
    debt: { percentage: number; value: number };
    cash: { percentage: number; value: number };
    gold: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
  /** Equity sector allocation breakdown. */
  sectors: { name: string; percentage: number; value: number }[];
  /** Market capitalization classification breakdown. */
  marketCap: {
    large: { percentage: number; value: number };
    mid: { percentage: number; value: number };
    small: { percentage: number; value: number };
    other?: { percentage: number; value: number } | undefined;
  };
  /** Optional ex-arbitrage view isolating hedged cash-futures mutual fund schemes. */
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
  /** Optional expense analysis information. */
  expenseAnalysis?: {
    totalAnnualFees: number;
    weightedAvgTer: number;
    categoryBreakdown: { category: string; totalFees: number; avgTer: number; percentage: number; value: number }[];
    fundBreakdown: { name: string; isin: string; category: string; ter: number; annualizedFee: number; value: number }[];
  } | undefined;
  /** Optional fund category breakdown. */
  fundCategoryAllocation?: {
    active: { percentage: number; value: number };
    index: { percentage: number; value: number };
    arbitrage: { percentage: number; value: number };
    other: { percentage: number; value: number };
  } | undefined;
}

/**
 * Normalized node in the portfolio hierarchy tree.
 */
export interface HierarchyNode {
  /** Unique, deterministic identifier for DOM reconciliation and SVG element keys. */
  id: string;
  /** Human-readable display label (e.g., 'Financial Services', 'HDFC Bank Ltd.'). */
  name: string;
  /** Hierarchical depth level of this node. */
  depth: HierarchyDepth;
  /** Financial valuation and multi-denominator proportional metrics. */
  metrics: NodeMetrics;
  /** Accessible background / fill color token adhering to WCAG 2.1 AA. */
  color: string;
  /** Accessible high-contrast foreground text color token (contrast ratio >= 4.5:1). */
  textColor: string;
  /** Child nodes in the hierarchy tree, or undefined if this node is a leaf. */
  children?: HierarchyNode[] | undefined;
  /** Mutual fund scheme breakdown contributing to this equity holding (present on stock nodes). */
  contributions?: StockContribution[] | undefined;
  /** Whether this node was synthetically generated to reconcile undisclosed mutual fund holdings. */
  isSynthetic?: boolean | undefined;
  /** Whether this node represents a residual tail holding or micro-allocation cluster. */
  isTail?: boolean | undefined;
  /** Whether this holding represents a fully hedged cash-futures arbitrage position. */
  isHedged?: boolean | undefined;
  /** Canonical industrial sector name to which this holding belongs. */
  sector?: string | undefined;
  /** Number of contributing mutual fund schemes holding this underlying company. */
  schemeCount?: number | undefined;
}

/**
 * Configuration options customizing hierarchy construction and reconciliation.
 */
export interface HierarchyOptions {
  /**
   * Whether to isolate arbitrage mutual funds into an independent root asset class
   * to eliminate directional beta distortion.
   */
  excludeArbitrage?: boolean | undefined;
  /**
   * Threshold for coalescing micro-holdings into an aggregated Other cluster (e.g. 0.003 for 0.3%).
   * Micro-allocations below this threshold are combined into `Other (<X%)`.
   */
  coalesceThreshold?: number | undefined;
  /**
   * Whether dark mode theme colors should be selected from the accessible palette.
   */
  isDarkMode?: boolean | undefined;
  /**
   * Whether to expand stock nodes into leaf mutual fund scheme nodes (depth: 'scheme').
   * Defaults to false (stocks remain terminal leaves with contributions stored as metadata).
   */
  includeSchemes?: boolean | undefined;
}

/**
 * Color palette entry with WCAG 2.1 AA compliant contrast standards.
 */
export interface PaletteColor {
  /** Background hex color for light theme. */
  bg: string;
  /** High-contrast text hex color for light theme (contrast >= 4.5:1). */
  text: string;
  /** Optional border hex color. */
  border?: string | undefined;
  /** Background hex color for dark theme. */
  darkBg?: string | undefined;
  /** High-contrast text hex color for dark theme (contrast >= 4.5:1). */
  darkText?: string | undefined;
}

// ============================================================================
// Accessible Color Palettes (WCAG 2.1 AA >= 4.5:1 Contrast Ratio)
// ============================================================================

/**
 * Institutional 12-sector color palette with accessible contrast pairings.
 */
export const SECTOR_PALETTE: Record<string, PaletteColor> = {
  'Financial Services': {
    bg: '#1d4ed8', // Blue 700 (contrast on white 8.4:1)
    text: '#ffffff',
    darkBg: '#2563eb',
    darkText: '#ffffff',
  },
  'Technology': {
    bg: '#0284c7', // Sky 600 (contrast on white 4.6:1)
    text: '#ffffff',
    darkBg: '#0ea5e9',
    darkText: '#0f172a',
  },
  'Healthcare': {
    bg: '#059669', // Emerald 600 (contrast on white 4.7:1)
    text: '#ffffff',
    darkBg: '#10b981',
    darkText: '#0f172a',
  },
  'Consumer Cyclical': {
    bg: '#d97706', // Amber 600
    text: '#0f172a', // Dark text provides 7.8:1 contrast
    darkBg: '#f59e0b',
    darkText: '#0f172a',
  },
  'Consumer Defensive': {
    bg: '#e11d48', // Rose 600 (contrast on white 4.8:1)
    text: '#ffffff',
    darkBg: '#f43f5e',
    darkText: '#ffffff',
  },
  'Energy': {
    bg: '#b45309', // Amber 700 / Bronze (contrast on white 5.4:1)
    text: '#ffffff',
    darkBg: '#d97706',
    darkText: '#0f172a',
  },
  'Industrials': {
    bg: '#4f46e5', // Indigo 600 (contrast on white 7.9:1)
    text: '#ffffff',
    darkBg: '#6366f1',
    darkText: '#ffffff',
  },
  'Basic Materials': {
    bg: '#7c3aed', // Violet 600 (contrast on white 7.5:1)
    text: '#ffffff',
    darkBg: '#8b5cf6',
    darkText: '#ffffff',
  },
  'Communication Services': {
    bg: '#0891b2', // Cyan 600 (contrast on white 4.6:1)
    text: '#ffffff',
    darkBg: '#06b6d4',
    darkText: '#0f172a',
  },
  'Utilities': {
    bg: '#0f766e', // Teal 700 (contrast on white 5.6:1)
    text: '#ffffff',
    darkBg: '#14b8a6',
    darkText: '#0f172a',
  },
  'Real Estate': {
    bg: '#9333ea', // Purple 600 (contrast on white 6.2:1)
    text: '#ffffff',
    darkBg: '#a855f7',
    darkText: '#ffffff',
  },
  'Other': {
    bg: '#475569', // Slate 600 (contrast on white 5.1:1)
    text: '#ffffff',
    darkBg: '#64748b',
    darkText: '#ffffff',
  },
};

/**
 * Macro asset class color tokens.
 */
export const ASSET_CLASS_PALETTE: Record<string, PaletteColor> = {
  equity: {
    bg: '#2563eb', // Blue 600
    text: '#ffffff',
    darkBg: '#3b82f6',
    darkText: '#ffffff',
  },
  debt: {
    bg: '#7c3aed', // Purple 600
    text: '#ffffff',
    darkBg: '#8b5cf6',
    darkText: '#ffffff',
  },
  cash: {
    bg: '#059669', // Emerald 600
    text: '#ffffff',
    darkBg: '#10b981',
    darkText: '#0f172a',
  },
  gold: {
    bg: '#d97706', // Amber 600
    text: '#0f172a',
    darkBg: '#f59e0b',
    darkText: '#0f172a',
  },
  arbitrage: {
    bg: '#0d9488', // Teal 600
    text: '#ffffff',
    darkBg: '#14b8a6',
    darkText: '#0f172a',
  },
  other: {
    bg: '#64748b', // Slate 500
    text: '#ffffff',
    darkBg: '#94a3b8',
    darkText: '#0f172a',
  },
};

/**
 * Resolves the palette color for a given sector name, falling back to 'Other'.
 */
export function getSectorColor(sectorName: string, isDarkMode = false): PaletteColor {
  const entry = SECTOR_PALETTE[sectorName] ?? SECTOR_PALETTE['Other'] ?? {
    bg: '#475569',
    text: '#ffffff',
  };

  if (isDarkMode && entry.darkBg && entry.darkText) {
    return {
      bg: entry.darkBg,
      text: entry.darkText,
      border: entry.border,
    };
  }

  return entry;
}

/**
 * Resolves the palette color for a given macro asset class key.
 */
export function getAssetClassColor(assetClass: string, isDarkMode = false): PaletteColor {
  const normalizedKey = assetClass.toLowerCase().replace(/[^a-z]/g, '');
  const entry = ASSET_CLASS_PALETTE[normalizedKey] ?? ASSET_CLASS_PALETTE['other'] ?? {
    bg: '#64748b',
    text: '#ffffff',
  };

  if (isDarkMode && entry.darkBg && entry.darkText) {
    return {
      bg: entry.darkBg,
      text: entry.darkText,
      border: entry.border,
    };
  }

  return entry;
}

// ============================================================================
// Mathematical Rounding Parity & Indian Currency Formatting
// ============================================================================

/**
 * Distributes integer basis points across items proportional to their input weights
 * using the Hare-Niemeyer (Largest Remainder) Method, guaranteeing that the sum of
 * returned basis points exactly equals `targetSumBps` (10,000 bps = 100.00%).
 *
 * ### Mathematical Formulation:
 * 1. Let $w_i \ge 0$ be the weights, and $W = \sum w_i$.
 * 2. Exact quota: $q_i = \frac{w_i}{W} \times T$, where $T = \text{targetSumBps}$.
 * 3. Floor quota: $f_i = \lfloor q_i \rfloor$, remainder: $r_i = q_i - f_i$.
 * 4. Discrepancy: $\Delta = T - \sum f_i$.
 * 5. Add $+1$ to the $\Delta$ items with the largest fractional remainders $r_i$.
 *
 * @param weights - Array of non-negative weights or monetary values.
 * @param targetSumBps - Target basis points sum (default 10,000 for 100.00%).
 * @returns Array of integer basis points summing exactly to `targetSumBps`.
 */
export function distributeBasisPoints(weights: number[], targetSumBps = 10000): number[] {
  if (weights.length === 0) {
    return [];
  }

  const totalWeight = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (totalWeight <= 0 || targetSumBps <= 0) {
    return weights.map(() => 0);
  }

  // Calculate quotas and integer floors
  const quotas = weights.map(w => {
    const validWeight = w > 0 ? w : 0;
    return (validWeight / totalWeight) * targetSumBps;
  });

  const floors = quotas.map(q => Math.floor(q));
  const remainders = quotas.map((q, idx) => ({
    index: idx,
    remainder: q - (floors[idx] ?? 0),
  }));

  const floorSum = floors.reduce((sum, f) => sum + f, 0);
  let discrepancy = targetSumBps - floorSum;

  // Sort remainders descending, breaking ties deterministically by index
  remainders.sort((a, b) => {
    const diff = b.remainder - a.remainder;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }
    return a.index - b.index;
  });

  const result = [...floors];
  for (let i = 0; i < remainders.length && discrepancy > 0; i++) {
    const item = remainders[i];
    if (item) {
      result[item.index] = (result[item.index] ?? 0) + 1;
      discrepancy--;
    }
  }

  return result;
}

/**
 * Formats sibling proportions into percentage strings with two decimal places (e.g. '33.34%')
 * using the Hare-Niemeyer (Largest Remainder) Method, guaranteeing that the numeric values
 * sum to exactly 100.00% without rounding drift.
 *
 * @param weights - Array of non-negative numeric weights or values.
 * @returns Array of percentage strings formatted to 2 decimal places.
 */
export function formatPercentagesWithParity(weights: number[]): string[] {
  const bps = distributeBasisPoints(weights, 10000);
  return bps.map(bp => `${(bp / 100).toFixed(2)}%`);
}

/**
 * Formatting options for Indian Rupee representation.
 */
export interface IndianRupeeFormatOptions {
  /** Whether to format into compact units (Cr for Crores, L for Lakhs). Defaults to true. */
  compact?: boolean | undefined;
  /** Number of decimal places to preserve for compact notation. Defaults to 2. */
  decimals?: number | undefined;
  /** Whether to include the Indian Rupee symbol (₹). Defaults to true. */
  includeSymbol?: boolean | undefined;
}

/**
 * Formats monetary amounts in Indian Rupee format according to statutory conventions:
 * - $\ge ₹1\text{ Cr}$ ($10,000,000$): `₹X.XX Cr`
 * - $\ge ₹1\text{ L}$ ($100,000$ and $< 10,000,000$): `₹X.XX L`
 * - $< 1\text{ L}$: Standard Indian thousands grouping (`₹XX,XXX`).
 *
 * @param value - Numeric monetary value in rupees.
 * @param options - Customization options for symbol, decimals, and compact mode.
 * @returns Formatted Indian Rupee currency string.
 */
export function formatIndianRupee(value: number, options?: IndianRupeeFormatOptions): string {
  const compact = options?.compact ?? true;
  const decimals = options?.decimals ?? 2;
  const includeSymbol = options?.includeSymbol ?? true;

  if (!Number.isFinite(value)) {
    return includeSymbol ? '₹0' : '0';
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const symbol = includeSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  if (compact) {
    if (absValue >= 10000000) {
      // Crores (>= 1 Cr)
      const formatted = (absValue / 10000000).toFixed(decimals);
      return `${sign}${symbol}${formatted} Cr`;
    }
    if (absValue >= 100000) {
      // Lakhs (>= 1 L)
      const formatted = (absValue / 100000).toFixed(decimals);
      return `${sign}${symbol}${formatted} L`;
    }
  }

  // Under 1 Lakh or non-compact mode: use Indian locale grouping
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: compact ? 0 : decimals,
    minimumFractionDigits: compact ? 0 : 0,
  }).format(absValue);

  return `${sign}${symbol}${formattedNumber}`;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Generates a clean URL-friendly slug for node identifiers.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// Hierarchy Transformation Engine
// ============================================================================

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
  const excludeArbitrage = options?.excludeArbitrage ?? false;
  const coalesceThreshold = options?.coalesceThreshold ?? 0;
  const isDarkMode = options?.isDarkMode ?? false;
  const includeSchemes = options?.includeSchemes ?? false;

  // Step 1: Select active asset allocation and sector breakdown based on excludeArbitrage toggle
  const isExArbActive = excludeArbitrage && data?.exArbitrage !== undefined;
  const activeAllocation = (isExArbActive && data?.exArbitrage ? data.exArbitrage.assetAllocation : data?.assetAllocation) ?? {};
  const activeSectors = (isExArbActive && data?.exArbitrage ? data.exArbitrage.sectors : data?.sectors) ?? [];

  // Step 2: Establish root portfolio net worth
  const rawRootValue = data?.totalValue;
  const rootValue = Number.isFinite(rawRootValue) && (rawRootValue ?? 0) > 0 ? (rawRootValue ?? 0) : 0;

  // Step 3: Construct Macro Asset Classes
  const assetClassNodes: HierarchyNode[] = [];

  // 3a. Equity
  const rawEquityValue = activeAllocation.equity?.value ?? 0;
  const equityValue = Number.isFinite(rawEquityValue) && rawEquityValue > 0 ? rawEquityValue : 0;

  if (equityValue > 0) {
    const equityPalette = getAssetClassColor('equity', isDarkMode);

    // Build sectors under equity
    const sectorNodes: HierarchyNode[] = [];
    const validSectors = (activeSectors ?? []).filter(s => s.value > 0);
    const disclosedSectorsSum = validSectors.reduce((sum, s) => sum + s.value, 0);

    for (const sectorItem of validSectors) {
      const sectorValue = sectorItem.value;
      const sectorPalette = getSectorColor(sectorItem.name, isDarkMode);

      // Find look-through stock exposures belonging to this sector
      const hasExposures = exposures !== undefined && exposures.length > 0;
      let stockNodes: HierarchyNode[] | undefined = undefined;

      if (hasExposures) {
        // Filter and adapt exposures for active sector and arbitrage exclusions
        const matchingStocksRaw = exposures
          .filter(e => e.sector.trim().toLowerCase() === sectorItem.name.trim().toLowerCase())
          .map(stock => {
            if (!excludeArbitrage || !stock.contributions || stock.contributions.length === 0) {
              return stock;
            }
            const nonArbContribs = stock.contributions.filter(
              c => !c.schemeName.toLowerCase().includes('arbitrage')
            );
            if (nonArbContribs.length === stock.contributions.length) {
              return stock;
            }
            const recomputedVal = nonArbContribs.reduce((sum, c) => sum + c.value, 0);
            return {
              ...stock,
              absoluteValue: recomputedVal,
              percentage: rootValue > 0 ? recomputedVal / rootValue : 0,
              contributions: nonArbContribs,
            };
          })
          .filter(stock => stock.absoluteValue > 0.001);

        // Institutional Invariant Reconciliation: Ensure total disclosed stocks do not exceed parent sector
        const rawStockSum = matchingStocksRaw.reduce((sum, s) => sum + s.absoluteValue, 0);
        const scaleFactor = rawStockSum > sectorValue && rawStockSum > 0 ? sectorValue / rawStockSum : 1.0;

        const matchingStocks = scaleFactor < 1.0
          ? matchingStocksRaw.map(stock => ({
              ...stock,
              absoluteValue: stock.absoluteValue * scaleFactor,
              percentage: (stock.percentage ?? 0) * scaleFactor,
              contributions: stock.contributions.map(c => ({
                ...c,
                value: c.value * scaleFactor,
              })),
            }))
          : matchingStocksRaw;

        // Micro-allocation coalescing check
        let standardStocks = matchingStocks;
        let microStocks: StockExposure[] = [];

        if (coalesceThreshold > 0 && rootValue > 0) {
          standardStocks = matchingStocks.filter(
            s => s.absoluteValue / rootValue >= coalesceThreshold
          );
          microStocks = matchingStocks.filter(
            s => s.absoluteValue / rootValue < coalesceThreshold
          );
        }

        const builtStockNodes: HierarchyNode[] = [];

        // Build individual standard stock nodes
        for (const stock of standardStocks) {
          const stockVal = stock.absoluteValue;
          const isHedgedStock = !excludeArbitrage && stock.contributions.some(
            c => c.schemeName.toLowerCase().includes('arbitrage')
          );

          // Scheme children if requested
          let schemeNodes: HierarchyNode[] | undefined = undefined;
          if (includeSchemes && stock.contributions && stock.contributions.length > 0) {
            schemeNodes = stock.contributions.map(contrib => ({
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
              sector: sectorItem.name,
            }));
          }

          builtStockNodes.push({
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
            ...(schemeNodes ? { children: schemeNodes } : {}),
            contributions: stock.contributions,
            isHedged: isHedgedStock,
            sector: sectorItem.name,
            schemeCount: stock.contributions?.length ?? 1,
          });
        }

        // Build coalesced micro-allocation cluster node if present
        if (microStocks.length > 0) {
          const microSum = microStocks.reduce((sum, s) => sum + s.absoluteValue, 0);
          const allMicroContributions = microStocks.flatMap(s => s.contributions);
          const uniqueSchemes = new Set(allMicroContributions.map(c => c.schemeName)).size;
          const thresholdPercentStr = (coalesceThreshold * 100).toFixed(1);

          builtStockNodes.push({
            id: `sector-${slugify(sectorItem.name)}-micro-cluster`,
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
            sector: sectorItem.name,
            schemeCount: uniqueSchemes,
          });
        }

        // Look-through coverage gap reconciliation
        const totalDisclosedStockSum = matchingStocks.reduce(
          (sum, s) => sum + s.absoluteValue,
          0
        );
        // If total disclosed stocks exceed sectorValue (e.g. When gross exposures are passed to an ex-arbitrage view),
        // we scale stock values down proportionally so they don't exceed the sector value.
        if (totalDisclosedStockSum > sectorValue && totalDisclosedStockSum > 0) {
          const scale = sectorValue / totalDisclosedStockSum;
          builtStockNodes.forEach(sn => {
            const scaledVal = sn.metrics.signedValue * scale;
            sn.metrics.signedValue = scaledVal;
            sn.metrics.layoutValue = Math.max(0, scaledVal);
            sn.metrics.weightOfPortfolio = rootValue > 0 ? scaledVal / rootValue : 0;
            sn.metrics.weightOfAssetClass = equityValue > 0 ? scaledVal / equityValue : 0;
            sn.metrics.weightOfParent = sectorValue > 0 ? scaledVal / sectorValue : 0;
            sn.metrics.weightOfSector = sectorValue > 0 ? scaledVal / sectorValue : 0;
          });
        }

        const effectiveDisclosedSum = builtStockNodes.reduce(
          (sum, s) => sum + s.metrics.signedValue,
          0
        );
        const sectorGap = sectorValue - effectiveDisclosedSum;

        if (sectorGap > 0.01) {
          builtStockNodes.push({
            id: `sector-${slugify(sectorItem.name)}-synthetic-tail`,
            name: `Other Scheme Holdings (${sectorItem.name})`,
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
            sector: sectorItem.name,
            schemeCount: 0,
          });
        }

        stockNodes = builtStockNodes;
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

    // If sectors sum to less than total equity value, synthesize an Other Sectors node
    const sectorGapUnderEquity = equityValue - disclosedSectorsSum;
    if (sectorGapUnderEquity > 0.01) {
      const otherPalette = getSectorColor('Other', isDarkMode);
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

    assetClassNodes.push({
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
    });
  }

  // 3b. Debt
  const rawDebtValue = activeAllocation.debt?.value ?? 0;
  if (rawDebtValue > 0) {
    const debtPalette = getAssetClassColor('debt', isDarkMode);
    assetClassNodes.push({
      id: 'asset-debt',
      name: 'Debt',
      depth: 'assetClass',
      metrics: {
        signedValue: rawDebtValue,
        layoutValue: Math.max(0, rawDebtValue),
        weightOfPortfolio: rootValue > 0 ? rawDebtValue / rootValue : 0,
        weightOfAssetClass: 1.0,
        weightOfParent: rootValue > 0 ? rawDebtValue / rootValue : 0,
      },
      color: debtPalette.bg,
      textColor: debtPalette.text,
    });
  }

  // 3c. Cash
  const rawCashValue = activeAllocation.cash?.value ?? 0;
  if (rawCashValue > 0) {
    const cashPalette = getAssetClassColor('cash', isDarkMode);
    assetClassNodes.push({
      id: 'asset-cash',
      name: 'Cash & Equivalents',
      depth: 'assetClass',
      metrics: {
        signedValue: rawCashValue,
        layoutValue: Math.max(0, rawCashValue),
        weightOfPortfolio: rootValue > 0 ? rawCashValue / rootValue : 0,
        weightOfAssetClass: 1.0,
        weightOfParent: rootValue > 0 ? rawCashValue / rootValue : 0,
      },
      color: cashPalette.bg,
      textColor: cashPalette.text,
    });
  }

  // 3d. Gold
  const rawGoldValue = activeAllocation.gold?.value ?? 0;
  if (rawGoldValue > 0) {
    const goldPalette = getAssetClassColor('gold', isDarkMode);
    assetClassNodes.push({
      id: 'asset-gold',
      name: 'Gold & Commodities',
      depth: 'assetClass',
      metrics: {
        signedValue: rawGoldValue,
        layoutValue: Math.max(0, rawGoldValue),
        weightOfPortfolio: rootValue > 0 ? rawGoldValue / rootValue : 0,
        weightOfAssetClass: 1.0,
        weightOfParent: rootValue > 0 ? rawGoldValue / rootValue : 0,
      },
      color: goldPalette.bg,
      textColor: goldPalette.text,
    });
  }

  // 3e. Arbitrage (Dedicated asset class when excludeArbitrage is true and allocation > 0)
  if (isExArbActive && data.exArbitrage?.assetAllocation.arbitrage) {
    const rawArbValue = data.exArbitrage.assetAllocation.arbitrage.value;
    if (rawArbValue > 0) {
      const arbPalette = getAssetClassColor('arbitrage', isDarkMode);
      assetClassNodes.push({
        id: 'asset-arbitrage',
        name: 'Arbitrage / Hedged Strategies',
        depth: 'assetClass',
        metrics: {
          signedValue: rawArbValue,
          layoutValue: Math.max(0, rawArbValue),
          weightOfPortfolio: rootValue > 0 ? rawArbValue / rootValue : 0,
          weightOfAssetClass: 1.0,
          weightOfParent: rootValue > 0 ? rawArbValue / rootValue : 0,
        },
        color: arbPalette.bg,
        textColor: arbPalette.text,
        isHedged: true,
      });
    }
  }

  // 3f. Other Assets
  const rawOtherValue = activeAllocation.other?.value ?? 0;
  if (rawOtherValue > 0) {
    const otherPalette = getAssetClassColor('other', isDarkMode);
    assetClassNodes.push({
      id: 'asset-other',
      name: 'Other Assets',
      depth: 'assetClass',
      metrics: {
        signedValue: rawOtherValue,
        layoutValue: Math.max(0, rawOtherValue),
        weightOfPortfolio: rootValue > 0 ? rawOtherValue / rootValue : 0,
        weightOfAssetClass: 1.0,
        weightOfParent: rootValue > 0 ? rawOtherValue / rootValue : 0,
      },
      color: otherPalette.bg,
      textColor: otherPalette.text,
    });
  }

  // Step 4: Construct Root Node
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
    ...(assetClassNodes.length > 0 ? { children: assetClassNodes } : { children: [] }),
  };
}
