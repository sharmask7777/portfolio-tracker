import type {
  FolioInput,
  ConsolidatedSchemeGroup,
  ConsolidatedMetrics,
  FolioMetricsInput,
} from './consolidation-types';

export * from './consolidation-types';

export function sanitizeReturnRate(
  rate: number | null | undefined,
  fallback: number = 0
): number {
  if (rate === null || rate === undefined || isNaN(rate) || !isFinite(rate)) {
    return fallback;
  }
  return Math.min(10.0, Math.max(-1.0, rate));
}

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

export function groupFoliosByKey(folios: FolioInput[]): Map<string, FolioInput[]> {
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

function getFolioXirr(folio: FolioInput, isPostTax: boolean): number {
  const m = folio.metrics;
  const rawRate = isPostTax ? m?.postTaxXirr : m?.xirr;
  const fallback = isPostTax ? (m?.postTaxAbsoluteReturn ?? 0) : (m?.absoluteReturn ?? 0);
  return sanitizeReturnRate(rawRate, fallback);
}

function calculateWeightedXirr(
  groupFolios: FolioInput[],
  totalWeight: number,
  isPostTax: boolean
): number {
  if (totalWeight > 0) {
    return groupFolios.reduce((accumulated, folio) => {
      const folioValue = Math.max(0, folio.metrics?.currentValue ?? 0);
      const folioXirr = getFolioXirr(folio, isPostTax);
      return accumulated + folioXirr * (folioValue / totalWeight);
    }, 0);
  }

  return (
    groupFolios.reduce((accumulated, folio) => {
      return accumulated + getFolioXirr(folio, isPostTax);
    }, 0) / groupFolios.length
  );
}

function aggregateGroupMetrics(groupFolios: FolioInput[]): ConsolidatedMetrics {
  const investedAmount = groupFolios.reduce((acc, f) => acc + (f.metrics?.investedAmount ?? 0), 0);
  const currentValue = groupFolios.reduce((acc, f) => acc + (f.metrics?.currentValue ?? 0), 0);
  const dayChange = groupFolios.reduce((acc, f) => acc + (f.metrics?.dayChange ?? 0), 0);
  const totalEstimatedTax = groupFolios.reduce((acc, f) => acc + (f.metrics?.estimatedTax ?? 0), 0);

  const previousDayValue = currentValue - dayChange;
  const dayChangePercentage = previousDayValue > 0 ? (dayChange / previousDayValue) * 100 : 0;
  const absoluteReturn = investedAmount > 0 ? (currentValue - investedAmount) / investedAmount : 0;

  const totalValuationWeight = groupFolios.reduce((acc, f) => acc + Math.max(0, f.metrics?.currentValue ?? 0), 0);

  const weightedXirr = sanitizeReturnRate(calculateWeightedXirr(groupFolios, totalValuationWeight, false), absoluteReturn);
  const weightedPostTaxXirr = sanitizeReturnRate(calculateWeightedXirr(groupFolios, totalValuationWeight, true), 0);

  const postTaxCurrentValue = Math.max(0, currentValue - totalEstimatedTax);
  const postTaxAbsoluteReturn = investedAmount > 0 ? (postTaxCurrentValue - investedAmount) / investedAmount : 0;

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

function buildMultiFolioGroup(
  groupKey: string,
  groupFolios: FolioInput[]
): ConsolidatedSchemeGroup {
  const firstFolio = groupFolios[0]!;
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

export function consolidateFoliosIntoSchemes(
  folios: FolioInput[] | null | undefined
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
