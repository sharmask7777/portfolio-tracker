/**
 * @file itr-report-types.ts
 * @module utils/itr-report-types
 * @description Types and interfaces for statutory Capital Gains Tax reports and Schedule CG reporting.
 */

/**
 * Standardized advance tax accrual quarters mapped to Indian fiscal calendar dates (April 1 to March 31).
 */
export const AdvanceTaxQuarter = {
  Q1: 'Q1 (01/04 - 15/06)',
  Q2A: 'Q2a (16/06 - 22/07)',
  Q2B: 'Q2b (23/07 - 15/09)',
  Q3: 'Q3 (16/09 - 15/12)',
  Q4: 'Q4 (16/12 - 15/03)',
  Q5: 'Q5 (16/03 - 31/03)',
} as const;

export type AdvanceTaxQuarter = (typeof AdvanceTaxQuarter)[keyof typeof AdvanceTaxQuarter];

/**
 * Statutory Income Tax Section classifications for Schedule CG reporting.
 */
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

export interface SectionTotalData {
  section: string;
  grossConsideration: number;
  costOfAcquisition: number;
  deemedCostOfAcquisition: number;
  transferExpenses: number;
  totalGain: number;
  taxRate: number;
  taxBeforeCess: number;
  cess: number;
  totalTax: number;
}

export interface ITRSummary {
  assesseeName?: string;
  userName?: string;
  pan?: string;
  details?: ITRGainDetail[];
  hasSyntheticAnchors?: boolean;
  tableF?: AdvanceTaxAccrualMatrix;
  sectionTotals?: Record<string, SectionTotalData>;
  realized?: {
    stcg?: number;
    ltcg?: number;
    slab?: number;
    total?: number;
    taxableSTCG?: number;
    taxableStcg?: number;
    taxableLTCG?: number;
    taxableLtcg?: number;
    taxableSlab?: number;
    sec112aExemption?: number;
    sec112aExemptionLimit?: number;
    details?: ITRGainDetail[];
    tableF?: AdvanceTaxAccrualMatrix;
    sectionTotals?: Record<string, SectionTotalData>;
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
