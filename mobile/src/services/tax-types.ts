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

export interface SimulationLot {
  lotId: string;
  buyDate: string;
  units: number;
  buyPrice: number;
  fmv2018?: number | undefined;
  isElss?: boolean | undefined;
}

export interface SimulationSellRequest {
  folioId: string;
  schemeName: string;
  isElss?: boolean | undefined;
  assetClass: 'EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER';
  lots: SimulationLot[];
  unitsToSell: number;
  sellPrice: number;
  sellDate: string;
  taxSlab: number;
  exitLoadRate?: number | undefined;
  exitLoadDays?: number | undefined;
}

export interface MatchedLotResult {
  lotId: string;
  units: number;
  buyDate: string;
  holdingDays: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB';
  taxRate: number;
  deemedCost: number;
  gain: number;
  baseTax: number;
  cess: number;
  totalTax: number;
}

export interface SimulationSellResult {
  schemeName: string;
  unitsRequested: number;
  unitsSold: number;
  lockedUnits: number;
  isLocked: boolean;
  grossValue: number;
  totalCost: number;
  deemedCost: number;
  totalGain: number;
  stcgGain: number;
  ltcgGain: number;
  slabGain: number;
  exitLoad: number;
  baseTax: number;
  cess: number;
  totalTax: number;
  netProceeds: number;
  matchedLots: MatchedLotResult[];
  warnings: string[];
}

export interface HarvestOpportunity {
  folioId: string;
  schemeName: string;
  isin?: string | undefined;
  currentUnits: number;
  unitsToHarvest: number;
  currentNav: number;
  costNav: number;
  currentValue: number;
  unrealizedGain: number;
  holdingDays: number;
  lotsCount: number;
  firstLotDate?: string | undefined;
  lastLotDate?: string | undefined;
}

export interface HarvestPlan {
  fy: string;
  ltcgLimit: number;
  realizedLtcgCurrentFY: number;
  remainingExemption: number;
  totalPotentialHarvest: number;
  estimatedTaxSavings: number;
  opportunities: HarvestOpportunity[];
  instructions: string;
}

export interface DeemedCostParams {
  cost: number;
  fmv2018?: number | undefined;
  sellPrice: number;
  isPre2018?: boolean | undefined;
}

export interface ClassifyTaxParams {
  taxType: string;
  assetClass?: string | undefined;
  taxRate?: number | undefined;
  isGrandfathered?: boolean | undefined;
  sellDate?: string | undefined;
}

export interface GainItemInput {
  gain: number;
  sellDate?: string | undefined;
  advanceTaxQuarter?: string | undefined;
  section?: string | undefined;
  taxType?: string | undefined;
  assetClass?: string | undefined;
  taxRate?: number | undefined;
  isGrandfathered?: boolean | undefined;
  taxBeforeCess?: number | undefined;
  cess?: number | undefined;
  estimatedTax?: number | undefined;
}

export interface HoldingHarvestInput {
  folioId: string;
  schemeName: string;
  isin?: string | undefined;
  isElss?: boolean | undefined;
  currentUnits: number;
  currentNav: number;
  lots: SimulationLot[];
}

export interface LotAllocationCtx {
  sellPrice: number;
  sellDate: string;
  assetClass: 'EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER';
  taxSlab: number;
  exitLoadRate?: number | undefined;
  exitLoadDays?: number | undefined;
}

export interface Exemption112AResult {
  exempt10: number;
  exempt12_5: number;
  totalExemption: number;
  taxable10: number;
  taxable12_5: number;
  tax10: number;
  tax12_5: number;
  totalTax: number;
}

export interface GainsAcc {
  stcg15: number;
  stcg20: number;
  ltcg10: number;
  ltcg12_5: number;
  debtLtcg20: number;
  debtLtcg12_5: number;
  slab: number;
  stcg15Tax: number;
  stcg20Tax: number;
  debtTax: number;
  slabTax: number;
}

export interface GainInputSlice {
  gain: number;
  section?: string | undefined;
  taxBeforeCess?: number | undefined;
  taxRate?: number | undefined;
}
