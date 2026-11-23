import {
  AdvanceTaxQuarter,
  TaxSectionName,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
  type ClassifyTaxParams,
  type GainItemInput,
} from './tax-types';

function parseMonthAndDay(dateInput: Date | string): { month: number; day: number } | null {
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return { month: parseInt(match[2] ?? '0', 10), day: parseInt(match[3] ?? '0', 10) };
    }
  }
  const dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) return null;
  return { month: dateObj.getMonth() + 1, day: dateObj.getDate() };
}

const QUARTER_RANGES: Array<{ min: number; max: number; quarter: AdvanceTaxQuarter }> = [
  { min: 401, max: 615, quarter: AdvanceTaxQuarter.Q1 },
  { min: 616, max: 722, quarter: AdvanceTaxQuarter.Q2A },
  { min: 723, max: 915, quarter: AdvanceTaxQuarter.Q2B },
  { min: 916, max: 1215, quarter: AdvanceTaxQuarter.Q3 },
  { min: 1216, max: 1231, quarter: AdvanceTaxQuarter.Q4 },
  { min: 101, max: 315, quarter: AdvanceTaxQuarter.Q4 },
  { min: 316, max: 331, quarter: AdvanceTaxQuarter.Q5 },
];

export function getAdvanceTaxQuarter(dateInput: Date | string): AdvanceTaxQuarter {
  const parsed = parseMonthAndDay(dateInput);
  if (!parsed) return AdvanceTaxQuarter.Q1;
  const code = parsed.month * 100 + parsed.day;
  for (const r of QUARTER_RANGES) {
    if (code >= r.min && code <= r.max) return r.quarter;
  }
  return AdvanceTaxQuarter.Q5;
}

function classifyStcgSection(taxRate?: number, isPostBudget = false): TaxSectionName {
  if (taxRate === 0.20 || (taxRate === undefined && isPostBudget)) {
    return TaxSectionName.SEC_111A_20;
  }
  return TaxSectionName.SEC_111A_15;
}

function classifyLtcgSection(params: ClassifyTaxParams, isPostBudget: boolean): TaxSectionName {
  const isDebt = params.assetClass === 'DEBT' || (params.taxRate === 0.20 && params.isGrandfathered);
  if (isDebt) {
    return params.taxRate === 0.20 ? TaxSectionName.SEC_112_DEBT_20 : TaxSectionName.SEC_112_DEBT_12_5;
  }
  if (params.taxRate === 0.125 || (!params.isGrandfathered && isPostBudget)) {
    return TaxSectionName.SEC_112A_12_5;
  }
  return TaxSectionName.SEC_112A_10;
}

export function classifyTaxSection(params: ClassifyTaxParams): TaxSectionName {
  const isPostBudget = params.sellDate !== undefined && String(params.sellDate) >= '2024-07-23';
  if (params.taxType === 'STCG') {
    return classifyStcgSection(params.taxRate, isPostBudget);
  }
  if (params.taxType === 'LTCG') {
    return classifyLtcgSection(params, isPostBudget);
  }
  if (params.taxType === 'SLAB') {
    return TaxSectionName.SEC_50AA;
  }
  return TaxSectionName.SLAB;
}

function initQuarterData(): TableFQuarterData {
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

function addSectionGain(data: TableFQuarterData, section: TaxSectionName, gain: number): void {
  if (section === TaxSectionName.SEC_111A_15) data.stcg15 += gain;
  else if (section === TaxSectionName.SEC_111A_20) data.stcg20 += gain;
  else if (section === TaxSectionName.SEC_112A_10) data.ltcg10 += gain;
  else if (section === TaxSectionName.SEC_112A_12_5) data.ltcg12_5 += gain;
  else if (section === TaxSectionName.SEC_112_DEBT_12_5) data.debtLtcg12_5 += gain;
  else if (section === TaxSectionName.SEC_112_DEBT_20) data.debtLtcg20 += gain;
  else data.slab += gain;
}

export function buildAdvanceTaxMatrix(details: GainItemInput[]): AdvanceTaxAccrualMatrix {
  const quarters: Record<AdvanceTaxQuarter, TableFQuarterData> = {
    [AdvanceTaxQuarter.Q1]: initQuarterData(),
    [AdvanceTaxQuarter.Q2A]: initQuarterData(),
    [AdvanceTaxQuarter.Q2B]: initQuarterData(),
    [AdvanceTaxQuarter.Q3]: initQuarterData(),
    [AdvanceTaxQuarter.Q4]: initQuarterData(),
    [AdvanceTaxQuarter.Q5]: initQuarterData(),
  };

  const quarterTotals: Record<AdvanceTaxQuarter, number> = {
    [AdvanceTaxQuarter.Q1]: 0,
    [AdvanceTaxQuarter.Q2A]: 0,
    [AdvanceTaxQuarter.Q2B]: 0,
    [AdvanceTaxQuarter.Q3]: 0,
    [AdvanceTaxQuarter.Q4]: 0,
    [AdvanceTaxQuarter.Q5]: 0,
  };

  for (const item of details) {
    const quarter = (item.advanceTaxQuarter as AdvanceTaxQuarter) ||
      (item.sellDate ? getAdvanceTaxQuarter(item.sellDate) : AdvanceTaxQuarter.Q1);
    const data = quarters[quarter];
    if (!data) continue;

    const section = (item.section as TaxSectionName) || classifyTaxSection({
      taxType: item.taxType ?? 'STCG',
      assetClass: item.assetClass,
      taxRate: item.taxRate,
      isGrandfathered: item.isGrandfathered,
      sellDate: item.sellDate,
    });

    addSectionGain(data, section, item.gain);
    const tbCess = item.taxBeforeCess ?? 0;
    const cess = item.cess ?? tbCess * 0.04;
    const estimated = item.estimatedTax ?? tbCess + cess;

    data.totalGain += item.gain;
    data.taxBeforeCess += tbCess;
    data.cess += cess;
    data.estimatedTax += estimated;
    quarterTotals[quarter] += estimated;
  }

  return { quarters, quarterTotals };
}
