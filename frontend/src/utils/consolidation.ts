/**
 * @file consolidation.ts
 * @module utils/consolidation
 * @description Provides financial consolidation algorithms for grouping individual mutual fund
 * and equity folios across multiple PANs or accounts into unified, scheme-level master views.
 *
 * Implements value-weighted annualized performance aggregation (XIRR), prior-day net asset
 * change derivation, post-tax return computations, and multi-PAN deduplication.
 */

/**
 * Constituent asset metadata associated with an individual folio.
 */
export interface FolioAssetInfo {
  /** Unique asset database identifier if assigned. */
  id?: string;
  /** Official or reported scheme/stock name. */
  name?: string;
  /** Asset classification (e.g., 'MUTUAL_FUND', 'EQUITY', 'DEBT'). */
  type?: string;
  /** International Securities Identification Number (12-character alphanumeric code). */
  isin?: string;
  /** Association of Mutual Funds in India (AMFI) numeric scheme code. */
  amfiCode?: string;
}

/**
 * Performance, valuation, and statutory tax metrics computed for an individual folio.
 */
export interface FolioMetricsInput {
  /** Cumulative cost basis of units currently held. */
  investedAmount?: number;
  /** Latest market valuation (units * current NAV). */
  currentValue?: number;
  /** Absolute net gain/loss relative to previous trading session NAV. */
  dayChange?: number;
  /** Percentage change relative to prior-day closing valuation. */
  dayChangePercentage?: number;
  /** Annualised Internal Rate of Return (money-weighted return). */
  xirr?: number;
  /** Net annualised XIRR after accounting for accrued statutory capital gains tax liability. */
  postTaxXirr?: number;
  /** Simple holding period return: (currentValue - investedAmount) / investedAmount. */
  absoluteReturn?: number;
  /** Simple holding period return net of estimated tax obligations. */
  postTaxAbsoluteReturn?: number;
  /** Total estimated accrued capital gains tax liability (STCG + LTCG). */
  estimatedTax?: number;
  /** Total unrealized gain/loss: currentValue - investedAmount. */
  totalGain?: number;
  /** Latest published Net Asset Value per unit or stock share price. */
  currentPrice?: number;
  /** Compound Annual Growth Rate where applicable. */
  cagr?: number;
}

/**
 * Structural contract for an individual investment folio eligible for multi-account scheme consolidation.
 */
export interface FolioInput {
  /** Unique folio identifier in the portfolio database. */
  id: string;
  /** Folio account number as reported by the AMC or registrar (CAMS/KFintech). */
  number?: string;
  /** Alternative alias for folio account number. */
  folioNumber?: string;
  /** Permanent Account Number (PAN) of the investor holding this folio. */
  pan?: string;
  /** Underlying security or mutual fund scheme attributes. */
  asset?: FolioAssetInfo;
  /** Computed financial performance and valuation metrics. */
  metrics?: FolioMetricsInput;
  /** Historical transaction ledger for this folio. */
  transactions?: unknown[];
}

/**
 * Aggregated financial metrics for a consolidated scheme group.
 */
export interface ConsolidatedSchemeMetrics {
  /** Cumulative invested principal across all constituent folios. */
  investedAmount: number;
  /** Aggregate current market valuation across all constituent folios. */
  currentValue: number;
  /** Combined one-day market valuation fluctuation across all folios. */
  dayChange: number;
  /** Percentage change in portfolio value relative to previous day's baseline valuation. */
  dayChangePercentage: number;
  /** Value-weighted annualized XIRR across all constituent folios. */
  xirr: number;
  /** Value-weighted post-tax annualized XIRR after accrued tax liability deduction. */
  postTaxXirr: number;
  /** Aggregate simple holding period return: (currentValue - investedAmount) / investedAmount. */
  absoluteReturn: number;
  /** Aggregate post-tax simple return based on post-tax net liquidation valuation. */
  postTaxAbsoluteReturn: number;
}

/**
 * A master consolidated scheme representing multiple folios (across identical or distinct PANs)
 * merged into a unified scheme position.
 */
export interface ConsolidatedSchemeGroup {
  /** Deterministic group identifier (`group_${groupKey}` or individual folio id if single). */
  id: string;
  /** Canonical name of the scheme or equity asset. */
  schemeName: string;
  /** ISIN code shared by constituent folios (empty or undefined if not available). */
  isin?: string;
  /** AMFI code shared by constituent folios. */
  amfiCode?: string;
  /** Asset category classification (e.g., 'MUTUAL_FUND', 'EQUITY'). */
  type: string;
  /** List of distinct PANs holding folios within this consolidated scheme. */
  pans: string[];
  /** Consolidated performance, valuation, and return metrics. */
  metrics: ConsolidatedSchemeMetrics;
  /** Constituent folios grouped under this master scheme, sorted descending by current valuation. */
  folios: FolioInput[];
  /** Total count of constituent folios in this scheme group. */
  folioCount: number;
}

/**
 * Sanitizes and bounds financial return rates (XIRR or absolute return) to prevent numerical
 * anomalies or layout disruptions caused by non-finite values (NaN, Infinity) or extreme outliers.
 *
 * Clamps return rates strictly between -100% (-1.0) and +1000% (+10.0).
 *
 * @param rate - Raw numerical return rate or ratio to sanitize.
 * @param fallback - Default fallback value if the rate is non-finite or null/undefined (default: 0).
 * @returns A safe, finite return rate bounded within statutory and rendering limits.
 */
export function sanitizeReturnRate(rate: number | null | undefined, fallback: number = 0): number {
  if (rate == null || isNaN(rate) || !isFinite(rate)) {
    return fallback;
  }
  // Clamp between -100% (-1.0) and +1000% (10.0) to prevent astronomical rendering anomalies
  return Math.min(10.0, Math.max(-1.0, rate));
}

/**
 * Consolidates individual mutual fund and equity folios into unified scheme-level groups.
 *
 * ### Grouping Algorithm & Precedence
 * Folios are grouped using a hierarchical identifier:
 * 1. **ISIN (`isin_INF...`)**: Preferred grouping key. Direct and Regular mutual fund plans have
 *    distinct ISINs, ensuring plans are never improperly conflated while multiple folios under
 *    the exact same plan (even under different PANs) are cleanly consolidated.
 * 2. **AMFI Code (`amfi_...`)**: Fallback for mutual funds lacking explicit ISIN tags.
 * 3. **Normalized Asset Name (`name_...`)**: Fallback for unlisted assets, synthetic folios, or
 *    custom securities.
 *
 * ### Multi-Account & Multi-PAN Deduplication
 * Constituent folios belonging to different PANs (e.g. family members, joint folios) under the
 * same scheme are consolidated together. The unique list of PANs is captured in `pans`, and
 * constituent folios are preserved in `folios` sorted descending by current market valuation.
 *
 * ### Value-Weighted XIRR Formulation
 * When combining multiple folios into a single master scheme, an arithmetic average would distort
 * performance by giving equal weight to small or dormant folios. Instead, XIRR is aggregated using
 * positive valuation weighting:
 *
 * $$ \text{Weighted XIRR} = \sum_{i} \left( \text{XIRR}_i \times \frac{\max(0, \text{Valuation}_i)}{\sum_j \max(0, \text{Valuation}_j)} \right) $$
 *
 * If total current valuation is zero (e.g. all folios fully redeemed), the calculation falls back to
 * an unweighted arithmetic mean across constituent folios.
 *
 * ### Day Change Percentage
 * Calculated relative to the previous trading session's baseline valuation:
 * $$ \text{Previous Value} = \text{Current Value} - \text{Day Change} $$
 * $$ \text{Day Change \%} = \frac{\text{Day Change}}{\text{Previous Value}} \times 100 $$
 *
 * @param folios - Array of individual folio objects to consolidate.
 * @returns Array of consolidated scheme groups with aggregated metrics.
 */
export function consolidateFoliosIntoSchemes(
  folios: FolioInput[] | null | undefined
): ConsolidatedSchemeGroup[] {
  if (!folios || !Array.isArray(folios) || folios.length === 0) {
    return [];
  }

  const groupsMap = new Map<string, FolioInput[]>();

  for (const folio of folios) {
    // Unique key: ISIN is best for mutual funds/stocks, fallback to amfiCode or normalized name
    const isin = folio.asset?.isin;
    const amfiCode = folio.asset?.amfiCode;
    const assetName = folio.asset?.name?.trim() || 'Unknown Asset';

    // Direct and Regular plans have distinct ISINs, so ISIN groups cleanly.
    // If ISIN is missing or synthetic, use amfiCode or normalized name.
    const groupKey =
      isin && !isin.startsWith('MISSING-')
        ? `isin_${isin}`
        : amfiCode
        ? `amfi_${amfiCode}`
        : `name_${assetName.toLowerCase().replace(/\s+/g, '_')}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(folio);
  }

  const result: ConsolidatedSchemeGroup[] = [];

  for (const [groupKey, groupFolios] of groupsMap.entries()) {
    const firstFolio = groupFolios[0];
    const schemeName = firstFolio.asset?.name || 'Unknown Scheme';
    const type = firstFolio.asset?.type || 'MUTUAL_FUND';
    const isin = firstFolio.asset?.isin;
    const amfiCode = firstFolio.asset?.amfiCode;

    // Single-folio fast path: preserve existing metrics without unnecessary aggregation
    if (groupFolios.length === 1) {
      const singleFolio = groupFolios[0];
      const absoluteReturn = singleFolio.metrics?.absoluteReturn ?? 0;
      const postTaxAbsoluteReturn = singleFolio.metrics?.postTaxAbsoluteReturn ?? 0;

      result.push({
        id: singleFolio.id,
        schemeName,
        isin,
        amfiCode,
        type,
        pans: singleFolio.pan ? [singleFolio.pan] : [],
        metrics: {
          investedAmount: singleFolio.metrics?.investedAmount ?? 0,
          currentValue: singleFolio.metrics?.currentValue ?? 0,
          dayChange: singleFolio.metrics?.dayChange ?? 0,
          dayChangePercentage: singleFolio.metrics?.dayChangePercentage ?? 0,
          xirr: sanitizeReturnRate(singleFolio.metrics?.xirr, absoluteReturn),
          postTaxXirr: sanitizeReturnRate(singleFolio.metrics?.postTaxXirr, postTaxAbsoluteReturn),
          absoluteReturn,
          postTaxAbsoluteReturn,
        },
        folios: groupFolios,
        folioCount: 1,
      });
      continue;
    }

    // Aggregate metrics across multiple constituent folios of the same master scheme
    const investedAmount = groupFolios.reduce(
      (accumulated, folio) => accumulated + (folio.metrics?.investedAmount ?? 0),
      0
    );
    const currentValue = groupFolios.reduce(
      (accumulated, folio) => accumulated + (folio.metrics?.currentValue ?? 0),
      0
    );
    const dayChange = groupFolios.reduce(
      (accumulated, folio) => accumulated + (folio.metrics?.dayChange ?? 0),
      0
    );

    // Derive day change percentage from previous trading day's baseline valuation
    const previousDayValue = currentValue - dayChange;
    const dayChangePercentage =
      previousDayValue > 0 ? (dayChange / previousDayValue) * 100 : 0;
    const absoluteReturn =
      investedAmount > 0 ? (currentValue - investedAmount) / investedAmount : 0;

    // Compute value-weighted XIRR to weight constituent returns by their positive market valuation
    const totalValuationWeight = groupFolios.reduce(
      (accumulated, folio) => accumulated + Math.max(0, folio.metrics?.currentValue ?? 0),
      0
    );
    let weightedXirr = 0;
    let weightedPostTaxXirr = 0;

    if (totalValuationWeight > 0) {
      weightedXirr = groupFolios.reduce((accumulated, folio) => {
        const folioValue = Math.max(0, folio.metrics?.currentValue ?? 0);
        const folioXirr = sanitizeReturnRate(
          folio.metrics?.xirr,
          folio.metrics?.absoluteReturn ?? 0
        );
        return accumulated + folioXirr * (folioValue / totalValuationWeight);
      }, 0);

      weightedPostTaxXirr = groupFolios.reduce((accumulated, folio) => {
        const folioValue = Math.max(0, folio.metrics?.currentValue ?? 0);
        const folioPostTaxXirr = sanitizeReturnRate(
          folio.metrics?.postTaxXirr,
          folio.metrics?.postTaxAbsoluteReturn ?? 0
        );
        return accumulated + folioPostTaxXirr * (folioValue / totalValuationWeight);
      }, 0);
    } else {
      // Fallback to unweighted arithmetic mean if all folios have zero current valuation
      weightedXirr =
        groupFolios.reduce(
          (accumulated, folio) =>
            accumulated +
            sanitizeReturnRate(folio.metrics?.xirr, folio.metrics?.absoluteReturn ?? 0),
          0
        ) / groupFolios.length;

      weightedPostTaxXirr =
        groupFolios.reduce(
          (accumulated, folio) =>
            accumulated +
            sanitizeReturnRate(
              folio.metrics?.postTaxXirr,
              folio.metrics?.postTaxAbsoluteReturn ?? 0
            ),
          0
        ) / groupFolios.length;
    }

    weightedXirr = sanitizeReturnRate(weightedXirr, absoluteReturn);
    weightedPostTaxXirr = sanitizeReturnRate(weightedPostTaxXirr, 0);

    // Post-tax absolute return based on post-tax net liquidation valuation
    const totalEstimatedTax = groupFolios.reduce(
      (accumulated, folio) => accumulated + (folio.metrics?.estimatedTax ?? 0),
      0
    );
    const postTaxCurrentValue = Math.max(0, currentValue - totalEstimatedTax);
    const postTaxAbsoluteReturn =
      investedAmount > 0 ? (postTaxCurrentValue - investedAmount) / investedAmount : 0;

    // Deduplicate unique PANs across constituent folios
    const pans = Array.from(
      new Set(
        groupFolios
          .map((folio) => folio.pan)
          .filter((pan): pan is string => Boolean(pan))
      )
    );

    // Sort constituent folios descending by current valuation for clear hierarchy
    const sortedConstituents = [...groupFolios].sort(
      (first, second) =>
        (second.metrics?.currentValue ?? 0) - (first.metrics?.currentValue ?? 0)
    );

    result.push({
      id: `group_${groupKey}`,
      schemeName,
      isin,
      amfiCode,
      type,
      pans,
      metrics: {
        investedAmount,
        currentValue,
        dayChange,
        dayChangePercentage,
        xirr: weightedXirr,
        postTaxXirr: weightedPostTaxXirr,
        absoluteReturn,
        postTaxAbsoluteReturn,
      },
      folios: sortedConstituents,
      folioCount: groupFolios.length,
    });
  }

  return result;
}
