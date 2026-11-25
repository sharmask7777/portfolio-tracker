import {
  TaxSectionName,
  type TaxCalculationsResult,
  type DeemedCostParams,
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

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function resolveLeapMaturityDay(targetYear: number, month: number, day: number): number {
  if (month === 2 && day === 29) {
    return isLeapYear(targetYear) ? 29 : 28;
  }
  return day;
}

export function elssLockInExpiry(buyDate: string): string {
  const parts = buyDate.split('-');
  const y = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = parseInt(parts[2] ?? '0', 10);
  if (!y || !m || !d) return buyDate;

  const targetYear = y + 3;
  const targetDay = resolveLeapMaturityDay(targetYear, m, d);
  const mm = String(m).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function checkElssLockIn(buyDate: string, sellDate: string): boolean {
  if (!buyDate || !sellDate) return false;
  const expiry = elssLockInExpiry(buyDate);
  return sellDate < expiry;
}

export {
  getAdvanceTaxQuarter,
  classifyTaxSection,
  buildAdvanceTaxMatrix,
} from './advance-tax-service';

/**
 * Applies statutory capital loss set-off rules under Section 70 of the Income Tax Act, 1961:
 * - LTCL can ONLY set off LTCG; it cannot touch STCG or Slab.
 * - STCL (Equity STCL + Section 50AA Slab STCL) sets off Slab -> STCG -> LTCG.
 * - Taxable gains can never be negative.
 *
 * @returns [taxableStcg, taxableLtcg, taxableSlab]
 */
export function applyCapitalLossSetOffWithSlab(
  realizedStcg: number,
  realizedLtcg: number,
  realizedSlab: number
): [number, number, number] {
  let totalStcl = 0;
  let stcg = 0;
  let slabGain = 0;

  if (realizedStcg < 0) {
    totalStcl += Math.abs(realizedStcg);
  } else {
    stcg = realizedStcg;
  }

  if (realizedSlab < 0) {
    totalStcl += Math.abs(realizedSlab);
  } else {
    slabGain = realizedSlab;
  }

  const ltcl = realizedLtcg < 0 ? Math.abs(realizedLtcg) : 0;
  let ltcg = realizedLtcg > 0 ? realizedLtcg : 0;

  // 1. LTCL can ONLY set off LTCG
  const setOffLt = Math.min(ltcg, ltcl);
  ltcg -= setOffLt;

  // 2. STCL sets off Slab STCG first, then Equity STCG, then LTCG
  let remainingStcl = totalStcl;

  const setOffSlab = Math.min(slabGain, remainingStcl);
  slabGain -= setOffSlab;
  remainingStcl -= setOffSlab;

  const setOffSt = Math.min(stcg, remainingStcl);
  stcg -= setOffSt;
  remainingStcl -= setOffSt;

  const setOffStLt = Math.min(ltcg, remainingStcl);
  ltcg -= setOffStLt;

  return [stcg, ltcg, slabGain];
}

export function calculate112AExemption(
  ltcg10: number,
  ltcg12_5: number,
  fy: string = '2024-25'
): Exemption112AResult {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  // Apply Section 70 loss netting between 10% and 12.5% pools if either is negative
  let pos10 = ltcg10;
  let pos12_5 = ltcg12_5;
  if (pos10 < 0 && pos12_5 > 0) {
    pos12_5 = Math.max(0, pos12_5 + pos10);
    pos10 = 0;
  } else if (pos12_5 < 0 && pos10 > 0) {
    pos10 = Math.max(0, pos10 + pos12_5);
    pos12_5 = 0;
  } else {
    pos10 = Math.max(0, pos10);
    pos12_5 = Math.max(0, pos12_5);
  }

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

function applyBreakdownLossSetOff(acc: GainsAcc): { netLtcg10: number; netLtcg12_5: number } {
  const totalStcg = acc.stcg15 + acc.stcg20;
  const totalLtcg = acc.ltcg10 + acc.ltcg12_5;
  const totalSlab = acc.slab;
  const [taxableStcg, taxableLtcg, taxableSlab] = applyCapitalLossSetOffWithSlab(
    totalStcg,
    totalLtcg,
    totalSlab
  );

  if (totalStcg > 0 && taxableStcg < totalStcg) {
    const stcgRatio = Math.max(0, taxableStcg) / totalStcg;
    acc.stcg15Tax *= stcgRatio;
    acc.stcg20Tax *= stcgRatio;
  } else if (totalStcg <= 0) {
    acc.stcg15Tax = 0;
    acc.stcg20Tax = 0;
  }

  if (totalSlab > 0 && taxableSlab < totalSlab) {
    acc.slabTax *= Math.max(0, taxableSlab) / totalSlab;
  } else if (totalSlab <= 0) {
    acc.slabTax = 0;
  }

  if (totalLtcg <= 0) {
    return { netLtcg10: 0, netLtcg12_5: 0 };
  }
  if (taxableLtcg < totalLtcg) {
    const ratio = taxableLtcg / totalLtcg;
    return {
      netLtcg10: Math.max(0, acc.ltcg10 * ratio),
      netLtcg12_5: Math.max(0, acc.ltcg12_5 * ratio),
    };
  }
  return { netLtcg10: acc.ltcg10, netLtcg12_5: acc.ltcg12_5 };
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

  const { netLtcg10, netLtcg12_5 } = applyBreakdownLossSetOff(acc);
  const exemptionRes = calculate112AExemption(netLtcg10, netLtcg12_5, selectedFY);
  return buildBreakdownResult(acc, exemptionRes, selectedFY);
}
