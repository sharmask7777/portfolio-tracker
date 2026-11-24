import {
  calculate112AExemption,
  classifySection,
  TaxSectionName,
} from './itr-report-generator';
import type { ITRGainDetail } from './itr-report-generator';

export interface TaxCalculationsResult {
  totalEquityLTCG: number;
  totalSTCG111A: number;
  totalDebtLTCG: number;
  ltcg10Gain: number;
  ltcg12_5Gain: number;
  stcg15Gain: number;
  stcg20Gain: number;
  debtLtcg20Gain: number;
  debtLtcg12_5Gain: number;
  slabGain: number;
  ltcgLimit: number;
  ltcgExemptClaimed: number;
  ltcgTaxBeforeCess: number;
  ltcgTotalTax: number;
  stcgTotalTax: number;
  debtTotalTax: number;
  slabTaxBeforeCess: number;
  slabTotalTax: number;
  baseTaxTotal: number;
  cessTotal: number;
  grandTotalTax: number;
  ltcgUsed: number;
  ltcgPercent: number;
}

interface RawGainsAccumulator {
  stcg15Gain: number;
  stcg20Gain: number;
  ltcg10Gain: number;
  ltcg12_5Gain: number;
  debtLtcg20Gain: number;
  debtLtcg12_5Gain: number;
  slabGain: number;
  stcg15TaxBeforeCess: number;
  stcg20TaxBeforeCess: number;
  debtTaxBeforeCess: number;
  slabTaxBeforeCess: number;
}

function accumulateGain(acc: RawGainsAccumulator, g: ITRGainDetail): void {
  const section = classifySection(g);
  const tbCess = g.taxBeforeCess !== undefined ? g.taxBeforeCess : 0;

  switch (section) {
    case TaxSectionName.SEC_111A_15:
      acc.stcg15Gain += g.gain;
      acc.stcg15TaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.15;
      break;
    case TaxSectionName.SEC_111A_20:
      acc.stcg20Gain += g.gain;
      acc.stcg20TaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.20;
      break;
    case TaxSectionName.SEC_112A_10:
      acc.ltcg10Gain += g.gain;
      break;
    case TaxSectionName.SEC_112A_12_5:
      acc.ltcg12_5Gain += g.gain;
      break;
    case TaxSectionName.SEC_112_DEBT_20:
      acc.debtLtcg20Gain += g.gain;
      acc.debtTaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.20;
      break;
    case TaxSectionName.SEC_112_DEBT_12_5:
      acc.debtLtcg12_5Gain += g.gain;
      acc.debtTaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.125;
      break;
    default: {
      acc.slabGain += g.gain;
      const rate = g.taxRate ?? 0.30;
      acc.slabTaxBeforeCess += tbCess || Math.max(0, g.gain) * rate;
      break;
    }
  }
}

export function computeTaxBreakdowns(
  filteredDetails: ITRGainDetail[],
  selectedFY: string
): TaxCalculationsResult {
  const acc: RawGainsAccumulator = {
    stcg15Gain: 0,
    stcg20Gain: 0,
    ltcg10Gain: 0,
    ltcg12_5Gain: 0,
    debtLtcg20Gain: 0,
    debtLtcg12_5Gain: 0,
    slabGain: 0,
    stcg15TaxBeforeCess: 0,
    stcg20TaxBeforeCess: 0,
    debtTaxBeforeCess: 0,
    slabTaxBeforeCess: 0,
  };

  for (const g of filteredDetails) {
    accumulateGain(acc, g);
  }

  const totalEquityLTCG = acc.ltcg10Gain + acc.ltcg12_5Gain;
  const totalSTCG111A = acc.stcg15Gain + acc.stcg20Gain;
  const totalDebtLTCG = acc.debtLtcg20Gain + acc.debtLtcg12_5Gain;

  const exemptionRes = calculate112AExemption(acc.ltcg10Gain, acc.ltcg12_5Gain, selectedFY);
  const ltcgLimit = selectedFY >= '2024-25' ? 125000 : 100000;
  const ltcgExemptClaimed = exemptionRes.totalExemption;
  const ltcgTaxBeforeCess = exemptionRes.taxable10 * 0.10 + exemptionRes.taxable12_5 * 0.125;
  const ltcgTotalTax = ltcgTaxBeforeCess * 1.04;

  const stcgTotalTaxBeforeCess = acc.stcg15TaxBeforeCess + acc.stcg20TaxBeforeCess;
  const stcgTotalTax = stcgTotalTaxBeforeCess * 1.04;

  const debtTotalTax = acc.debtTaxBeforeCess * 1.04;
  const slabTotalTax = acc.slabTaxBeforeCess * 1.04;

  const baseTaxTotal =
    ltcgTaxBeforeCess + stcgTotalTaxBeforeCess + acc.debtTaxBeforeCess + acc.slabTaxBeforeCess;
  const cessTotal = baseTaxTotal * 0.04;
  const grandTotalTax = baseTaxTotal + cessTotal;

  const ltcgUsed = Math.max(0, totalEquityLTCG);
  const ltcgPercent = Math.min(100, (ltcgUsed / ltcgLimit) * 100);

  return {
    totalEquityLTCG,
    totalSTCG111A,
    totalDebtLTCG,
    ltcg10Gain: acc.ltcg10Gain,
    ltcg12_5Gain: acc.ltcg12_5Gain,
    stcg15Gain: acc.stcg15Gain,
    stcg20Gain: acc.stcg20Gain,
    debtLtcg20Gain: acc.debtLtcg20Gain,
    debtLtcg12_5Gain: acc.debtLtcg12_5Gain,
    slabGain: acc.slabGain,
    ltcgLimit,
    ltcgExemptClaimed,
    ltcgTaxBeforeCess,
    ltcgTotalTax,
    stcgTotalTax,
    debtTotalTax,
    slabTaxBeforeCess: acc.slabTaxBeforeCess,
    slabTotalTax,
    baseTaxTotal,
    cessTotal,
    grandTotalTax,
    ltcgUsed,
    ltcgPercent,
  };
}
