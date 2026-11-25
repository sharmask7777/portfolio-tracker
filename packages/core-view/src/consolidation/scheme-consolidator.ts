/**
 * @file scheme-consolidator.ts
 * @description Logic for consolidating individual folios into master scheme groups with weighted returns.
 */

import { sanitizeReturnRate } from '../formatters/returns';
import type {
  FolioInput,
  ConsolidatedSchemeGroup,
  ConsolidatedMetrics,
  FolioMetricsInput,
} from './types';

export * from './types';
export * from './sorting';

/**
 * Computes a unique group identifier for an individual folio based on ISIN, AMFI code, or normalized name.
 *
 * @param folio - Individual folio input.
 * @returns Group string key.
 */
export function computeGroupKey(folio: FolioInput): string {
  const isin = folio.asset?.isin;
  const amfiCode = folio.asset?.amfiCode;
  const assetName = folio.asset?.name?.trim() || 'Unknown Asset';

  if (isin && !isin.startsWith('MISSING-')) {
    return `isin_${isin}`;
  }
  if (amfiCode) {
    return `amfi_${amfiCode}`;
  }
  return `name_${assetName.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Groups an array of individual folios by their scheme group key.
 *
 * @param folios - Folio inputs.
 * @returns Map of group key to array of folios.
 */
export function groupFoliosByKey(folios: readonly FolioInput[]): Map<string, FolioInput[]> {
  const groupsMap = new Map<string, FolioInput[]>();
  for (const folio of folios) {
    const key = computeGroupKey(folio);
    const existing = groupsMap.get(key);
    if (existing) {
      existing.push(folio);
    } else {
      groupsMap.set(key, [folio]);
    }
  }
  return groupsMap;
}

/**
 * Extracts consolidated metrics for a single folio.
 *
 * @param m - Folio metrics input.
 * @returns ConsolidatedMetrics object.
 */
function extractSingleFolioMetrics(m: FolioMetricsInput = {}): ConsolidatedMetrics {
  const absoluteReturn = m.absoluteReturn ?? 0;
  const postTaxAbsoluteReturn = m.postTaxAbsoluteReturn ?? 0;
  const currentValue = m.currentValue ?? 0;
  const estimatedTax = m.estimatedTax ?? 0;

  return {
    investedAmount: m.investedAmount ?? 0,
    currentValue,
    dayChange: m.dayChange ?? 0,
    dayChangePercentage: m.dayChangePercentage ?? 0,
    xirr: sanitizeReturnRate(m.xirr, absoluteReturn),
    postTaxXirr: sanitizeReturnRate(m.postTaxXirr, postTaxAbsoluteReturn),
    absoluteReturn,
    postTaxAbsoluteReturn,
    estimatedTax,
    netRealizableValue: Math.max(0, currentValue - estimatedTax),
  };
}

/**
 * Builds a ConsolidatedSchemeGroup for a single folio.
 */
function buildSingleFolioGroup(
  folio: FolioInput,
  groupFolios: FolioInput[]
): ConsolidatedSchemeGroup {
  return {
    id: folio.id,
    schemeName: folio.asset?.name || 'Unknown Scheme',
    isin: folio.asset?.isin,
    amfiCode: folio.asset?.amfiCode,
    type: folio.asset?.type || 'MUTUAL_FUND',
    pans: folio.pan ? [folio.pan] : [],
    metrics: extractSingleFolioMetrics(folio.metrics),
    folios: groupFolios,
    folioCount: 1,
  };
}

/**
 * Calculates weighted XIRR or average XIRR across a group of folios.
 */
function calculateWeightedXirr(
  groupFolios: readonly FolioInput[],
  totalWeight: number,
  isPostTax: boolean
): number {
  if (totalWeight > 0) {
    return groupFolios.reduce((accumulated, folio) => {
      const folioValue = Math.max(0, folio.metrics?.currentValue ?? 0);
      const rawRate = isPostTax ? folio.metrics?.postTaxXirr : folio.metrics?.xirr;
      const fallback = isPostTax
        ? (folio.metrics?.postTaxAbsoluteReturn ?? 0)
        : (folio.metrics?.absoluteReturn ?? 0);
      const folioXirr = sanitizeReturnRate(rawRate, fallback);
      return accumulated + folioXirr * (folioValue / totalWeight);
    }, 0);
  }

  return (
    groupFolios.reduce((accumulated, folio) => {
      const rawRate = isPostTax ? folio.metrics?.postTaxXirr : folio.metrics?.xirr;
      const fallback = isPostTax
        ? (folio.metrics?.postTaxAbsoluteReturn ?? 0)
        : (folio.metrics?.absoluteReturn ?? 0);
      return accumulated + sanitizeReturnRate(rawRate, fallback);
    }, 0) / groupFolios.length
  );
}

/**
 * Aggregates consolidated financial metrics across multiple folios.
 */
function aggregateGroupMetrics(groupFolios: readonly FolioInput[]): ConsolidatedMetrics {
  const investedAmount = groupFolios.reduce(
    (acc, f) => acc + (f.metrics?.investedAmount ?? 0),
    0
  );
  const currentValue = groupFolios.reduce(
    (acc, f) => acc + (f.metrics?.currentValue ?? 0),
    0
  );
  const dayChange = groupFolios.reduce(
    (acc, f) => acc + (f.metrics?.dayChange ?? 0),
    0
  );
  const totalEstimatedTax = groupFolios.reduce(
    (acc, f) => acc + (f.metrics?.estimatedTax ?? 0),
    0
  );

  const previousDayValue = currentValue - dayChange;
  const dayChangePercentage = previousDayValue > 0 ? (dayChange / previousDayValue) * 100 : 0;
  const absoluteReturn = investedAmount > 0 ? (currentValue - investedAmount) / investedAmount : 0;

  const totalValuationWeight = groupFolios.reduce(
    (acc, f) => acc + Math.max(0, f.metrics?.currentValue ?? 0),
    0
  );

  const postTaxCurrentValue = Math.max(0, currentValue - totalEstimatedTax);
  const postTaxAbsoluteReturn =
    investedAmount > 0 ? (postTaxCurrentValue - investedAmount) / investedAmount : 0;

  const weightedXirr = sanitizeReturnRate(
    calculateWeightedXirr(groupFolios, totalValuationWeight, false),
    absoluteReturn
  );
  const weightedPostTaxXirr = sanitizeReturnRate(
    calculateWeightedXirr(groupFolios, totalValuationWeight, true),
    postTaxAbsoluteReturn
  );

  return {
    investedAmount,
    currentValue,
    dayChange,
    dayChangePercentage,
    xirr: weightedXirr,
    postTaxXirr: weightedPostTaxXirr,
    absoluteReturn,
    postTaxAbsoluteReturn,
    estimatedTax: totalEstimatedTax,
    netRealizableValue: postTaxCurrentValue,
  };
}

/**
 * Builds a ConsolidatedSchemeGroup for a multi-folio scheme.
 */
function buildMultiFolioGroup(
  groupKey: string,
  groupFolios: FolioInput[]
): ConsolidatedSchemeGroup {
  const firstFolio = groupFolios[0];
  if (!firstFolio) {
    throw new Error('Cannot build multi-folio group from empty folios');
  }
  const schemeName = firstFolio.asset?.name || 'Unknown Scheme';
  const type = firstFolio.asset?.type || 'MUTUAL_FUND';
  const metrics = aggregateGroupMetrics(groupFolios);

  const pans = Array.from(
    new Set(groupFolios.map((f) => f.pan).filter((pan): pan is string => Boolean(pan)))
  );

  const sortedConstituents = [...groupFolios].sort(
    (a, b) => (b.metrics?.currentValue ?? 0) - (a.metrics?.currentValue ?? 0)
  );

  return {
    id: `group_${groupKey}`,
    schemeName,
    isin: firstFolio.asset?.isin,
    amfiCode: firstFolio.asset?.amfiCode,
    type,
    pans,
    metrics,
    folios: sortedConstituents,
    folioCount: groupFolios.length,
  };
}

/**
 * Consolidates an array of individual portfolio folios into distinct master schemes.
 *
 * @param folios - Array of individual folio objects to consolidate.
 * @returns Array of consolidated scheme groups with aggregated metrics.
 */
export function consolidateFoliosIntoSchemes(
  folios: readonly FolioInput[] | null | undefined
): ConsolidatedSchemeGroup[] {
  if (!folios || !Array.isArray(folios) || folios.length === 0) {
    return [];
  }

  const groupsMap = groupFoliosByKey(folios);
  const result: ConsolidatedSchemeGroup[] = [];

  for (const [groupKey, groupFolios] of groupsMap.entries()) {
    const firstFolio = groupFolios[0];
    if (!firstFolio) continue;

    if (groupFolios.length === 1) {
      result.push(buildSingleFolioGroup(firstFolio, groupFolios));
    } else {
      result.push(buildMultiFolioGroup(groupKey, groupFolios));
    }
  }

  return result;
}
