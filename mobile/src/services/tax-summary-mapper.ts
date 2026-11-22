import {
  AdvanceTaxQuarter,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
  type TaxCalculationsResult,
} from './tax-types';

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function parseQuarterData(raw: Record<string, unknown> | undefined): TableFQuarterData {
  if (!raw) {
    return {
      stcg15: 0,
      stcg20: 0,
      ltcg10: 0,
      ltcg12_5: 0,
      debtLtcg12_5: 0,
      debtLtcg20: 0,
      slab: 0,
      totalGain: 0,
      taxBeforeCess: 0,
      cess: 0,
      estimatedTax: 0,
    };
  }

  return {
    stcg15: parseNum(raw['stcg15']),
    stcg20: parseNum(raw['stcg20']),
    ltcg10: parseNum(raw['ltcg10']),
    ltcg12_5: parseNum(raw['ltcg125'] ?? raw['ltcg12_5']),
    debtLtcg12_5: parseNum(raw['debtLtcg125'] ?? raw['debtLtcg12_5']),
    debtLtcg20: parseNum(raw['debtLtcg20']),
    slab: parseNum(raw['slab']),
    totalGain: parseNum(raw['totalGain']),
    taxBeforeCess: parseNum(raw['taxBeforeCess']),
    cess: parseNum(raw['cess']),
    estimatedTax: parseNum(raw['estimatedTax']),
  };
}

/**
 * Maps server-returned Table F payload into strongly-typed {@link AdvanceTaxAccrualMatrix}.
 */
export function mapServerTableFToMatrix(
  tableF: Record<string, unknown> | undefined,
): AdvanceTaxAccrualMatrix {
  const quartersMap: Record<AdvanceTaxQuarter, TableFQuarterData> = {
    [AdvanceTaxQuarter.Q1]: parseQuarterData(undefined),
    [AdvanceTaxQuarter.Q2A]: parseQuarterData(undefined),
    [AdvanceTaxQuarter.Q2B]: parseQuarterData(undefined),
    [AdvanceTaxQuarter.Q3]: parseQuarterData(undefined),
    [AdvanceTaxQuarter.Q4]: parseQuarterData(undefined),
    [AdvanceTaxQuarter.Q5]: parseQuarterData(undefined),
  };

  const totalsMap: Record<AdvanceTaxQuarter, number> = {
    [AdvanceTaxQuarter.Q1]: 0,
    [AdvanceTaxQuarter.Q2A]: 0,
    [AdvanceTaxQuarter.Q2B]: 0,
    [AdvanceTaxQuarter.Q3]: 0,
    [AdvanceTaxQuarter.Q4]: 0,
    [AdvanceTaxQuarter.Q5]: 0,
  };

  if (!tableF) return { quarters: quartersMap, quarterTotals: totalsMap };

  const rawQuarters = tableF['quarters'] as Record<string, Record<string, unknown>> | undefined;
  const rawTotals = tableF['quarterTotals'] as Record<string, unknown> | undefined;

  for (const qKey of Object.values(AdvanceTaxQuarter)) {
    if (rawQuarters && rawQuarters[qKey]) {
      quartersMap[qKey] = parseQuarterData(rawQuarters[qKey]);
    }
    if (rawTotals && rawTotals[qKey] !== undefined) {
      totalsMap[qKey] = parseNum(rawTotals[qKey]);
    } else {
      totalsMap[qKey] = quartersMap[qKey].estimatedTax;
    }
  }

  return { quarters: quartersMap, quarterTotals: totalsMap };
}

interface ExtractedTotals {
  ltcg10Gain: number;
  ltcg12_5Gain: number;
  stcg15Gain: number;
  stcg20Gain: number;
  debtLtcg20Gain: number;
  debtLtcg12_5Gain: number;
  slabGain: number;
  ltcgTotalTax: number;
  stcgTotalTax: number;
  debtTotalTax: number;
  slabTotalTax: number;
  baseTaxTotal: number;
}

function extractSectionTotals(secTotals: Record<string, Record<string, unknown>>): ExtractedTotals {
  const ltcg10Sec = secTotals['112A (10%)'] ?? {};
  const ltcg125Sec = secTotals['112A (12.5%)'] ?? {};
  const stcg15Sec = secTotals['111A (15%)'] ?? {};
  const stcg20Sec = secTotals['111A (20%)'] ?? {};
  const debt20Sec = secTotals['112 Debt (20% Indexed)'] ?? {};
  const debt125Sec = secTotals['112 Debt (12.5%)'] ?? {};
  const slabSec = secTotals['50AA (Slab)'] ?? {};

  const ltcgTotalTax = parseNum(ltcg10Sec['totalTax']) + parseNum(ltcg125Sec['totalTax']);
  const stcgTotalTax = parseNum(stcg15Sec['totalTax']) + parseNum(stcg20Sec['totalTax']);
  const debtTotalTax = parseNum(debt20Sec['totalTax']) + parseNum(debt125Sec['totalTax']);
  const slabTotalTax = parseNum(slabSec['totalTax']);

  const baseTaxTotal = parseNum(ltcg10Sec['taxBeforeCess']) +
    parseNum(ltcg125Sec['taxBeforeCess']) +
    parseNum(stcg15Sec['taxBeforeCess']) +
    parseNum(stcg20Sec['taxBeforeCess']) +
    parseNum(debt20Sec['taxBeforeCess']) +
    parseNum(debt125Sec['taxBeforeCess']) +
    parseNum(slabSec['taxBeforeCess']);

  return {
    ltcg10Gain: parseNum(ltcg10Sec['totalGain']),
    ltcg12_5Gain: parseNum(ltcg125Sec['totalGain']),
    stcg15Gain: parseNum(stcg15Sec['totalGain']),
    stcg20Gain: parseNum(stcg20Sec['totalGain']),
    debtLtcg20Gain: parseNum(debt20Sec['totalGain']),
    debtLtcg12_5Gain: parseNum(debt125Sec['totalGain']),
    slabGain: parseNum(slabSec['totalGain']),
    ltcgTotalTax,
    stcgTotalTax,
    debtTotalTax,
    slabTotalTax,
    baseTaxTotal,
  };
}

/**
 * Extracts and maps server tax summary payload into {@link TaxCalculationsResult}.
 */
export function mapServerSummaryToResult(
  serverSummary: Record<string, unknown>,
  selectedFY: string,
): TaxCalculationsResult {
  const secTotals = (serverSummary['sectionTotals'] ?? {}) as Record<string, Record<string, unknown>>;
  const totals = extractSectionTotals(secTotals);

  const ltcgLimit = selectedFY === '2024-25' ? 125000 : 100000;
  const totalEquityLTCG = totals.ltcg10Gain + totals.ltcg12_5Gain;
  const totalDebtLTCG = totals.debtLtcg20Gain + totals.debtLtcg12_5Gain;
  const ltcgExemptClaimed = Math.min(totalEquityLTCG, ltcgLimit);
  const grandTotalTax = totals.ltcgTotalTax + totals.stcgTotalTax + totals.debtTotalTax + totals.slabTotalTax;
  const cessTotal = grandTotalTax - totals.baseTaxTotal;

  return {
    totalEquityLTCG,
    totalSTCG111A: totals.stcg15Gain + totals.stcg20Gain,
    totalDebtLTCG,
    ltcg10Gain: totals.ltcg10Gain,
    ltcg12_5Gain: totals.ltcg12_5Gain,
    stcg15Gain: totals.stcg15Gain,
    stcg20Gain: totals.stcg20Gain,
    debtLtcg20Gain: totals.debtLtcg20Gain,
    debtLtcg12_5Gain: totals.debtLtcg12_5Gain,
    slabGain: totals.slabGain,
    ltcgLimit,
    ltcgExemptClaimed,
    ltcgTaxBeforeCess: totals.ltcgTotalTax / 1.04,
    ltcgTotalTax: totals.ltcgTotalTax,
    stcgTotalTax: totals.stcgTotalTax,
    debtTotalTax: totals.debtTotalTax,
    slabTaxBeforeCess: totals.slabTotalTax / 1.04,
    slabTotalTax: totals.slabTotalTax,
    baseTaxTotal: totals.baseTaxTotal,
    cessTotal: Math.max(0, cessTotal),
    grandTotalTax,
    ltcgUsed: ltcgExemptClaimed,
    ltcgPercent: Math.min(100, (ltcgExemptClaimed / ltcgLimit) * 100),
  };
}
