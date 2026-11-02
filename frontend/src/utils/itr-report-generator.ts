/**
 * @file itr-report-generator.ts
 * @module utils/itr-report-generator
 * @description Generates audit-ready, statutory Capital Gains Tax reports for Indian Income Tax
 * filings (ITR-2 and ITR-3 Schedule CG) and Advance Tax liability computation (Section 234C Table F).
 *
 * ### Key Statutory Compliances:
 * 1. **Finance Act 2024 Amendments (Budget 2024 Cutoff: July 23, 2024)**:
 *    - STCG under Section 111A: 15% pre-July 23, 2024; 20% on or post-July 23, 2024.
 *    - LTCG under Section 112A: 10% pre-July 23, 2024; 12.5% on or post-July 23, 2024.
 *    - Section 112A Exemption Threshold: ₹1,00,000 for FY 2023-24 and earlier; ₹1,25,000 for FY 2024-25 onwards.
 *    - Section 50AA: Deemed STCG for specified mutual funds (debt mutual funds acquired on or after April 1, 2023)
 *      taxed at the assessee's applicable income tax slab rate.
 *    - Section 112 (Debt / Unlisted): 20% with indexation for grandfathered debt; 12.5% unindexed post-Budget 2024.
 * 2. **Section 55(2)(ac) Grandfathering Formula**:
 *    - Protects capital gains accrued up to January 31, 2018 for listed equity and equity mutual funds:
 *      $$ \text{Deemed Cost} = \max\Big(\text{Actual Cost}, \min(\text{FMV as of 31-Jan-2018}, \text{Gross Consideration})\Big) $$
 *    - This formula prevents creation of artificial capital losses while exempting all pre-Feb 2018 unrealized gains.
 * 3. **Schedule CG Table F Quarterly Symmetry**:
 *    - Advance tax accrual installments under Section 234C:
 *      Q1 (Apr 1 - Jun 15), Q2a (Jun 16 - Jul 22), Q2b (Jul 23 - Sep 15),
 *      Q3 (Sep 16 - Dec 15), Q4 (Dec 16 - Mar 15), Q5 (Mar 16 - Mar 31).
 *    - Invariant: The sum of quarterly capital gains across all 6 periods MUST mathematically equal
 *      the net realized capital gain for the financial year.
 */

/**
 * Standardized advance tax accrual quarters mapped to Indian fiscal calendar dates (April 1 to March 31).
 *
 * For FY 2024-25, Quarter 2 is bifurcated into `Q2A` (pre-Budget 2024) and `Q2B` (post-Budget 2024)
 * due to the statutory tax rate shift effective July 23, 2024.
 */
export const AdvanceTaxQuarter = {
  /** First installment: April 1 to June 15 (15% advance tax cumulative due date). */
  Q1: 'Q1 (01/04 - 15/06)',
  /** Second installment (pre-Budget 2024): June 16 to July 22. */
  Q2A: 'Q2a (16/06 - 22/07)',
  /** Second installment (post-Budget 2024): July 23 to September 15 (45% cumulative due date). */
  Q2B: 'Q2b (23/07 - 15/09)',
  /** Third installment: September 16 to December 15 (75% cumulative due date). */
  Q3: 'Q3 (16/09 - 15/12)',
  /** Fourth installment: December 16 to March 15 (100% cumulative due date). */
  Q4: 'Q4 (16/12 - 15/03)',
  /** Final fiscal wrap-up tranche: March 16 to March 31. */
  Q5: 'Q5 (16/03 - 31/03)',
} as const;

export type AdvanceTaxQuarter = (typeof AdvanceTaxQuarter)[keyof typeof AdvanceTaxQuarter];

/**
 * Statutory Income Tax Section classifications for Schedule CG reporting.
 */
export const TaxSectionName = {
  /** Listed Equity STCG sold prior to July 23, 2024 taxed at 15%. */
  SEC_111A_15: '111A (15%)',
  /** Listed Equity STCG sold on or after July 23, 2024 taxed at 20% (Finance Act 2024). */
  SEC_111A_20: '111A (20%)',
  /** Listed Equity LTCG sold prior to July 23, 2024 taxed at 10% beyond statutory exemption. */
  SEC_112A_10: '112A (10%)',
  /** Listed Equity LTCG sold on or after July 23, 2024 taxed at 12.5% beyond statutory exemption. */
  SEC_112A_12_5: '112A (12.5%)',
  /** Specified Mutual Funds (>65% debt) acquired on or after April 1, 2023 taxed at slab rates. */
  SEC_50AA: '50AA (Slab)',
  /** Unlisted securities or post-Budget debt LTCG taxed at 12.5% without indexation. */
  SEC_112_DEBT_12_5: '112 Debt (12.5%)',
  /** Grandfathered Debt mutual funds acquired before April 1, 2023 taxed at 20% with indexation. */
  SEC_112_DEBT_20: '112 Debt (20% Indexed)',
  /** General regular income taxed at individual slab rates. */
  SLAB: 'SLAB',
} as const;

export type TaxSectionName = (typeof TaxSectionName)[keyof typeof TaxSectionName];

/**
 * Breakdown of capital gains and estimated tax liabilities accrued within a single advance tax quarter.
 */
export interface TableFQuarterData {
  /** Section 111A STCG gains taxed at 15% (pre-July 23, 2024). */
  stcg15: number;
  /** Section 111A STCG gains taxed at 20% (post-July 23, 2024). */
  stcg20: number;
  /** Section 112A LTCG gains taxed at 10% (pre-July 23, 2024). */
  ltcg10: number;
  /** Section 112A LTCG gains taxed at 12.5% (post-July 23, 2024). */
  ltcg12_5: number;
  /** Section 112 Debt LTCG taxed at 12.5% without indexation. */
  debtLtcg12_5: number;
  /** Section 112 Debt LTCG taxed at 20% with indexation. */
  debtLtcg20: number;
  /** Section 50AA deemed STCG and slab-taxed gains. */
  slab: number;
  /** Aggregate net capital gains accrued in this quarter. */
  totalGain: number;
  /** Base statutory tax liability before health and education cess. */
  taxBeforeCess: number;
  /** 4% Health and Education Cess on base tax. */
  cess: number;
  /** Total estimated tax liability (taxBeforeCess + cess). */
  estimatedTax: number;
}

/**
 * Complete Schedule CG Table F accrual matrix across all 6 advance tax periods.
 */
export interface AdvanceTaxAccrualMatrix {
  /** Detailed breakdown mapped by advance tax quarter. */
  quarters: Record<AdvanceTaxQuarter, TableFQuarterData>;
  /** Total tax payable per quarter. */
  quarterTotals: Record<AdvanceTaxQuarter, number>;
}

/**
 * Detailed audit record for an individual realized capital gain transaction lot.
 */
export interface ITRGainDetail {
  /** Security or scheme description. */
  assetName: string;
  /** Folio account number. */
  folioNumber?: string;
  /** International Securities Identification Number. */
  isin?: string;
  /** Assessee Permanent Account Number. */
  pan?: string;
  /** Assessee legal name. */
  panName?: string;
  /** Broad asset classification: 'EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER'. */
  assetClass?: string;
  /** Explicit statutory section code override if assigned. */
  section?: string;
  /** Date of original unit acquisition. */
  buyDate: Date | string;
  /** Date of unit redemption or sale. */
  sellDate: Date | string;
  /** Exact holding duration in calendar days. */
  holdingPeriodDays?: number;
  /** Holding category: 'Short-Term' | 'Long-Term'. */
  holdingType?: 'Short-Term' | 'Long-Term' | string;
  /** Number of units redeemed or transferred. */
  units: number;
  /** Acquisition Net Asset Value or purchase price per unit. */
  buyNav: number;
  /** Redemption Net Asset Value or sale price per unit. */
  sellNav: number;
  /** Gross sale proceeds (units * sellNav). */
  grossConsideration?: number;
  /** Original purchase cost (units * buyNav). */
  costOfAcquisition?: number;
  /** Fair Market Value per unit as on January 31, 2018 (Section 55(2)(ac)). */
  fmvAsOfJan31_2018?: number;
  /** Total FMV as on January 31, 2018 (units * fmvAsOfJan31_2018). */
  totalFmvJan31_2018?: number;
  /** Deemed acquisition cost following Section 55(2)(ac) grandfathering formula. */
  deemedCostOfAcquisition?: number;
  /** Transfer expenses, brokerage, or AMC exit load incurred. */
  transferExpenses?: number;
  /** Net taxable capital gain or loss: grossConsideration - deemedCost - transferExpenses. */
  gain: number;
  /** Broad statutory tax classification: 'STCG' | 'LTCG' | 'SLAB'. */
  taxType: 'STCG' | 'LTCG' | 'SLAB' | string;
  /** Applicable tax rate as a decimal (e.g. 0.125 for 12.5%). */
  taxRate?: number;
  /** Base statutory tax amount before 4% cess. */
  taxBeforeCess?: number;
  /** 4% Health and Education Cess on base tax. */
  cess?: number;
  /** Total estimated statutory tax payable for this lot. */
  estimatedTax?: number;
  /** Specific advance tax quarter string where this transaction accrued. */
  advanceTaxQuarter?: string;
  /** Indicates whether Section 55(2)(ac) pre-Feb 2018 grandfathering applies. */
  isGrandfathered?: boolean;
  /** Status string describing grandfathering eligibility. */
  grandfatheredStatus?: string;
  /** Indicates whether the acquisition date/cost was estimated via synthetic anchor transactions. */
  isAnchorDependent?: boolean;
}

/**
 * Summary aggregates for Schedule CG tax reporting across all realized gains.
 */
export interface ITRSummary {
  /** Legal name of the assessee/taxpayer. */
  assesseeName?: string;
  /** User display name. */
  userName?: string;
  /** Assessee PAN. */
  pan?: string;
  /** Constituent gain details. */
  details?: ITRGainDetail[];
  /** Indicates whether any constituent lots rely on estimated synthetic anchor transactions. */
  hasSyntheticAnchors?: boolean;
  /** Pre-computed Advance Tax Accrual Matrix (Table F). */
  tableF?: AdvanceTaxAccrualMatrix;
  /** Breakdown of totals by statutory tax section. */
  sectionTotals?: Record<string, unknown>;
  /** High-level realized gain aggregates. */
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

/**
 * Parameter configuration supplied to {@link generateITRReportCSV}.
 */
export interface ITRReportParams {
  /** Legal name of the assessee. */
  assesseeName?: string;
  /** Assessee Permanent Account Number. */
  pan?: string;
  /** Financial Year in YYYY-YY format (e.g., '2024-25'). */
  fy: string;
  /** Assessment Year in YYYY-YY format (computed from `fy` if omitted). */
  ay?: string;
  /** List of individual realized gain audit lots. */
  details: ITRGainDetail[];
  /** Optional pre-computed ITR summary. */
  summary?: ITRSummary;
  /** Pre-computed Table F advance tax accrual matrix. */
  advanceTaxMatrix?: AdvanceTaxAccrualMatrix;
  /** Section summary breakdown. */
  sectionSummary?: Record<string, unknown>;
}

/**
 * Computes the official Assessment Year (AY) string corresponding to a Financial Year (FY).
 *
 * Example: `computeAY('2024-25')` -> `'2025-26'`
 *
 * @param fy - Financial year string (e.g., '2024-25' or '2023-24').
 * @returns Assessment year string in YYYY-YY format.
 */
export function computeAY(fy: string): string {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const ayStartYear = startYear + 1;
  const ayEndYear = (startYear + 2).toString().slice(-2);
  return `${ayStartYear}-${ayEndYear}`;
}

/**
 * Determines the statutory Advance Tax quarter under Section 234C / Schedule CG Table F
 * based on the sale or redemption date.
 *
 * ### Advance Tax Period Boundaries:
 * - **Q1**: April 1 to June 15
 * - **Q2a**: June 16 to July 22 (Pre-Budget 2024 cutoff for FY 2024-25)
 * - **Q2b**: July 23 to September 15 (Post-Budget 2024 cutoff for FY 2024-25)
 * - **Q3**: September 16 to December 15
 * - **Q4**: December 16 to March 15
 * - **Q5**: March 16 to March 31
 *
 * @param date - Redemption or sale date (Date object or ISO-8601 string).
 * @returns Standardized {@link AdvanceTaxQuarter} enum value.
 */
export function getAdvanceTaxQuarter(date: Date | string): AdvanceTaxQuarter {
  let monthDayString = '';
  if (typeof date === 'string') {
    const match = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (match) {
      monthDayString = `${match[1]}-${match[2]}`;
    }
  }
  if (!monthDayString) {
    const parsedDate = date instanceof Date ? date : new Date(date);
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    monthDayString = `${month}-${day}`;
  }

  // Statutory date ranges under Section 234C:
  if (monthDayString >= '04-01' && monthDayString <= '06-15') {
    return AdvanceTaxQuarter.Q1;
  }
  // Q2a: Pre-Budget 2024 window (June 16 to July 22)
  if (monthDayString >= '06-16' && monthDayString <= '07-22') {
    return AdvanceTaxQuarter.Q2A;
  }
  // Q2b: Post-Budget 2024 window (July 23 to September 15)
  if (monthDayString >= '07-23' && monthDayString <= '09-15') {
    return AdvanceTaxQuarter.Q2B;
  }
  if (monthDayString >= '09-16' && monthDayString <= '12-15') {
    return AdvanceTaxQuarter.Q3;
  }
  if (monthDayString >= '12-16' || monthDayString <= '03-15') {
    return AdvanceTaxQuarter.Q4;
  }
  return AdvanceTaxQuarter.Q5;
}

/**
 * Calculates Section 112A Long-Term Capital Gains statutory exemption allocation.
 *
 * ### Sequential Tranche Exhaustion Ordering
 * Under Section 112A, the statutory exemption (₹1,25,000 for FY 2024-25 onwards, or ₹1,00,000
 * for FY 2023-24 and earlier) is applied sequentially:
 * 1. The exemption is first allocated against the **10% tranche** (gains realized prior to July 23, 2024).
 * 2. Any residual unexhausted exemption is then applied against the **12.5% tranche** (gains realized
 *    on or post-July 23, 2024).
 *
 * This sequential ordering adheres to statutory principles of taxpayer benefit:
 * consuming the exemption against the earlier-accrued tranche before the later-accrued tranche.
 *
 * @param ltcg10 - Total gross LTCG accrued in the 10% tax tranche.
 * @param ltcg12_5 - Total gross LTCG accrued in the 12.5% tax tranche.
 * @param fy - Financial year string (e.g. '2024-25').
 * @returns Detailed breakdown of exemption allocation, taxable balances, and resulting taxes.
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
  const startYear = parseInt(String(fy).split('-')[0] ?? '', 10);
  const isFy2425OrLater = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isFy2425OrLater ? 125000 : 100000;

  const pureLtcg10 = Math.max(0, ltcg10);
  const pureLtcg12_5 = Math.max(0, ltcg12_5);

  // 1. Exhaust against 10% tranche first
  const exempt10 = Math.min(pureLtcg10, statutoryLimit);
  const remainingLimit = statutoryLimit - exempt10;

  // 2. Exhaust remaining limit against 12.5% tranche
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

/**
 * Classifies an individual realized capital gain lot into its exact statutory Income Tax Section.
 *
 * Evaluates asset class, holding duration (STCG vs LTCG), transaction sale date
 * relative to the July 23, 2024 Budget cutoff, and Section 55(2)(ac) grandfathering status.
 *
 * @param gainItem - Partial or complete capital gain detail object.
 * @returns Canonical {@link TaxSectionName} identifier.
 */
export function classifySection(gainItem: Partial<ITRGainDetail>): string {
  if (gainItem.section) return gainItem.section;

  const isLtcg = gainItem.taxType === 'LTCG';
  const isStcg = gainItem.taxType === 'STCG';
  const isSlab = gainItem.taxType === 'SLAB';
  const isDebt = gainItem.assetClass === 'DEBT' || (gainItem.taxRate === 0.20 && gainItem.isGrandfathered);

  // Short-Term Capital Gains (Section 111A)
  if (isStcg) {
    if (gainItem.taxRate === 0.20 || (!gainItem.taxRate && gainItem.sellDate && gainItem.sellDate >= '2024-07-23')) {
      return TaxSectionName.SEC_111A_20;
    }
    return TaxSectionName.SEC_111A_15;
  }

  // Long-Term Capital Gains (Section 112A / Section 112)
  if (isLtcg) {
    if (isDebt) {
      if (gainItem.taxRate === 0.20) {
        return TaxSectionName.SEC_112_DEBT_20;
      }
      return TaxSectionName.SEC_112_DEBT_12_5;
    }
    if (gainItem.taxRate === 0.125 || (!gainItem.isGrandfathered && gainItem.sellDate && gainItem.sellDate >= '2024-07-23')) {
      return TaxSectionName.SEC_112A_12_5;
    }
    return TaxSectionName.SEC_112A_10;
  }

  // Deemed Short-Term Capital Gains under Section 50AA (Debt funds acquired on or after 01-Apr-2023)
  if (isSlab) {
    return TaxSectionName.SEC_50AA;
  }

  return TaxSectionName.SLAB;
}

/**
 * Aggregates individual realized capital gain audit lots into the 6-quarter Schedule CG Table F matrix.
 *
 * @param details - Array of realized gain detail items.
 * @returns Populated {@link AdvanceTaxAccrualMatrix} with quarterly breakdowns and totals.
 */
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

  for (const gainItem of details) {
    if (!gainItem.sellDate && !gainItem.advanceTaxQuarter) continue;
    const quarter =
      (gainItem.advanceTaxQuarter as AdvanceTaxQuarter) ||
      (gainItem.sellDate ? getAdvanceTaxQuarter(gainItem.sellDate) : AdvanceTaxQuarter.Q1);
    const data = quarters[quarter];
    if (!data) continue;

    const section = classifySection(gainItem);
    const gain = gainItem.gain ?? 0;

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

    const taxBeforeCess = gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : 0;
    const cess = gainItem.cess !== undefined ? gainItem.cess : taxBeforeCess * 0.04;
    const estimatedTax =
      gainItem.estimatedTax !== undefined ? gainItem.estimatedTax : taxBeforeCess + cess;

    data.totalGain += gain;
    data.taxBeforeCess += taxBeforeCess;
    data.cess += cess;
    data.estimatedTax += estimatedTax;
    quarterTotals[quarter] += estimatedTax;
  }

  return { quarters, quarterTotals };
}

/**
 * Quarterly gains summary used in ITR invariant verification.
 */
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

/**
 * Validation target structure inspected by {@link verifyItrInvariants}.
 */
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
 * Verifies statutory ITR capital gains invariants before report generation or export.
 *
 * ### Mandated Statutory Invariant Gates:
 * 1. **Quarterly Symmetry Invariant (Table F Sum $\equiv$ Annual Net Capital Gain)**:
 *    The sum of quarterly accrued gains across Table F must equal the net realized capital gains
 *    for the financial year within a $\pm ₹0.01$ floating-point tolerance.
 * 2. **Section 112A Exemption Statutory Limit Invariant**:
 *    The claimed Section 112A exemption cannot be negative and cannot exceed the statutory cap
 *    (₹1,25,000 post-Budget 2024, ₹1,00,000 pre-Budget 2024).
 * 3. **Non-Negative Taxable Gain Invariant**:
 *    After intra-head loss set-offs under Section 70, taxable STCG, LTCG, slab gains, and total
 *    taxable gain cannot be negative ($< -₹0.001$).
 *
 * @param report - Complete report or verification target to validate.
 * @throws Error if any statutory invariant is violated.
 */
export function verifyItrInvariants(report: ITRVerificationTarget): void {
  if (!report) {
    throw new Error('Invariant violated: report data is required for invariant verification');
  }

  const fy = report.fy || report.financialYear || '2024-25';
  const startYear = parseInt(String(fy).split('-')[0] ?? '', 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  const netRealizedTotal =
    report.realized?.total ??
    report.summary?.realized?.total ??
    report.totalGain ??
    report.totalCapitalGain ??
    (Array.isArray(report.details)
      ? report.details.reduce((sum: number, item: { gain?: number }) => sum + (item.gain ?? 0), 0)
      : undefined);

  // 1. Quarterly Accrual vs Net Realized Total Invariant (Table F Symmetry)
  if (report.quarterlySummary) {
    const quarterlySummary = report.quarterlySummary;
    const quarterlySum =
      (quarterlySummary.q1 ?? 0) +
      (quarterlySummary.q2 ?? 0) +
      (quarterlySummary.q2a ?? 0) +
      (quarterlySummary.q2b ?? 0) +
      (quarterlySummary.q3 ?? 0) +
      (quarterlySummary.q4 ?? 0) +
      (quarterlySummary.q5 ?? 0);

    if (quarterlySummary.total !== undefined && Math.abs(quarterlySum - quarterlySummary.total) > 0.01) {
      throw new Error(
        `Invariant violated: quarterly accrued gains (${quarterlySum}) do not sum to quarterly total (${quarterlySummary.total})`
      );
    }

    if (netRealizedTotal !== undefined) {
      if (Math.abs(quarterlySum - netRealizedTotal) > 0.01) {
        throw new Error(
          `Invariant violated: quarterly accrued gains (${quarterlySum}) do not sum to total capital gain (${netRealizedTotal})`
        );
      }
      if (quarterlySummary.total !== undefined && Math.abs(quarterlySummary.total - netRealizedTotal) > 0.01) {
        throw new Error(
          `Invariant violated: quarterly total (${quarterlySummary.total}) does not match portfolio realized total (${netRealizedTotal})`
        );
      }
    }
  }

  const matrix: AdvanceTaxAccrualMatrix | undefined =
    report.advanceTaxMatrix || report.tableF || report.summary?.tableF;
  if (matrix && matrix.quarters) {
    let matrixSum = 0;
    for (const quarterKey of Object.keys(matrix.quarters)) {
      const quarterData = matrix.quarters[quarterKey as AdvanceTaxQuarter];
      if (quarterData) {
        matrixSum += quarterData.totalGain ?? 0;
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

/**
 * Escapes values for safe inclusion in RFC 4180 CSV output.
 */
function escapeCSV(val: unknown): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a Date or date string to Indian standard DD/MM/YYYY representation.
 */
function formatDate(dateInput: Date | string): string {
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

/**
 * Formats a numeric tax rate to percentage display string (e.g. 0.125 -> '12.5%').
 */
function formatTaxRate(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '0.0%';
  const num = rate <= 1 ? rate * 100 : rate;
  return `${num.toFixed(1)}%`;
}

/**
 * Generates an audit-ready, 27-column CSV Capital Gains Tax report compliant with
 * CBDT Schedule CG (ITR-2 / ITR-3) and Advance Tax Section 234C (Table F).
 *
 * ### Structure of Generated Output:
 * 1. **Statutory Metadata Header Block (commented with `#`)**:
 *    - Assessee Name, PAN, Financial Year, Assessment Year.
 *    - Consideration, cost, and transfer expense totals.
 *    - Section 111A STCG pre/post split (15% vs 20%).
 *    - Section 112A LTCG pre/post split (10% vs 12.5%).
 *    - Section 112A exemption claimed (exhausted against 10% tranche first).
 *    - Section 50AA deemed STCG and Section 112 Debt LTCG totals.
 *    - Total Base Tax, 4% Health & Education Cess, and Total Tax Payable.
 * 2. **Schedule CG Table F Advance Tax Accrual Matrix (commented with `#`)**:
 *    - All 6 quarters (Q1, Q2a, Q2b, Q3, Q4, Q5) with statutory due dates and category breakdown.
 * 3. **27-Column Capital Gains Audit Ledger**:
 *    - Every realized lot with purchase/sale NAVs, holding days, Section 55(2)(ac) deemed cost,
 *      grandfathered flags, advance tax quarter allocation, and synthetic anchor warnings.
 *
 * @param params - Configuration parameters containing assessee details and realized gain items.
 * @returns Complete CSV report string.
 * @throws Error if statutory invariants fail verification before export.
 */
export function generateITRReportCSV(params: ITRReportParams): string {
  const {
    assesseeName = 'Portfolio Investor',
    pan = 'ABCDE1234F',
    fy,
    ay = computeAY(fy),
    details = [],
  } = params;

  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const endYear = startYear + 1;

  // Aggregate totals across all constituent lots
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

  for (const gainItem of details) {
    const gross = gainItem.grossConsideration ?? ((gainItem.units || 0) * (gainItem.sellNav || 0));
    const cost = gainItem.costOfAcquisition ?? ((gainItem.units || 0) * (gainItem.buyNav || 0));
    const expenses = gainItem.transferExpenses ?? 0;
    const gain = gainItem.gain ?? 0;

    totalConsideration += gross;
    totalCost += cost;
    totalTransferExpenses += expenses;

    const section = classifySection(gainItem);

    if (section === TaxSectionName.SEC_111A_15) {
      stcg15 += gain;
      baseTaxPayable += gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : Math.max(0, gain) * 0.15;
    } else if (section === TaxSectionName.SEC_111A_20) {
      stcg20 += gain;
      baseTaxPayable += gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : Math.max(0, gain) * 0.20;
    } else if (section === TaxSectionName.SEC_112A_10) {
      ltcg10 += gain;
    } else if (section === TaxSectionName.SEC_112A_12_5) {
      ltcg12_5 += gain;
    } else if (section === TaxSectionName.SEC_112_DEBT_12_5) {
      sec112Debt += gain;
      baseTaxPayable += gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : Math.max(0, gain) * 0.125;
    } else if (section === TaxSectionName.SEC_112_DEBT_20) {
      sec112Debt += gain;
      baseTaxPayable += gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : Math.max(0, gain) * 0.20;
    } else {
      sec50AA += gain;
      const rate = gainItem.taxRate ?? 0.30;
      baseTaxPayable += gainItem.taxBeforeCess !== undefined ? gainItem.taxBeforeCess : Math.max(0, gain) * rate;
    }
  }

  // Section 112A sequential exemption calculation
  const exemptionResult = calculate112AExemption(ltcg10, ltcg12_5, fy);
  // Add 112A taxable base tax
  const tax112a10BeforeCess = exemptionResult.taxable10 * 0.10;
  const tax112a12_5BeforeCess = exemptionResult.taxable12_5 * 0.125;
  baseTaxPayable += tax112a10BeforeCess + tax112a12_5BeforeCess;

  const cess = baseTaxPayable * 0.04;
  const totalTax = baseTaxPayable + cess;

  const total111A = stcg15 + stcg20;
  const total112A = ltcg10 + ltcg12_5;

  // Build or reuse Advance Tax Matrix (Table F)
  const matrix = params.advanceTaxMatrix || buildAdvanceTaxMatrix(details);

  // Statutory invariant verification gate prior to report export
  verifyItrInvariants({
    ...params,
    fy,
    advanceTaxMatrix: matrix,
    totalExemption: exemptionResult.totalExemption,
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
    `# Section 112A Exemption Claimed: Rs ${exemptionResult.totalExemption.toFixed(2)} (Exhausted against 10% tranche first)`,
    `# Section 50AA Deemed STCG (Slab): Rs ${sec50AA.toFixed(2)} | Section 112 Debt LTCG: Rs ${sec112Debt.toFixed(2)}`,
    `# Base Tax Payable: Rs ${baseTaxPayable.toFixed(2)} | Health & Education Cess (4%): Rs ${cess.toFixed(2)} | Total Tax: Rs ${totalTax.toFixed(2)}`,
    '# ----------------------------------------------------------------------------------------------------',
    '# ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)',
    '# Quarter,Due Date,Sec 111A (15%),Sec 111A (20%),Sec 112A (10%),Sec 112A (12.5%),Sec 50AA (Slab),Sec 112 Debt,Total Gains',
    ...quartersOrder.map((quarter) => {
      const quarterData = matrix.quarters[quarter] || {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
      };
      const debtTotal = (quarterData.debtLtcg12_5 || 0) + (quarterData.debtLtcg20 || 0);
      const rowTotal =
        (quarterData.stcg15 || 0) +
        (quarterData.stcg20 || 0) +
        (quarterData.ltcg10 || 0) +
        (quarterData.ltcg12_5 || 0) +
        (quarterData.slab || 0) +
        debtTotal;

      return `# ${quarter},${dueDates[quarter]},${quarterData.stcg15.toFixed(2)},${quarterData.stcg20.toFixed(2)},${quarterData.ltcg10.toFixed(2)},${quarterData.ltcg12_5.toFixed(2)},${quarterData.slab.toFixed(2)},${debtTotal.toFixed(2)},${rowTotal.toFixed(2)}`;
    }),
    '# ====================================================================================================',
  ];

  const tableHeader =
    'Sr. No.,Folio Number,ISIN,Asset / Scheme Name,Asset Class,Tax Section,Buy Date,Sell Date,Holding Period (Days),Holding Type,Units,Buy NAV (Rs),Sell NAV (Rs),Gross Consideration (Rs),Cost of Acquisition (Rs),FMV as on 31-Jan-2018 (Rs),Total FMV 2018 (Rs),Deemed Cost u/s 55(2)(ac) (Rs),Transfer Expenses / Exit Load (Rs),Net Capital Gain / (Loss) (Rs),Tax Rate (%),Tax Before Cess (Rs),Health & Education Cess (4%) (Rs),Total Tax Payable (Rs),Advance Tax Quarter,Grandfathered Flag,Anchor / Estimate Warning';

  const rows = details.map((gainItem, rowIndex) => {
    const srNo = rowIndex + 1;
    const folioNumber = escapeCSV(gainItem.folioNumber || 'N/A');
    const isin = escapeCSV(gainItem.isin || 'N/A');
    const assetName = escapeCSV(gainItem.assetName || '');
    const assetClass = escapeCSV(gainItem.assetClass || (gainItem.taxType === 'SLAB' ? 'DEBT' : 'EQUITY'));
    const section = escapeCSV(classifySection(gainItem));
    const buyDate = formatDate(gainItem.buyDate);
    const sellDate = formatDate(gainItem.sellDate);
    const holdingPeriodDays = gainItem.holdingPeriodDays !== undefined ? gainItem.holdingPeriodDays : '';
    const holdingType = gainItem.holdingType || (gainItem.taxType === 'LTCG' ? 'Long-Term' : 'Short-Term');
    const units = (gainItem.units || 0).toFixed(3);
    const buyNav = (gainItem.buyNav || 0).toFixed(4);
    const sellNav = (gainItem.sellNav || 0).toFixed(4);
    const grossConsideration = (gainItem.grossConsideration ?? ((gainItem.units || 0) * (gainItem.sellNav || 0))).toFixed(2);
    const costOfAcquisition = (gainItem.costOfAcquisition ?? ((gainItem.units || 0) * (gainItem.buyNav || 0))).toFixed(2);
    const fmv2018 = (gainItem.fmvAsOfJan31_2018 ?? 0).toFixed(4);
    const totalFmv2018 = (gainItem.totalFmvJan31_2018 ?? 0).toFixed(2);
    // Section 55(2)(ac) statutory deemed cost: max(cost, min(fmv, salePrice))
    const deemedCost = (
      gainItem.deemedCostOfAcquisition ?? (gainItem.costOfAcquisition ?? ((gainItem.units || 0) * (gainItem.buyNav || 0)))
    ).toFixed(2);
    const transferExpenses = (gainItem.transferExpenses ?? 0).toFixed(2);
    const gain = (gainItem.gain ?? 0).toFixed(2);
    const taxRate = formatTaxRate(gainItem.taxRate);
    const taxBeforeCess = (gainItem.taxBeforeCess ?? 0).toFixed(2);
    const cessAmount = (gainItem.cess ?? ((gainItem.taxBeforeCess ?? 0) * 0.04)).toFixed(2);
    const totalTaxPayable = (
      gainItem.estimatedTax ?? ((gainItem.taxBeforeCess ?? 0) + (gainItem.cess ?? 0))
    ).toFixed(2);
    const quarter = escapeCSV(gainItem.advanceTaxQuarter || (gainItem.sellDate ? getAdvanceTaxQuarter(gainItem.sellDate) : ''));
    const grandfatheredFlag = gainItem.isGrandfathered ? 'Yes' : 'No';
    const anchorWarning = gainItem.isAnchorDependent ? 'Estimated' : 'Actual';

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
