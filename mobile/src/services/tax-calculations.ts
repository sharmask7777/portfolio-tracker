import {
  AdvanceTaxQuarter,
  TaxSectionName,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
  type TaxCalculationsResult,
  type DeemedCostParams,
  type ClassifyTaxParams,
  type GainItemInput,
  type Exemption112AResult,
  type GainsAcc,
  type GainInputSlice,
} from './tax-types';

export function calculateSection55DeemedCost(params: DeemedCostParams): number {
  const { cost, fmv2018, sellPrice, isPre2018 } = params;
  if (!isPre2018 || fmv2018 === undefined || fmv2018 <= 0) {
    return cost;
  }
  const benchmark = Math.min(fmv2018, sellPrice);
  return Math.max(cost, benchmark);
}

export function checkElssLockIn(buyDate: string, sellDate: string): boolean {
  const buyTime = Date.parse(buyDate);
  const sellTime = Date.parse(sellDate);
  if (isNaN(buyTime) || isNaN(sellTime)) return false;
  return ((sellTime - buyTime) / (1000 * 60 * 60 * 24)) < 1095;
}

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

export function calculate112AExemption(
  ltcg10: number,
  ltcg12_5: number,
  fy: string = '2024-25'
): Exemption112AResult {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  const pos10 = Math.max(0, ltcg10);
  const pos12_5 = Math.max(0, ltcg12_5);
  const exempt10 = Math.min(pos10, statutoryLimit);
  const exempt12_5 = Math.min(pos12_5, statutoryLimit - exempt10);

  const taxable10 = Math.max(0, pos10 - exempt10);
  const taxable12_5 = Math.max(0, pos12_5 - exempt12_5);

  const tax10 = Math.round((taxable10 * 0.10 * 1.04) * 100) / 100;
  const tax12_5 = Math.round((taxable12_5 * 0.125 * 1.04) * 100) / 100;

  return {
    exempt10,
    exempt12_5,
    totalExemption: exempt10 + exempt12_5,
    taxable10,
    taxable12_5,
    tax10,
    tax12_5,
    totalTax: tax10 + tax12_5,
  };
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

function accumulateStcgGain(acc: GainsAcc, g: GainInputSlice): boolean {
  const tbCess = g.taxBeforeCess ?? 0;
  if (g.section === TaxSectionName.SEC_111A_15) {
    acc.stcg15 += g.gain;
    acc.stcg15Tax += tbCess || Math.max(0, g.gain) * 0.15;
    return true;
  }
  if (g.section === TaxSectionName.SEC_111A_20) {
    acc.stcg20 += g.gain;
    acc.stcg20Tax += tbCess || Math.max(0, g.gain) * 0.20;
    return true;
  }
  return false;
}

function accumulateLtcgGain(acc: GainsAcc, g: GainInputSlice): boolean {
  if (g.section === TaxSectionName.SEC_112A_10) {
    acc.ltcg10 += g.gain;
    return true;
  }
  if (g.section === TaxSectionName.SEC_112A_12_5) {
    acc.ltcg12_5 += g.gain;
    return true;
  }
  return false;
}

function accumulateDebtGain(acc: GainsAcc, g: GainInputSlice): boolean {
  const tbCess = g.taxBeforeCess ?? 0;
  if (g.section === TaxSectionName.SEC_112_DEBT_20) {
    acc.debtLtcg20 += g.gain;
    acc.debtTax += tbCess || Math.max(0, g.gain) * 0.20;
    return true;
  }
  if (g.section === TaxSectionName.SEC_112_DEBT_12_5) {
    acc.debtLtcg12_5 += g.gain;
    acc.debtTax += tbCess || Math.max(0, g.gain) * 0.125;
    return true;
  }
  return false;
}

function accumulateBreakdownGain(acc: GainsAcc, g: GainInputSlice): void {
  const section = g.section ?? TaxSectionName.SEC_112A_12_5;
  const enriched = { ...g, section };
  if (accumulateStcgGain(acc, enriched)) return;
  if (accumulateLtcgGain(acc, enriched)) return;
  if (accumulateDebtGain(acc, enriched)) return;

  const tbCess = g.taxBeforeCess ?? 0;
  acc.slab += g.gain;
  acc.slabTax += tbCess || Math.max(0, g.gain) * (g.taxRate ?? 0.30);
}

function buildBreakdownResult(acc: GainsAcc, exemptionRes: Exemption112AResult, selectedFY: string): TaxCalculationsResult {
  const totalEquityLTCG = acc.ltcg10 + acc.ltcg12_5;
  const ltcgLimit = selectedFY >= '2024-25' ? 125000 : 100000;
  const ltcgTaxBeforeCess = exemptionRes.taxable10 * 0.10 + exemptionRes.taxable12_5 * 0.125;
  const stcgTotalTaxBeforeCess = acc.stcg15Tax + acc.stcg20Tax;
  const baseTaxTotal = ltcgTaxBeforeCess + stcgTotalTaxBeforeCess + acc.debtTax + acc.slabTax;
  const cessTotal = baseTaxTotal * 0.04;
  const ltcgUsed = Math.max(0, totalEquityLTCG);

  return {
    totalEquityLTCG,
    totalSTCG111A: acc.stcg15 + acc.stcg20,
    totalDebtLTCG: acc.debtLtcg20 + acc.debtLtcg12_5,
    ltcg10Gain: acc.ltcg10,
    ltcg12_5Gain: acc.ltcg12_5,
    stcg15Gain: acc.stcg15,
    stcg20Gain: acc.stcg20,
    debtLtcg20Gain: acc.debtLtcg20,
    debtLtcg12_5Gain: acc.debtLtcg12_5,
    slabGain: acc.slab,
    ltcgLimit,
    ltcgExemptClaimed: exemptionRes.totalExemption,
    ltcgTaxBeforeCess,
    ltcgTotalTax: ltcgTaxBeforeCess * 1.04,
    stcgTotalTax: stcgTotalTaxBeforeCess * 1.04,
    debtTotalTax: acc.debtTax * 1.04,
    slabTaxBeforeCess: acc.slabTax,
    slabTotalTax: acc.slabTax * 1.04,
    baseTaxTotal,
    cessTotal,
    grandTotalTax: baseTaxTotal + cessTotal,
    ltcgUsed,
    ltcgPercent: Math.min(100, (ltcgUsed / ltcgLimit) * 100),
  };
}

export function computeTaxBreakdowns(
  filteredDetails: GainInputSlice[],
  selectedFY: string
): TaxCalculationsResult {
  const acc: GainsAcc = {
    stcg15: 0,
    stcg20: 0,
    ltcg10: 0,
    ltcg12_5: 0,
    debtLtcg20: 0,
    debtLtcg12_5: 0,
    slab: 0,
    stcg15Tax: 0,
    stcg20Tax: 0,
    debtTax: 0,
    slabTax: 0,
  };

  for (const g of filteredDetails) {
    accumulateBreakdownGain(acc, g);
  }

  const exemptionRes = calculate112AExemption(acc.ltcg10, acc.ltcg12_5, selectedFY);
  return buildBreakdownResult(acc, exemptionRes, selectedFY);
}
