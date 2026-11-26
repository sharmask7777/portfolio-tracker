/**
 * @file itr-csv-exporter.ts
 * @module utils/itr-csv-exporter
 * @description RFC 4180 CSV export generation for ITR-2 / ITR-3 Schedule CG reports.
 */

import {
  AdvanceTaxQuarter,
  type AdvanceTaxAccrualMatrix,
  type ITRGainDetail,
} from './itr-report-types';

export function escapeCSV(val: unknown): string {
  if (val === undefined || val === null) return '';
  let str = String(val).replace(/\r\n?/g, '\n');
  if (/^[=+\-@\t]/.test(str) && !/^-?\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatDate(dateInput: Date | string): string {
  if (!dateInput) return '';
  const str = String(dateInput);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) return str;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTaxRate(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '0.0%';
  const num = rate <= 1 ? rate * 100 : rate;
  return `${num.toFixed(1)}%`;
}

export interface HeaderSummaryParams {
  assesseeName: string;
  pan: string;
  fy: string;
  ay: string;
  totalConsideration: number;
  totalCost: number;
  totalTransferExpenses: number;
  stcg15: number;
  stcg20: number;
  ltcg10: number;
  ltcg12_5: number;
  exemptionClaimed: number;
  sec50AA: number;
  sec112Debt: number;
  baseTaxPayable: number;
  cess: number;
  totalTax: number;
}

export function buildHeaderSummary(params: HeaderSummaryParams): string[] {
  const {
    assesseeName,
    pan,
    fy,
    ay,
    totalConsideration,
    totalCost,
    totalTransferExpenses,
    stcg15,
    stcg20,
    ltcg10,
    ltcg12_5,
    exemptionClaimed,
    sec50AA,
    sec112Debt,
    baseTaxPayable,
    cess,
    totalTax,
  } = params;

  const total111A = stcg15 + stcg20;
  const total112A = ltcg10 + ltcg12_5;

  return [
    '# ====================================================================================================',
    '# CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)',
    '# ====================================================================================================',
    `# Assessee Name: ${assesseeName} | PAN: ${pan} | FY: ${fy} | AY: ${ay}`,
    `# Total Consideration: Rs ${totalConsideration.toFixed(2)} | Total Cost: Rs ${totalCost.toFixed(2)} | Transfer Expenses: Rs ${totalTransferExpenses.toFixed(2)}`,
    `# Section 111A STCG: Rs ${total111A.toFixed(2)} (Pre: Rs ${stcg15.toFixed(2)} @ 15% | Post: Rs ${stcg20.toFixed(2)} @ 20%)`,
    `# Section 112A LTCG: Rs ${total112A.toFixed(2)} (Pre: Rs ${ltcg10.toFixed(2)} @ 10% | Post: Rs ${ltcg12_5.toFixed(2)} @ 12.5%)`,
    `# Section 112A Exemption Claimed: Rs ${exemptionClaimed.toFixed(2)} (Exhausted against 10% tranche first)`,
    `# Section 50AA Deemed STCG (Slab): Rs ${sec50AA.toFixed(2)} | Section 112 Debt LTCG: Rs ${sec112Debt.toFixed(2)}`,
    `# Base Tax Payable: Rs ${baseTaxPayable.toFixed(2)} | Health & Education Cess (4%): Rs ${cess.toFixed(2)} | Total Tax: Rs ${totalTax.toFixed(2)}`,
    '# ----------------------------------------------------------------------------------------------------',
    '# ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)',
    '# Quarter,Due Date,Sec 111A (15%),Sec 111A (20%),Sec 112A (10%),Sec 112A (12.5%),Sec 50AA (Slab),Sec 112 Debt,Total Gains',
  ];
}

export function buildMatrixRows(matrix: AdvanceTaxAccrualMatrix, fy: string): string[] {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const endYear = startYear + 1;

  const dueDates: Record<AdvanceTaxQuarter, string> = {
    [AdvanceTaxQuarter.Q1]: `15/06/${startYear}`,
    [AdvanceTaxQuarter.Q2A]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q2B]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q3]: `15/12/${startYear}`,
    [AdvanceTaxQuarter.Q4]: `15/03/${endYear}`,
    [AdvanceTaxQuarter.Q5]: `31/03/${endYear}`,
  };

  const quartersOrder: AdvanceTaxQuarter[] = [
    AdvanceTaxQuarter.Q1,
    AdvanceTaxQuarter.Q2A,
    AdvanceTaxQuarter.Q2B,
    AdvanceTaxQuarter.Q3,
    AdvanceTaxQuarter.Q4,
    AdvanceTaxQuarter.Q5,
  ];

  return quartersOrder.map((quarter) => {
    const qData = matrix.quarters[quarter] || {
      stcg15: 0,
      stcg20: 0,
      ltcg10: 0,
      ltcg12_5: 0,
      debtLtcg12_5: 0,
      debtLtcg20: 0,
      slab: 0,
      totalGain: 0,
    };
    const debtTotal = (qData.debtLtcg12_5 || 0) + (qData.debtLtcg20 || 0);
    const rowTotal =
      (qData.stcg15 || 0) +
      (qData.stcg20 || 0) +
      (qData.ltcg10 || 0) +
      (qData.ltcg12_5 || 0) +
      (qData.slab || 0) +
      debtTotal;

    return `# ${quarter},${dueDates[quarter]},${qData.stcg15.toFixed(2)},${qData.stcg20.toFixed(2)},${qData.ltcg10.toFixed(2)},${qData.ltcg12_5.toFixed(2)},${qData.slab.toFixed(2)},${debtTotal.toFixed(2)},${rowTotal.toFixed(2)}`;
  });
}

export const CSV_TABLE_HEADER =
  'Sr. No.,Folio Number,ISIN,Asset / Scheme Name,Asset Class,Tax Section,Buy Date,Sell Date,Holding Period (Days),Holding Type,Units,Buy NAV (Rs),Sell NAV (Rs),Gross Consideration (Rs),Cost of Acquisition (Rs),FMV as on 31-Jan-2018 (Rs),Total FMV 2018 (Rs),Deemed Cost u/s 55(2)(ac) (Rs),Transfer Expenses / Exit Load (Rs),Net Capital Gain / (Loss) (Rs),Tax Rate (%),Tax Before Cess (Rs),Health & Education Cess (4%) (Rs),Total Tax Payable (Rs),Advance Tax Quarter,Grandfathered Flag,Anchor / Estimate Warning';

function extractRowIdentifiers(item: ITRGainDetail, classifyFn: (item: Partial<ITRGainDetail>) => string) {
  const folioNumber = escapeCSV(item.folioNumber || 'N/A');
  const isin = escapeCSV(item.isin || 'N/A');
  const assetName = escapeCSV(item.assetName || '');
  const assetClass = escapeCSV(item.assetClass || (item.taxType === 'SLAB' ? 'DEBT' : 'EQUITY'));
  const section = escapeCSV(classifyFn(item));
  const buyDate = formatDate(item.buyDate);
  const sellDate = formatDate(item.sellDate);
  const holdingPeriodDays = item.holdingPeriodDays !== undefined ? item.holdingPeriodDays : '';
  const holdingType = item.holdingType || (item.taxType === 'LTCG' ? 'Long-Term' : 'Short-Term');

  return { folioNumber, isin, assetName, assetClass, section, buyDate, sellDate, holdingPeriodDays, holdingType };
}

function resolveLotGrossAndCost(item: ITRGainDetail) {
  const u = item.units || 0;
  const gross = item.grossConsideration ?? (u * (item.sellNav || 0));
  const cost = item.costOfAcquisition ?? (u * (item.buyNav || 0));
  return { gross, cost };
}

function extractRowEconomics(item: ITRGainDetail) {
  const units = (item.units || 0).toFixed(3);
  const buyNav = (item.buyNav || 0).toFixed(4);
  const sellNav = (item.sellNav || 0).toFixed(4);

  const { gross, cost } = resolveLotGrossAndCost(item);
  const grossConsideration = gross.toFixed(2);
  const costOfAcquisition = cost.toFixed(2);

  const fmv2018 = (item.fmvAsOfJan31_2018 ?? 0).toFixed(4);
  const totalFmv2018 = (item.totalFmvJan31_2018 ?? 0).toFixed(2);
  const deemedCost = (item.deemedCostOfAcquisition ?? cost).toFixed(2);
  const transferExpenses = (item.transferExpenses ?? 0).toFixed(2);
  const gain = (item.gain ?? 0).toFixed(2);

  return { units, buyNav, sellNav, grossConsideration, costOfAcquisition, fmv2018, totalFmv2018, deemedCost, transferExpenses, gain };
}

function extractRowTaxFields(
  item: ITRGainDetail,
  quarterFn: (date: Date | string) => string
) {
  const taxRate = formatTaxRate(item.taxRate);
  const taxBeforeCess = (item.taxBeforeCess ?? 0).toFixed(2);
  const cessAmount = (item.cess ?? (Math.max(0, item.taxBeforeCess ?? 0) * 0.04)).toFixed(2);
  const totalTaxPayable = (
    item.estimatedTax ?? ((item.taxBeforeCess ?? 0) + (item.cess ?? 0))
  ).toFixed(2);
  const quarter = escapeCSV(item.advanceTaxQuarter || (item.sellDate ? quarterFn(item.sellDate) : ''));
  const grandfatheredFlag = item.isGrandfathered ? 'Yes' : 'No';
  const anchorWarning = item.isAnchorDependent ? 'Estimated' : 'Actual';

  return { taxRate, taxBeforeCess, cessAmount, totalTaxPayable, quarter, grandfatheredFlag, anchorWarning };
}

export function formatGainRow(
  gainItem: ITRGainDetail,
  rowIndex: number,
  classifyFn: (item: Partial<ITRGainDetail>) => string,
  quarterFn: (date: Date | string) => string
): string {
  const idFields = extractRowIdentifiers(gainItem, classifyFn);
  const econFields = extractRowEconomics(gainItem);
  const taxFields = extractRowTaxFields(gainItem, quarterFn);

  return [
    rowIndex + 1,
    idFields.folioNumber,
    idFields.isin,
    idFields.assetName,
    idFields.assetClass,
    idFields.section,
    idFields.buyDate,
    idFields.sellDate,
    idFields.holdingPeriodDays,
    idFields.holdingType,
    econFields.units,
    econFields.buyNav,
    econFields.sellNav,
    econFields.grossConsideration,
    econFields.costOfAcquisition,
    econFields.fmv2018,
    econFields.totalFmv2018,
    econFields.deemedCost,
    econFields.transferExpenses,
    econFields.gain,
    taxFields.taxRate,
    taxFields.taxBeforeCess,
    taxFields.cessAmount,
    taxFields.totalTaxPayable,
    taxFields.quarter,
    taxFields.grandfatheredFlag,
    taxFields.anchorWarning,
  ].join(',');
}
