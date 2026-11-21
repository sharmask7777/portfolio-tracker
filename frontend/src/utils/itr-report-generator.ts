/**
 * @file itr-report-generator.ts
 * @module utils/itr-report-generator
 * @description Generates audit-ready, statutory Capital Gains Tax reports for Indian Income Tax
 * filings (ITR-2 and ITR-3 Schedule CG) and Advance Tax liability computation (Section 234C Table F).
 */

import {
  AdvanceTaxQuarter,
  TaxSectionName,
  type AdvanceTaxAccrualMatrix,
  type ITRGainDetail,
  type ITRSummary,
  type ITRReportParams,
  type ITRVerificationTarget,
} from './itr-report-types';
import { verifyItrInvariants } from './itr-invariants';
import {
  buildHeaderSummary,
  buildMatrixRows,
  CSV_TABLE_HEADER,
  formatGainRow,
} from './itr-csv-exporter';

// Re-export public types and utilities for full contract parity
export { AdvanceTaxQuarter, TaxSectionName, verifyItrInvariants };
export type {
  AdvanceTaxAccrualMatrix,
  ITRGainDetail,
  ITRSummary,
  ITRReportParams,
  ITRVerificationTarget,
};

/**
 * Computes the official Assessment Year (AY) string corresponding to a Financial Year (FY).
 */
export function computeAY(fy: string): string {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const ayStartYear = startYear + 1;
  const ayEndYear = (startYear + 2).toString().slice(-2);
  return `${ayStartYear}-${ayEndYear}`;
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

function isQ1Date(month: number, day: number): boolean {
  return (month === 4 || month === 5 || (month === 6 && day <= 15));
}

function isQ2aDate(month: number, day: number): boolean {
  return ((month === 6 && day >= 16) || (month === 7 && day <= 22));
}

function isQ2bDate(month: number, day: number): boolean {
  return ((month === 7 && day >= 23) || month === 8 || (month === 9 && day <= 15));
}

function isQ3Date(month: number, day: number): boolean {
  return ((month === 9 && day >= 16) || month === 10 || month === 11 || (month === 12 && day <= 15));
}

function isQ4Date(month: number, day: number): boolean {
  return ((month === 12 && day >= 16) || month === 1 || month === 2 || (month === 3 && day <= 15));
}

function resolveQuarterFromMonthDay(month: number, day: number): AdvanceTaxQuarter {
  if (isQ1Date(month, day)) return AdvanceTaxQuarter.Q1;
  if (isQ2aDate(month, day)) return AdvanceTaxQuarter.Q2A;
  if (isQ2bDate(month, day)) return AdvanceTaxQuarter.Q2B;
  if (isQ3Date(month, day)) return AdvanceTaxQuarter.Q3;
  if (isQ4Date(month, day)) return AdvanceTaxQuarter.Q4;
  return AdvanceTaxQuarter.Q5;
}

/**
 * Determines the statutory Advance Tax quarter under Section 234C / Schedule CG Table F
 * based on the sale or redemption date.
 */
export function getAdvanceTaxQuarter(dateInput: Date | string): AdvanceTaxQuarter {
  const parsed = parseMonthAndDay(dateInput);
  if (!parsed) return AdvanceTaxQuarter.Q1;
  return resolveQuarterFromMonthDay(parsed.month, parsed.day);
}

/**
 * Sequentially allocates the statutory Section 112A LTCG annual exemption.
 */
export function calculate112AExemption(
  ltcg10: number,
  ltcg12_5: number,
  fy: string = '2024-25'
): {
  exempt10: number;
  exempt12_5: number;
  totalExemption: number;
  taxable10: number;
  taxable12_5: number;
  tax10: number;
  tax12_5: number;
  totalTax: number;
} {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  const positiveLtcg10 = Math.max(0, ltcg10);
  const positiveLtcg12_5 = Math.max(0, ltcg12_5);

  const exempt10 = Math.min(positiveLtcg10, statutoryLimit);
  const remainingExemption = statutoryLimit - exempt10;
  const exempt12_5 = Math.min(positiveLtcg12_5, remainingExemption);

  const taxable10 = Math.max(0, positiveLtcg10 - exempt10);
  const taxable12_5 = Math.max(0, positiveLtcg12_5 - exempt12_5);

  const tax10BeforeCess = taxable10 * 0.10;
  const tax12_5BeforeCess = taxable12_5 * 0.125;

  const tax10 = tax10BeforeCess + tax10BeforeCess * 0.04;
  const tax12_5 = tax12_5BeforeCess + tax12_5BeforeCess * 0.04;

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

function isPostBudgetSell(sellDate: Date | string | undefined): boolean {
  if (!sellDate) return false;
  return String(sellDate) >= '2024-07-23';
}

/**
 * Classifies an individual realized capital gain lot into its exact statutory Income Tax Section.
 */
export function classifySection(gainItem: Partial<ITRGainDetail>): string {
  if (gainItem.section) return gainItem.section;

  const { taxType, assetClass, taxRate, isGrandfathered, sellDate } = gainItem;
  const isPostBudget = isPostBudgetSell(sellDate);

  if (taxType === 'STCG') {
    if (taxRate === 0.20 || (!taxRate && isPostBudget)) {
      return TaxSectionName.SEC_111A_20;
    }
    return TaxSectionName.SEC_111A_15;
  }

  if (taxType === 'LTCG') {
    const isDebt = assetClass === 'DEBT' || (taxRate === 0.20 && isGrandfathered);
    if (isDebt) {
      return taxRate === 0.20 ? TaxSectionName.SEC_112_DEBT_20 : TaxSectionName.SEC_112_DEBT_12_5;
    }
    if (taxRate === 0.125 || (!isGrandfathered && isPostBudget)) {
      return TaxSectionName.SEC_112A_12_5;
    }
    return TaxSectionName.SEC_112A_10;
  }

  if (taxType === 'SLAB') {
    return TaxSectionName.SEC_50AA;
  }

  return TaxSectionName.SLAB;
}

function initEmptyQuarterData() {
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

function addGainToQuarter(data: ReturnType<typeof initEmptyQuarterData>, section: string, gain: number): void {
  switch (section) {
    case TaxSectionName.SEC_111A_15:
      data.stcg15 += gain;
      break;
    case TaxSectionName.SEC_111A_20:
      data.stcg20 += gain;
      break;
    case TaxSectionName.SEC_112A_10:
      data.ltcg10 += gain;
      break;
    case TaxSectionName.SEC_112A_12_5:
      data.ltcg12_5 += gain;
      break;
    case TaxSectionName.SEC_112_DEBT_12_5:
      data.debtLtcg12_5 += gain;
      break;
    case TaxSectionName.SEC_112_DEBT_20:
      data.debtLtcg20 += gain;
      break;
    default:
      data.slab += gain;
      break;
  }
}

/**
 * Aggregates individual realized capital gain audit lots into the 6-quarter Schedule CG Table F matrix.
 */
export function buildAdvanceTaxMatrix(details: Partial<ITRGainDetail>[]): AdvanceTaxAccrualMatrix {
  const quarters: Record<AdvanceTaxQuarter, ReturnType<typeof initEmptyQuarterData>> = {
    [AdvanceTaxQuarter.Q1]: initEmptyQuarterData(),
    [AdvanceTaxQuarter.Q2A]: initEmptyQuarterData(),
    [AdvanceTaxQuarter.Q2B]: initEmptyQuarterData(),
    [AdvanceTaxQuarter.Q3]: initEmptyQuarterData(),
    [AdvanceTaxQuarter.Q4]: initEmptyQuarterData(),
    [AdvanceTaxQuarter.Q5]: initEmptyQuarterData(),
  };

  const quarterTotals: Record<AdvanceTaxQuarter, number> = {
    [AdvanceTaxQuarter.Q1]: 0,
    [AdvanceTaxQuarter.Q2A]: 0,
    [AdvanceTaxQuarter.Q2B]: 0,
    [AdvanceTaxQuarter.Q3]: 0,
    [AdvanceTaxQuarter.Q4]: 0,
    [AdvanceTaxQuarter.Q5]: 0,
  };

  for (const gainItem of details) {
    if (!gainItem.sellDate && !gainItem.advanceTaxQuarter) continue;
    const quarter =
      (gainItem.advanceTaxQuarter as AdvanceTaxQuarter) ||
      (gainItem.sellDate ? getAdvanceTaxQuarter(gainItem.sellDate) : AdvanceTaxQuarter.Q1);
    const data = quarters[quarter];
    if (!data) continue;

    const section = classifySection(gainItem);
    const gain = gainItem.gain ?? 0;
    addGainToQuarter(data, section, gain);

    const taxBeforeCess = gainItem.taxBeforeCess ?? 0;
    const cess = gainItem.cess ?? taxBeforeCess * 0.04;
    const estimatedTax = gainItem.estimatedTax ?? taxBeforeCess + cess;

    data.totalGain += gain;
    data.taxBeforeCess += taxBeforeCess;
    data.cess += cess;
    data.estimatedTax += estimatedTax;
    quarterTotals[quarter] += estimatedTax;
  }

  return { quarters, quarterTotals };
}

interface GainLotAccumulator {
  totalConsideration: number;
  totalCost: number;
  totalTransferExpenses: number;
  stcg15: number;
  stcg20: number;
  ltcg10: number;
  ltcg12_5: number;
  sec50AA: number;
  sec112Debt: number;
  baseTaxPayable: number;
}

function processLotBySection(
  section: string,
  gain: number,
  item: ITRGainDetail,
  acc: GainLotAccumulator
): void {
  switch (section) {
    case TaxSectionName.SEC_111A_15:
      acc.stcg15 += gain;
      acc.baseTaxPayable += item.taxBeforeCess ?? Math.max(0, gain) * 0.15;
      break;
    case TaxSectionName.SEC_111A_20:
      acc.stcg20 += gain;
      acc.baseTaxPayable += item.taxBeforeCess ?? Math.max(0, gain) * 0.20;
      break;
    case TaxSectionName.SEC_112A_10:
      acc.ltcg10 += gain;
      break;
    case TaxSectionName.SEC_112A_12_5:
      acc.ltcg12_5 += gain;
      break;
    case TaxSectionName.SEC_112_DEBT_12_5:
      acc.sec112Debt += gain;
      acc.baseTaxPayable += item.taxBeforeCess ?? Math.max(0, gain) * 0.125;
      break;
    case TaxSectionName.SEC_112_DEBT_20:
      acc.sec112Debt += gain;
      acc.baseTaxPayable += item.taxBeforeCess ?? Math.max(0, gain) * 0.20;
      break;
    default: {
      acc.sec50AA += gain;
      const rate = item.taxRate ?? 0.30;
      acc.baseTaxPayable += item.taxBeforeCess ?? Math.max(0, gain) * rate;
      break;
    }
  }
}

function processGainLot(item: ITRGainDetail, acc: GainLotAccumulator): void {
  const gross = item.grossConsideration ?? ((item.units || 0) * (item.sellNav || 0));
  const cost = item.costOfAcquisition ?? ((item.units || 0) * (item.buyNav || 0));
  const expenses = item.transferExpenses ?? 0;
  const gain = item.gain ?? 0;

  acc.totalConsideration += gross;
  acc.totalCost += cost;
  acc.totalTransferExpenses += expenses;

  const section = classifySection(item);
  processLotBySection(section, gain, item, acc);
}

/**
 * Generates an audit-ready, 27-column CSV Capital Gains Tax report compliant with
 * CBDT Schedule CG (ITR-2 / ITR-3) and Advance Tax Section 234C (Table F).
 */
export function generateITRReportCSV(params: ITRReportParams): string {
  const {
    assesseeName = 'Portfolio Investor',
    pan = '',
    fy,
    ay = computeAY(fy),
    details = [],
  } = params;

  const acc: GainLotAccumulator = {
    totalConsideration: 0,
    totalCost: 0,
    totalTransferExpenses: 0,
    stcg15: 0,
    stcg20: 0,
    ltcg10: 0,
    ltcg12_5: 0,
    sec50AA: 0,
    sec112Debt: 0,
    baseTaxPayable: 0,
  };

  for (const item of details) {
    processGainLot(item, acc);
  }

  const exemptionResult = calculate112AExemption(acc.ltcg10, acc.ltcg12_5, fy);
  const tax112a = (exemptionResult.taxable10 * 0.10) + (exemptionResult.taxable12_5 * 0.125);
  acc.baseTaxPayable += tax112a;

  const cess = acc.baseTaxPayable * 0.04;
  const totalTax = acc.baseTaxPayable + cess;

  const matrix = params.advanceTaxMatrix || buildAdvanceTaxMatrix(details);

  verifyItrInvariants({
    ...params,
    fy,
    advanceTaxMatrix: matrix,
    totalExemption: exemptionResult.totalExemption,
  });

  const headerLines = buildHeaderSummary({
    assesseeName,
    pan,
    fy,
    ay,
    totalConsideration: acc.totalConsideration,
    totalCost: acc.totalCost,
    totalTransferExpenses: acc.totalTransferExpenses,
    stcg15: acc.stcg15,
    stcg20: acc.stcg20,
    ltcg10: acc.ltcg10,
    ltcg12_5: acc.ltcg12_5,
    exemptionClaimed: exemptionResult.totalExemption,
    sec50AA: acc.sec50AA,
    sec112Debt: acc.sec112Debt,
    baseTaxPayable: acc.baseTaxPayable,
    cess,
    totalTax,
  });

  const matrixLines = buildMatrixRows(matrix, fy);
  const headerBlock = [...headerLines, ...matrixLines, '# ===================================================================================================='];

  const rows = details.map((item, idx) =>
    formatGainRow(item, idx, classifySection, getAdvanceTaxQuarter)
  );

  return [...headerBlock, CSV_TABLE_HEADER, ...rows].join('\n');
}
