export interface ConsolidatedSchemeGroup {
  id: string;
  schemeName: string;
  isin?: string;
  amfiCode?: string;
  type: string;
  pans: string[];
  metrics: {
    investedAmount: number;
    currentValue: number;
    dayChange: number;
    dayChangePercentage: number;
    xirr: number;
    postTaxXirr: number;
    absoluteReturn: number;
    postTaxAbsoluteReturn: number;
  };
  folios: any[];
  folioCount: number;
}

export function consolidateFoliosIntoSchemes(folios: any[]): ConsolidatedSchemeGroup[] {
  if (!folios || !Array.isArray(folios) || folios.length === 0) {
    return [];
  }

  const groupsMap = new Map<string, any[]>();

  for (const folio of folios) {
    // Unique key: ISIN is best for mutual funds/stocks, fallback to amfiCode or normalized name
    const isin = folio.asset?.isin;
    const amfiCode = folio.asset?.amfiCode;
    const name = folio.asset?.name?.trim() || 'Unknown Asset';
    
    // Direct and Regular plans have distinct ISINs, so ISIN groups cleanly.
    // If ISIN is missing or synthetic, use amfiCode or normalized name.
    const groupKey = isin && !isin.startsWith('MISSING-')
      ? `isin_${isin}`
      : amfiCode
      ? `amfi_${amfiCode}`
      : `name_${name.toLowerCase().replace(/\s+/g, '_')}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(folio);
  }

  const result: ConsolidatedSchemeGroup[] = [];

  for (const [key, groupFolios] of groupsMap.entries()) {
    const first = groupFolios[0];
    const schemeName = first.asset?.name || 'Unknown Scheme';
    const type = first.asset?.type || 'MUTUAL_FUND';
    const isin = first.asset?.isin;
    const amfiCode = first.asset?.amfiCode;

    if (groupFolios.length === 1) {
      const f = groupFolios[0];
      result.push({
        id: f.id,
        schemeName,
        isin,
        amfiCode,
        type,
        pans: f.pan ? [f.pan] : [],
        metrics: {
          investedAmount: f.metrics?.investedAmount ?? 0,
          currentValue: f.metrics?.currentValue ?? 0,
          dayChange: f.metrics?.dayChange ?? 0,
          dayChangePercentage: f.metrics?.dayChangePercentage ?? 0,
          xirr: f.metrics?.xirr ?? 0,
          postTaxXirr: f.metrics?.postTaxXirr ?? 0,
          absoluteReturn: f.metrics?.absoluteReturn ?? 0,
          postTaxAbsoluteReturn: f.metrics?.postTaxAbsoluteReturn ?? 0,
        },
        folios: groupFolios,
        folioCount: 1,
      });
      continue;
    }

    // Aggregate metrics across multiple folios of the same scheme
    const investedAmount = groupFolios.reduce((acc, f) => acc + (f.metrics?.investedAmount ?? 0), 0);
    const currentValue = groupFolios.reduce((acc, f) => acc + (f.metrics?.currentValue ?? 0), 0);
    const dayChange = groupFolios.reduce((acc, f) => acc + (f.metrics?.dayChange ?? 0), 0);
    
    const prevValue = currentValue - dayChange;
    const dayChangePercentage = prevValue > 0 ? (dayChange / prevValue) * 100 : 0;
    const absoluteReturn = investedAmount > 0 ? (currentValue - investedAmount) / investedAmount : 0;

    // Value-weighted XIRR
    const totalValWeight = groupFolios.reduce((acc, f) => acc + Math.max(0, f.metrics?.currentValue ?? 0), 0);
    let weightedXirr = 0;
    let weightedPostTaxXirr = 0;

    if (totalValWeight > 0) {
      weightedXirr = groupFolios.reduce((acc, f) => {
        const val = Math.max(0, f.metrics?.currentValue ?? 0);
        return acc + (f.metrics?.xirr ?? 0) * (val / totalValWeight);
      }, 0);
      weightedPostTaxXirr = groupFolios.reduce((acc, f) => {
        const val = Math.max(0, f.metrics?.currentValue ?? 0);
        return acc + (f.metrics?.postTaxXirr ?? 0) * (val / totalValWeight);
      }, 0);
    } else {
      weightedXirr = groupFolios.reduce((acc, f) => acc + (f.metrics?.xirr ?? 0), 0) / groupFolios.length;
      weightedPostTaxXirr = groupFolios.reduce((acc, f) => acc + (f.metrics?.postTaxXirr ?? 0), 0) / groupFolios.length;
    }

    // Post-tax absolute return based on post-tax current value
    const totalEstimatedTax = groupFolios.reduce((acc, f) => acc + (f.metrics?.estimatedTax ?? 0), 0);
    const postTaxCurrentValue = Math.max(0, currentValue - totalEstimatedTax);
    const postTaxAbsoluteReturn = investedAmount > 0 ? (postTaxCurrentValue - investedAmount) / investedAmount : 0;

    // Unique PANs
    const pans = Array.from(new Set(groupFolios.map(f => f.pan).filter(Boolean))) as string[];

    // Sort constituent folios descending by current value
    const sortedConstituents = [...groupFolios].sort((a, b) => (b.metrics?.currentValue ?? 0) - (a.metrics?.currentValue ?? 0));

    result.push({
      id: `group_${key}`,
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
