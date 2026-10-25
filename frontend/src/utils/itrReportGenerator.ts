export const AdvanceTaxQuarter = {
  Q1: 'Q1 (01/04 - 15/06)',
  Q2A: 'Q2a (16/06 - 22/07)',
  Q2B: 'Q2b (23/07 - 15/09)',
  Q3: 'Q3 (16/09 - 15/12)',
  Q4: 'Q4 (16/12 - 15/03)',
  Q5: 'Q5 (16/03 - 31/03)',
} as const;
export type AdvanceTaxQuarter = (typeof AdvanceTaxQuarter)[keyof typeof AdvanceTaxQuarter];

export const TaxSectionName = {
  SEC_111A_15: '111A (15%)',
  SEC_111A_20: '111A (20%)',
  SEC_112A_10: '112A (10%)',
  SEC_112A_12_5: '112A (12.5%)',
  SEC_50AA: '50AA (Slab)',
  SEC_112_DEBT_12_5: '112 Debt (12.5%)',
  SEC_112_DEBT_20: '112 Debt (20% Indexed)',
  SLAB: 'SLAB',
} as const;
export type TaxSectionName = (typeof TaxSectionName)[keyof typeof TaxSectionName];

export interface TableFQuarterData {
  stcg15: number;
  stcg20: number;
  ltcg10: number;
  ltcg12_5: number;
  debtLtcg12_5: number;
  debtLtcg20: number;
  slab: number;
  totalGain: number;
  taxBeforeCess: number;
  cess: number;
  estimatedTax: number;
}

export interface AdvanceTaxAccrualMatrix {
  quarters: Record<AdvanceTaxQuarter, TableFQuarterData>;
  quarterTotals: Record<AdvanceTaxQuarter, number>;
}

export interface ITRGainDetail {
  assetName: string;
  folioNumber?: string;
  isin?: string;
  pan?: string;
  panName?: string;
  assetClass?: string;
  section?: string;
  buyDate: Date | string;
  sellDate: Date | string;
  holdingPeriodDays?: number;
  holdingType?: 'Short-Term' | 'Long-Term' | string;
  units: number;
  buyNav: number;
  sellNav: number;
  grossConsideration?: number;
  costOfAcquisition?: number;
  fmvAsOfJan31_2018?: number;
  totalFmvJan31_2018?: number;
  deemedCostOfAcquisition?: number;
  transferExpenses?: number;
  gain: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB' | string;
  taxRate?: number;
  taxBeforeCess?: number;
  cess?: number;
  estimatedTax?: number;
  advanceTaxQuarter?: string;
  isGrandfathered?: boolean;
  grandfatheredStatus?: string;
  isAnchorDependent?: boolean;
}

export interface ITRSummary {
  assesseeName?: string;
  userName?: string;
  pan?: string;
  details?: ITRGainDetail[];
  hasSyntheticAnchors?: boolean;
  tableF?: AdvanceTaxAccrualMatrix;
  sectionTotals?: Record<string, unknown>;
  realized?: {
    stcg?: number;
    ltcg?: number;
    slab?: number;
    total?: number;
    taxableStcg?: number;
    taxableLtcg?: number;
    taxableSlab?: number;
    details?: ITRGainDetail[];
  };
}

export interface ITRReportParams {
  assesseeName?: string;
  pan?: string;
  fy: string;
  ay?: string;
  details: ITRGainDetail[];
  summary?: ITRSummary;
  advanceTaxMatrix?: AdvanceTaxAccrualMatrix;
  sectionSummary?: Record<string, unknown>;
}

export function computeAY(fy: string): string {
  const startYear = parseInt(fy.split('-')[0], 10);
  const ayStartYear = startYear + 1;
  const ayEndYear = (startYear + 2).toString().slice(-2);
  return `${ayStartYear}-${ayEndYear}`;
}

export function getAdvanceTaxQuarter(date: Date | string): AdvanceTaxQuarter {
  let mmdd = '';
  if (typeof date === 'string') {
    const match = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (match) {
      mmdd = `${match[1]}-${match[2]}`;
    }
  }
  if (!mmdd) {
    const d = date instanceof Date ? date : new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    mmdd = `${m}-${day}`;
  }

  if (mmdd >= '04-01' && mmdd <= '06-15') {
    return AdvanceTaxQuarter.Q1;
  }
  if (mmdd >= '06-16' && mmdd <= '07-22') {
    return AdvanceTaxQuarter.Q2A;
  }
  if (mmdd >= '07-23' && mmdd <= '09-15') {
    return AdvanceTaxQuarter.Q2B;
  }
  if (mmdd >= '09-16' && mmdd <= '12-15') {
    return AdvanceTaxQuarter.Q3;
  }
  if (mmdd >= '12-16' || mmdd <= '03-15') {
    return AdvanceTaxQuarter.Q4;
  }
  return AdvanceTaxQuarter.Q5;
}

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
  const startYear = parseInt(String(fy).split('-')[0], 10);
  const isFy2425OrLater = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const limit = isFy2425OrLater ? 125000 : 100000;

  const pureLtcg10 = Math.max(0, ltcg10);
  const pureLtcg12_5 = Math.max(0, ltcg12_5);

  const exempt10 = Math.min(pureLtcg10, limit);
  const remainingLimit = limit - exempt10;
  const exempt12_5 = Math.min(pureLtcg12_5, remainingLimit);

  const taxable10 = pureLtcg10 - exempt10;
  const taxable12_5 = pureLtcg12_5 - exempt12_5;

  const tax10BeforeCess = taxable10 * 0.10;
  const tax10 = tax10BeforeCess + tax10BeforeCess * 0.04;

  const tax12_5BeforeCess = taxable12_5 * 0.125;
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

export function classifySection(g: Partial<ITRGainDetail>): string {
  if (g.section) return g.section;

  const isLtcg = g.taxType === 'LTCG';
  const isStcg = g.taxType === 'STCG';
  const isSlab = g.taxType === 'SLAB';
  const isDebt = g.assetClass === 'DEBT' || (g.taxRate === 0.20 && g.isGrandfathered);

  if (isStcg) {
    if (g.taxRate === 0.20 || (!g.taxRate && g.sellDate && g.sellDate >= '2024-07-23')) {
      return TaxSectionName.SEC_111A_20;
    }
    return TaxSectionName.SEC_111A_15;
  }

  if (isLtcg) {
    if (isDebt) {
      if (g.taxRate === 0.20) {
        return TaxSectionName.SEC_112_DEBT_20;
      }
      return TaxSectionName.SEC_112_DEBT_12_5;
    }
    if (g.taxRate === 0.125 || (!g.isGrandfathered && g.sellDate && g.sellDate >= '2024-07-23')) {
      return TaxSectionName.SEC_112A_12_5;
    }
    return TaxSectionName.SEC_112A_10;
  }

  if (isSlab) {
    return TaxSectionName.SEC_50AA;
  }

  return TaxSectionName.SLAB;
}

export function buildAdvanceTaxMatrix(details: Partial<ITRGainDetail>[]): AdvanceTaxAccrualMatrix {
  const quarters: Record<AdvanceTaxQuarter, TableFQuarterData> = {
    [AdvanceTaxQuarter.Q1]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
    [AdvanceTaxQuarter.Q2A]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
    [AdvanceTaxQuarter.Q2B]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
    [AdvanceTaxQuarter.Q3]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
    [AdvanceTaxQuarter.Q4]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
    [AdvanceTaxQuarter.Q5]: { stcg15: 0, stcg20: 0, ltcg10: 0, ltcg12_5: 0, debtLtcg12_5: 0, debtLtcg20: 0, slab: 0, totalGain: 0, taxBeforeCess: 0, cess: 0, estimatedTax: 0 },
  };

  const quarterTotals: Record<AdvanceTaxQuarter, number> = {
    [AdvanceTaxQuarter.Q1]: 0,
    [AdvanceTaxQuarter.Q2A]: 0,
    [AdvanceTaxQuarter.Q2B]: 0,
    [AdvanceTaxQuarter.Q3]: 0,
    [AdvanceTaxQuarter.Q4]: 0,
    [AdvanceTaxQuarter.Q5]: 0,
  };

  for (const g of details) {
    if (!g.sellDate && !g.advanceTaxQuarter) continue;
    const q = (g.advanceTaxQuarter as AdvanceTaxQuarter) || (g.sellDate ? getAdvanceTaxQuarter(g.sellDate) : AdvanceTaxQuarter.Q1);
    const data = quarters[q];
    if (!data) continue;

    const section = classifySection(g);
    const gain = g.gain ?? 0;

    if (section === TaxSectionName.SEC_111A_15) {
      data.stcg15 += gain;
    } else if (section === TaxSectionName.SEC_111A_20) {
      data.stcg20 += gain;
    } else if (section === TaxSectionName.SEC_112A_10) {
      data.ltcg10 += gain;
    } else if (section === TaxSectionName.SEC_112A_12_5) {
      data.ltcg12_5 += gain;
    } else if (section === TaxSectionName.SEC_112_DEBT_12_5) {
      data.debtLtcg12_5 += gain;
    } else if (section === TaxSectionName.SEC_112_DEBT_20) {
      data.debtLtcg20 += gain;
    } else {
      data.slab += gain;
    }

    const tbCess = g.taxBeforeCess !== undefined ? g.taxBeforeCess : 0;
    const cess = g.cess !== undefined ? g.cess : tbCess * 0.04;
    const estTax = g.estimatedTax !== undefined ? g.estimatedTax : tbCess + cess;

    data.totalGain += gain;
    data.taxBeforeCess += tbCess;
    data.cess += cess;
    data.estimatedTax += estTax;
    quarterTotals[q] += estTax;
  }

  return { quarters, quarterTotals };
}

export interface ITRQuarterlySummary {
  q1?: number;
  q2?: number;
  q2a?: number;
  q2b?: number;
  q3?: number;
  q4?: number;
  q5?: number;
  total?: number;
}

export interface ITRVerificationTarget {
  fy?: string;
  financialYear?: string;
  totalGain?: number;
  totalCapitalGain?: number;
  exemptLtcg?: number;
  totalExemption?: number;
  exempt112A?: number;
  exempt_ltcg_112a?: number;
  exemptionClaimed?: number;
  taxableStcg?: number;
  taxableLtcg?: number;
  taxableSlab?: number;
  taxableGain?: number;
  taxableTotal?: number;
  quarterlySummary?: ITRQuarterlySummary;
  details?: Array<{ gain?: number }>;
  summary?: ITRSummary;
  advanceTaxMatrix?: AdvanceTaxAccrualMatrix;
  tableF?: AdvanceTaxAccrualMatrix;
  realized?: {
    stcg?: number;
    ltcg?: number;
    slab?: number;
    total?: number;
    taxableStcg?: number;
    taxableLtcg?: number;
    taxableSlab?: number;
    details?: ITRGainDetail[];
  };
  [key: string]: unknown;
}

/**
 * Verifies statutory ITR capital gains invariants before report generation or export:
 * 1. Sum of quarterly accrued gains across Table F equals net realized gains.
 * 2. Exempt LTCG under Sec 112A does not exceed statutory limits (₹1,25,000 post-Budget 2024, ₹1,00,000 pre-Budget 2024).
 * 3. Taxable gain cannot be negative after set-off.
 */
export function verifyItrInvariants(report: ITRVerificationTarget): void {
  if (!report) {
    throw new Error('Invariant violated: report data is required for invariant verification');
  }

  const fy = report.fy || report.financialYear || '2024-25';
  const startYear = parseInt(String(fy).split('-')[0], 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  const netRealizedTotal =
    report.realized?.total ??
    report.summary?.realized?.total ??
    report.totalGain ??
    report.totalCapitalGain ??
    (Array.isArray(report.details)
      ? report.details.reduce((sum: number, g: { gain?: number }) => sum + (g.gain ?? 0), 0)
      : undefined);

  // 1. Quarterly Accrual vs Net Realized Total Invariant
  if (report.quarterlySummary) {
    const qs = report.quarterlySummary;
    const qSum =
      (qs.q1 ?? 0) +
      (qs.q2 ?? 0) +
      (qs.q2a ?? 0) +
      (qs.q2b ?? 0) +
      (qs.q3 ?? 0) +
      (qs.q4 ?? 0) +
      (qs.q5 ?? 0);

    if (qs.total !== undefined && Math.abs(qSum - qs.total) > 0.01) {
      throw new Error(
        `Invariant violated: quarterly accrued gains (${qSum}) do not sum to quarterly total (${qs.total})`
      );
    }

    if (netRealizedTotal !== undefined) {
      if (Math.abs(qSum - netRealizedTotal) > 0.01) {
        throw new Error(
          `Invariant violated: quarterly accrued gains (${qSum}) do not sum to total capital gain (${netRealizedTotal})`
        );
      }
      if (qs.total !== undefined && Math.abs(qs.total - netRealizedTotal) > 0.01) {
        throw new Error(
          `Invariant violated: quarterly total (${qs.total}) does not match portfolio realized total (${netRealizedTotal})`
        );
      }
    }
  }

  const matrix: AdvanceTaxAccrualMatrix | undefined =
    report.advanceTaxMatrix || report.tableF || report.summary?.tableF;
  if (matrix && matrix.quarters) {
    let matrixSum = 0;
    for (const qKey of Object.keys(matrix.quarters)) {
      const qData = matrix.quarters[qKey as AdvanceTaxQuarter];
      if (qData) {
        matrixSum += qData.totalGain ?? 0;
      }
    }

    if (netRealizedTotal !== undefined && Math.abs(matrixSum - netRealizedTotal) > 0.01) {
      throw new Error(
        `Invariant violated: Table F quarterly accrued gains (${matrixSum}) do not sum to net realized gain (${netRealizedTotal})`
      );
    }
  }

  // 2. Section 112A Exemption Statutory Limit Invariant
  const claimedExemption =
    report.exemptLtcg ??
    report.totalExemption ??
    report.exempt112A ??
    report.exempt_ltcg_112a ??
    report.exemptionClaimed;

  if (claimedExemption !== undefined) {
    if (claimedExemption < -0.001) {
      throw new Error(
        `Invariant violated: Section 112A exemption claimed cannot be negative (${claimedExemption})`
      );
    }
    if (claimedExemption > statutoryLimit + 0.01) {
      throw new Error(
        `Invariant violated: Section 112A exemption claimed (${claimedExemption}) exceeds statutory limit (${statutoryLimit}) for FY ${fy}`
      );
    }
  }

  // 3. Non-Negative Taxable Gain Invariant
  const taxableStcg =
    report.realized?.taxableStcg ?? report.summary?.realized?.taxableStcg ?? report.taxableStcg;
  const taxableLtcg =
    report.realized?.taxableLtcg ?? report.summary?.realized?.taxableLtcg ?? report.taxableLtcg;
  const taxableSlab =
    report.realized?.taxableSlab ?? report.summary?.realized?.taxableSlab ?? report.taxableSlab;
  const totalTaxable =
    report.taxableGain ??
    report.taxableTotal ??
    (taxableStcg !== undefined || taxableLtcg !== undefined || taxableSlab !== undefined
      ? (taxableStcg ?? 0) + (taxableLtcg ?? 0) + (taxableSlab ?? 0)
      : undefined);

  if (taxableStcg !== undefined && taxableStcg < -0.001) {
    throw new Error(
      `Invariant violated: taxable STCG cannot be negative after set-off (${taxableStcg})`
    );
  }
  if (taxableLtcg !== undefined && taxableLtcg < -0.001) {
    throw new Error(
      `Invariant violated: taxable LTCG cannot be negative after set-off (${taxableLtcg})`
    );
  }
  if (taxableSlab !== undefined && taxableSlab < -0.001) {
    throw new Error(
      `Invariant violated: taxable slab gain cannot be negative after set-off (${taxableSlab})`
    );
  }
  if (totalTaxable !== undefined && totalTaxable < -0.001) {
    throw new Error(
      `Invariant violated: taxable gain cannot be negative after set-off (${totalTaxable})`
    );
  }
}

function escapeCSV(val: unknown): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(dateInput: Date | string): string {
  if (!dateInput) return '';
  const str = String(dateInput);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTaxRate(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '0.0%';
  const num = rate <= 1 ? rate * 100 : rate;
  return `${num.toFixed(1)}%`;
}

export function generateITRReportCSV(params: ITRReportParams): string {
  const {
    assesseeName = 'Portfolio Investor',
    pan = 'ABCDE1234F',
    fy,
    ay = computeAY(fy),
    details = [],
  } = params;

  const startYear = parseInt(fy.split('-')[0], 10);
  const endYear = startYear + 1;

  // Aggregate totals from details
  let totalConsideration = 0;
  let totalCost = 0;
  let totalTransferExpenses = 0;

  let stcg15 = 0;
  let stcg20 = 0;
  let ltcg10 = 0;
  let ltcg12_5 = 0;
  let sec50AA = 0;
  let sec112Debt = 0;

  let baseTaxPayable = 0;

  for (const g of details) {
    const gross = g.grossConsideration ?? ((g.units || 0) * (g.sellNav || 0));
    const cost = g.costOfAcquisition ?? ((g.units || 0) * (g.buyNav || 0));
    const expenses = g.transferExpenses ?? 0;
    const gain = g.gain ?? 0;

    totalConsideration += gross;
    totalCost += cost;
    totalTransferExpenses += expenses;

    const section = classifySection(g);

    if (section === TaxSectionName.SEC_111A_15) {
      stcg15 += gain;
      baseTaxPayable += g.taxBeforeCess !== undefined ? g.taxBeforeCess : Math.max(0, gain) * 0.15;
    } else if (section === TaxSectionName.SEC_111A_20) {
      stcg20 += gain;
      baseTaxPayable += g.taxBeforeCess !== undefined ? g.taxBeforeCess : Math.max(0, gain) * 0.20;
    } else if (section === TaxSectionName.SEC_112A_10) {
      ltcg10 += gain;
    } else if (section === TaxSectionName.SEC_112A_12_5) {
      ltcg12_5 += gain;
    } else if (section === TaxSectionName.SEC_112_DEBT_12_5) {
      sec112Debt += gain;
      baseTaxPayable += g.taxBeforeCess !== undefined ? g.taxBeforeCess : Math.max(0, gain) * 0.125;
    } else if (section === TaxSectionName.SEC_112_DEBT_20) {
      sec112Debt += gain;
      baseTaxPayable += g.taxBeforeCess !== undefined ? g.taxBeforeCess : Math.max(0, gain) * 0.20;
    } else {
      sec50AA += gain;
      const rate = g.taxRate ?? 0.30;
      baseTaxPayable += g.taxBeforeCess !== undefined ? g.taxBeforeCess : Math.max(0, gain) * rate;
    }
  }

  // 112A sequential exemption
  const exemptionRes = calculate112AExemption(ltcg10, ltcg12_5, fy);
  // Add 112A base tax
  const tax112a10BeforeCess = exemptionRes.taxable10 * 0.10;
  const tax112a12_5BeforeCess = exemptionRes.taxable12_5 * 0.125;
  baseTaxPayable += tax112a10BeforeCess + tax112a12_5BeforeCess;

  const cess = baseTaxPayable * 0.04;
  const totalTax = baseTaxPayable + cess;

  const total111A = stcg15 + stcg20;
  const total112A = ltcg10 + ltcg12_5;

  // Build Advance Tax Matrix (Table F)
  const matrix = params.advanceTaxMatrix || buildAdvanceTaxMatrix(details);

  // Invariant verification gate before report export
  verifyItrInvariants({
    ...params,
    fy,
    advanceTaxMatrix: matrix,
    totalExemption: exemptionRes.totalExemption,
  });

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

  const headerBlock = [
    '# ====================================================================================================',
    '# CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)',
    '# ====================================================================================================',
    `# Assessee Name: ${assesseeName} | PAN: ${pan} | FY: ${fy} | AY: ${ay}`,
    `# Total Consideration: Rs ${totalConsideration.toFixed(2)} | Total Cost: Rs ${totalCost.toFixed(2)} | Transfer Expenses: Rs ${totalTransferExpenses.toFixed(2)}`,
    `# Section 111A STCG: Rs ${total111A.toFixed(2)} (Pre: Rs ${stcg15.toFixed(2)} @ 15% | Post: Rs ${stcg20.toFixed(2)} @ 20%)`,
    `# Section 112A LTCG: Rs ${total112A.toFixed(2)} (Pre: Rs ${ltcg10.toFixed(2)} @ 10% | Post: Rs ${ltcg12_5.toFixed(2)} @ 12.5%)`,
    `# Section 112A Exemption Claimed: Rs ${exemptionRes.totalExemption.toFixed(2)} (Exhausted against 10% tranche first)`,
    `# Section 50AA Deemed STCG (Slab): Rs ${sec50AA.toFixed(2)} | Section 112 Debt LTCG: Rs ${sec112Debt.toFixed(2)}`,
    `# Base Tax Payable: Rs ${baseTaxPayable.toFixed(2)} | Health & Education Cess (4%): Rs ${cess.toFixed(2)} | Total Tax: Rs ${totalTax.toFixed(2)}`,
    '# ----------------------------------------------------------------------------------------------------',
    '# ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)',
    '# Quarter,Due Date,Sec 111A (15%),Sec 111A (20%),Sec 112A (10%),Sec 112A (12.5%),Sec 50AA (Slab),Sec 112 Debt,Total Gains',
    ...quartersOrder.map((q) => {
      const qData = matrix.quarters[q] || {
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

      return `# ${q},${dueDates[q]},${qData.stcg15.toFixed(2)},${qData.stcg20.toFixed(2)},${qData.ltcg10.toFixed(2)},${qData.ltcg12_5.toFixed(2)},${qData.slab.toFixed(2)},${debtTotal.toFixed(2)},${rowTotal.toFixed(2)}`;
    }),
    '# ====================================================================================================',
  ];

  const tableHeader =
    'Sr. No.,Folio Number,ISIN,Asset / Scheme Name,Asset Class,Tax Section,Buy Date,Sell Date,Holding Period (Days),Holding Type,Units,Buy NAV (Rs),Sell NAV (Rs),Gross Consideration (Rs),Cost of Acquisition (Rs),FMV as on 31-Jan-2018 (Rs),Total FMV 2018 (Rs),Deemed Cost u/s 55(2)(ac) (Rs),Transfer Expenses / Exit Load (Rs),Net Capital Gain / (Loss) (Rs),Tax Rate (%),Tax Before Cess (Rs),Health & Education Cess (4%) (Rs),Total Tax Payable (Rs),Advance Tax Quarter,Grandfathered Flag,Anchor / Estimate Warning';

  const rows = details.map((g, idx) => {
    const srNo = idx + 1;
    const folioNumber = escapeCSV(g.folioNumber || 'N/A');
    const isin = escapeCSV(g.isin || 'N/A');
    const assetName = escapeCSV(g.assetName || '');
    const assetClass = escapeCSV(g.assetClass || (g.taxType === 'SLAB' ? 'DEBT' : 'EQUITY'));
    const section = escapeCSV(classifySection(g));
    const buyDate = formatDate(g.buyDate);
    const sellDate = formatDate(g.sellDate);
    const holdingPeriodDays = g.holdingPeriodDays !== undefined ? g.holdingPeriodDays : '';
    const holdingType = g.holdingType || (g.taxType === 'LTCG' ? 'Long-Term' : 'Short-Term');
    const units = (g.units || 0).toFixed(3);
    const buyNav = (g.buyNav || 0).toFixed(4);
    const sellNav = (g.sellNav || 0).toFixed(4);
    const grossConsideration = (g.grossConsideration ?? ((g.units || 0) * (g.sellNav || 0))).toFixed(2);
    const costOfAcquisition = (g.costOfAcquisition ?? ((g.units || 0) * (g.buyNav || 0))).toFixed(2);
    const fmv2018 = (g.fmvAsOfJan31_2018 ?? 0).toFixed(4);
    const totalFmv2018 = (g.totalFmvJan31_2018 ?? 0).toFixed(2);
    const deemedCost = (
      g.deemedCostOfAcquisition ?? (g.costOfAcquisition ?? ((g.units || 0) * (g.buyNav || 0)))
    ).toFixed(2);
    const transferExpenses = (g.transferExpenses ?? 0).toFixed(2);
    const gain = (g.gain ?? 0).toFixed(2);
    const taxRate = formatTaxRate(g.taxRate);
    const taxBeforeCess = (g.taxBeforeCess ?? 0).toFixed(2);
    const cessAmount = (g.cess ?? ((g.taxBeforeCess ?? 0) * 0.04)).toFixed(2);
    const totalTaxPayable = (
      g.estimatedTax ?? ((g.taxBeforeCess ?? 0) + (g.cess ?? 0))
    ).toFixed(2);
    const quarter = escapeCSV(g.advanceTaxQuarter || (g.sellDate ? getAdvanceTaxQuarter(g.sellDate) : ''));
    const grandfatheredFlag = g.isGrandfathered ? 'Yes' : 'No';
    const anchorWarning = g.isAnchorDependent ? 'Estimated' : 'Actual';

    return [
      srNo,
      folioNumber,
      isin,
      assetName,
      assetClass,
      section,
      buyDate,
      sellDate,
      holdingPeriodDays,
      holdingType,
      units,
      buyNav,
      sellNav,
      grossConsideration,
      costOfAcquisition,
      fmv2018,
      totalFmv2018,
      deemedCost,
      transferExpenses,
      gain,
      taxRate,
      taxBeforeCess,
      cessAmount,
      totalTaxPayable,
      quarter,
      grandfatheredFlag,
      anchorWarning,
    ].join(',');
  });

  return [...headerBlock, tableHeader, ...rows].join('\n');
}
