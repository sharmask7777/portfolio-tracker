/**
 * @file itr-csv-service.ts
 * @description Generates statutory Schedule CG CSV exports and triggers native device sharing.
 */

import { Share } from 'react-native';
import {
  AdvanceTaxQuarter,
  type TaxCalculationsResult,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
} from './tax-harvesting';

/**
 * Escapes fields for RFC 4180 CSV compliance.
 *
 * @param val - Value to escape.
 * @returns Escaped CSV string.
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildHeaderLines(selectedFY: string, taxResult: TaxCalculationsResult): string[] {
  const startYear = parseInt(selectedFY.split('-')[0] ?? '2024', 10);
  const endYear = startYear + 1;
  const ay = `${endYear}-${(endYear + 1).toString().slice(-2)}`;

  return [
    '# ====================================================================================================',
    '# CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)',
    '# ====================================================================================================',
    `# Financial Year: ${selectedFY} | Assessment Year: ${ay}`,
    `# Section 112A LTCG: Rs ${taxResult.totalEquityLTCG.toFixed(2)} | Exemption Claimed: Rs ${taxResult.ltcgExemptClaimed.toFixed(2)}`,
    `# Section 111A STCG: Rs ${taxResult.totalSTCG111A.toFixed(2)} | Slab Debt Gain: Rs ${taxResult.slabGain.toFixed(2)}`,
    `# Base Tax: Rs ${taxResult.baseTaxTotal.toFixed(2)} | Health & Education Cess (4%): Rs ${taxResult.cessTotal.toFixed(2)} | Net Tax: Rs ${taxResult.grandTotalTax.toFixed(2)}`,
    '# ----------------------------------------------------------------------------------------------------',
    '# ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)',
    '# Quarter,Due Date,Sec 111A STCG,Sec 112A LTCG,Sec 112 Debt LTCG,Sec 50AA Slab,Total Quarter Gain',
  ];
}

const QUARTERS = [
  AdvanceTaxQuarter.Q1,
  AdvanceTaxQuarter.Q2A,
  AdvanceTaxQuarter.Q2B,
  AdvanceTaxQuarter.Q3,
  AdvanceTaxQuarter.Q4,
  AdvanceTaxQuarter.Q5,
] as const;

function extractQuarterGainSum(q: TableFQuarterData): {
  stcg: number;
  ltcg: number;
  debtLtcg: number;
  slab: number;
  total: number;
} {
  const stcg = q.stcg15 + q.stcg20;
  const ltcg = q.ltcg10 + q.ltcg12_5;
  const debtLtcg = q.debtLtcg12_5 + q.debtLtcg20;
  const slab = q.slab;
  const total = q.totalGain;
  return { stcg, ltcg, debtLtcg, slab, total };
}

const DEFAULT_Q_DATA: TableFQuarterData = {
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

function buildQuarterLine(
  q: AdvanceTaxQuarter,
  matrix: AdvanceTaxAccrualMatrix,
  dueDates: Record<AdvanceTaxQuarter, string>,
): string {
  const data = matrix.quarters[q] ?? DEFAULT_Q_DATA;
  const vals = extractQuarterGainSum(data);
  const date = dueDates[q] ?? '';
  return `# ${escapeCsvField(q)},${escapeCsvField(date)},${vals.stcg.toFixed(2)},${vals.ltcg.toFixed(2)},${vals.debtLtcg.toFixed(2)},${vals.slab.toFixed(2)},${vals.total.toFixed(2)}`;
}

function buildTableFRows(matrix: AdvanceTaxAccrualMatrix, startYear: number): string[] {
  const endYear = startYear + 1;
  const dueDates: Record<AdvanceTaxQuarter, string> = {
    [AdvanceTaxQuarter.Q1]: `15/06/${startYear}`,
    [AdvanceTaxQuarter.Q2A]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q2B]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q3]: `15/12/${startYear}`,
    [AdvanceTaxQuarter.Q4]: `15/03/${endYear}`,
    [AdvanceTaxQuarter.Q5]: `31/03/${endYear}`,
  };

  return QUARTERS.map((q) => buildQuarterLine(q, matrix, dueDates));
}

function buildDetailSection(taxResult: TaxCalculationsResult, startYear: number): string[] {
  const isPostBudget2024 = startYear >= 2024;
  const ltcgRateLabel = isPostBudget2024 ? '12.5% statutory' : '10% statutory';
  const stcgRateLabel = isPostBudget2024 ? '20% statutory' : '15% statutory';

  return [
    '# ----------------------------------------------------------------------------------------------------',
    'Category,Tax Section,Applicable Rate,Realized Gain (Rs),Exemption Claimed (Rs),Tax Payable (Rs)',
    `${escapeCsvField('Equity LTCG')},${escapeCsvField('Section 112A')},${escapeCsvField(ltcgRateLabel)},${taxResult.totalEquityLTCG.toFixed(2)},${taxResult.ltcgExemptClaimed.toFixed(2)},${taxResult.ltcgTotalTax.toFixed(2)}`,
    `${escapeCsvField('Equity STCG')},${escapeCsvField('Section 111A')},${escapeCsvField(stcgRateLabel)},${taxResult.totalSTCG111A.toFixed(2)},0.00,${taxResult.stcgTotalTax.toFixed(2)}`,
    `${escapeCsvField('Debt LTCG (12.5%)')},${escapeCsvField('Section 112')},${escapeCsvField('12.5% statutory')},${taxResult.debtLtcg12_5Gain.toFixed(2)},0.00,${Math.max(0, taxResult.debtLtcg12_5Gain * 0.125).toFixed(2)}`,
    `${escapeCsvField('Debt LTCG (20% Indexed)')},${escapeCsvField('Section 112')},${escapeCsvField('20% statutory')},${taxResult.debtLtcg20Gain.toFixed(2)},0.00,${Math.max(0, taxResult.debtLtcg20Gain * 0.2).toFixed(2)}`,
    `${escapeCsvField('Specified Debt / MLD')},${escapeCsvField('Section 50AA')},${escapeCsvField('Slab rate')},${taxResult.slabGain.toFixed(2)},0.00,${taxResult.slabTotalTax.toFixed(2)}`,
  ];
}

/**
 * Generates the statutory Schedule CG Table F and Capital Gains Tax CSV string.
 *
 * @param selectedFY - Active financial year (e.g., '2024-25').
 * @param taxResult - Realized capital gains calculation result.
 * @param matrix - Advance tax accrual quarterly matrix.
 * @returns RFC 4180 compliant CSV string.
 */
export function generateScheduleCgCsv(
  selectedFY: string,
  taxResult: TaxCalculationsResult,
  matrix: AdvanceTaxAccrualMatrix,
): string {
  const startYear = parseInt(selectedFY.split('-')[0] ?? '2024', 10);
  const headerLines = buildHeaderLines(selectedFY, taxResult);
  const matrixLines = buildTableFRows(matrix, startYear);
  const detailLines = buildDetailSection(taxResult, startYear);

  return [...headerLines, ...matrixLines, ...detailLines].join('\n');
}

/**
 * Triggers native system share dialog for Schedule CG CSV export.
 *
 * @param selectedFY - Active financial year.
 * @param taxResult - Realized capital gains calculation result.
 * @param matrix - Advance tax accrual quarterly matrix.
 */
export async function exportScheduleCgCsv(
  selectedFY: string,
  taxResult: TaxCalculationsResult,
  matrix: AdvanceTaxAccrualMatrix,
): Promise<void> {
  const csvContent = generateScheduleCgCsv(selectedFY, taxResult, matrix);
  await Share.share({
    title: `Schedule_CG_${selectedFY}.csv`,
    message: csvContent,
  });
}
