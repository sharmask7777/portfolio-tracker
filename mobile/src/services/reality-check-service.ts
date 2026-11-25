/**
 * Reality check display metrics and historical portfolio checkpoint processing.
 *
 * Primary mode: Consumes canonical backend DragDecompositionDto contracts.
 * Fallback mode: Provides offline client-side simulation when backend drags are absent.
 *
 * @module reality-check-service
 */

import type { DragDecompositionDto } from '../types/generated';

export interface RealityCheckAssumptions {
  inflationRate: number;
  taxRate: number;
  horizonYears: number;
}

export const DEFAULT_ASSUMPTIONS: RealityCheckAssumptions = {
  inflationRate: 0.06,
  taxRate: 0.30,
  horizonYears: 3,
};

export interface RealityCheckInput {
  currentValue: number;
  investedCost: number;
  nominalReturn?: number | undefined;
  drags?: DragDecompositionDto | null | undefined;
  assumptions?: Partial<RealityCheckAssumptions> | undefined;
}

export interface DragWaterfallStage {
  step: number;
  label: string;
  rate: number;
  drag: number;
  description: string;
}

export interface RealityCheckResult {
  nominalReturn: number;
  taxDrag: number;
  postTaxReturn: number;
  inflationDrag: number;
  realPostTaxReturn: number;
  nominalGain: number;
  estimatedTax: number;
  postTaxValue: number;
  purchasingPowerValue: number;
  purchasingPowerLoss: number;
  benchmarkSpread: number;
  dragWaterfall: DragWaterfallStage[];
  invariantHolds: boolean;
}

export interface HistoricalRawPoint {
  date: string;
  value: number;
  investedAmount: number;
  unrealizedGain?: number | undefined;
  gainPercentage?: number | undefined;
  isAth?: boolean | undefined;
  athValue?: number | undefined;
  drawdownPercentage?: number | undefined;
}

export interface HistoricalCheckpoint {
  date: string;
  value: number;
  investedAmount: number;
  unrealizedGain: number;
  gainPct: number;
  isAth: boolean;
  athValue: number;
  drawdownPct: number;
}

export type HistoryRangePreset = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

interface ReturnsDecomposition {
  taxDrag: number;
  postTaxReturn: number;
  realPostTaxReturn: number;
  inflationDrag: number;
}

function calculateReturnsDecomposition(
  nominalReturn: number,
  taxRate: number,
  inflationRate: number,
): ReturnsDecomposition {
  const taxDrag = nominalReturn > 0 ? Math.round(nominalReturn * taxRate * 1e6) / 1e6 : 0;
  const postTaxReturn = Math.round((nominalReturn - taxDrag) * 1e6) / 1e6;
  const realPostTaxReturn = Math.round((((1 + postTaxReturn) / (1 + inflationRate)) - 1) * 1e6) / 1e6;
  const inflationDrag = Math.round((postTaxReturn - realPostTaxReturn) * 1e6) / 1e6;
  return { taxDrag, postTaxReturn, realPostTaxReturn, inflationDrag };
}

function calculatePurchasingPowerWealth(
  currentValue: number,
  nominalGain: number,
  assumptions: RealityCheckAssumptions,
): { estimatedTax: number; postTaxValue: number; purchasingPowerValue: number; purchasingPowerLoss: number } {
  const estimatedTax = nominalGain > 0 ? Math.round(nominalGain * assumptions.taxRate * 100) / 100 : 0;
  const postTaxValue = Math.round((currentValue - estimatedTax) * 100) / 100;
  const deflator = Math.pow(1 + assumptions.inflationRate, assumptions.horizonYears);
  const purchasingPowerValue = Math.round((postTaxValue / deflator) * 100) / 100;
  const purchasingPowerLoss = Math.round((currentValue - purchasingPowerValue) * 100) / 100;
  return { estimatedTax, postTaxValue, purchasingPowerValue, purchasingPowerLoss };
}

function computeBenchmarkSpread(realPostTaxReturn: number, taxRate: number, inflationRate: number): number {
  const rfPostTax = 0.065 * (1 - taxRate);
  const rfReal = ((1 + rfPostTax) / (1 + inflationRate)) - 1;
  return Math.round((realPostTaxReturn - rfReal) * 1e6) / 1e6;
}

function buildWaterfallStages(nominalReturn: number, decomp: ReturnsDecomposition): DragWaterfallStage[] {
  const totalTax = decomp.taxDrag;
  const debtDrag = totalTax > 0 ? Math.round(totalTax * 0.30 * 1e6) / 1e6 : 0;
  const equityDrag = totalTax > 0 ? Math.round(totalTax * 0.66 * 1e6) / 1e6 : 0;
  const cessDrag = totalTax > 0 ? Math.round((totalTax - debtDrag - equityDrag) * 1e6) / 1e6 : 0;
  return [
    { step: 1, label: 'Gross Nominal', rate: nominalReturn, drag: 0, description: 'Pre-tax annualized return' },
    { step: 2, label: 'Sec 50AA Debt Drag', rate: debtDrag, drag: -debtDrag, description: 'Slab rate debt fund taxation' },
    { step: 3, label: 'Sec 112A/111A Equity Drag', rate: equityDrag, drag: -equityDrag, description: '12.5% LTCG / 20% STCG equity drag' },
    { step: 4, label: '4% Cess Drag', rate: cessDrag, drag: -cessDrag, description: 'Health & education cess overhead' },
    { step: 5, label: 'CPI Inflation Drag', rate: decomp.inflationDrag, drag: -decomp.inflationDrag, description: 'Purchasing power deflator erosion' },
    { step: 6, label: 'Real Purchasing XIRR', rate: decomp.realPostTaxReturn, drag: 0, description: 'True wealth compounding over inflation' },
  ];
}

function resolveBackendStages(d: DragDecompositionDto): DragWaterfallStage[] {
  if (d.stages && d.stages.length > 0) {
    return d.stages.map((s) => ({
      step: s.step,
      label: s.label,
      rate: s.rate,
      drag: s.drag,
      description: s.description,
    }));
  }
  return [];
}

function resolveBackendValues(input: RealityCheckInput, d: DragDecompositionDto) {
  const nominalGain = Math.round((input.currentValue - input.investedCost) * 100) / 100;
  // Prioritize canonical backend nominalXirr
  const nominalReturn = d.nominalXirr ?? input.nominalReturn ?? 0;
  const postTaxReturn = d.postTaxXirr ?? (nominalReturn - d.totalTaxDrag);
  const realPostTaxReturn = d.realPostTaxXirr ?? (postTaxReturn - d.inflationDrag);
  const postTaxValue = d.postTaxValue ?? input.currentValue;
  const purchasingPowerValue = d.purchasingPowerValue ?? postTaxValue;
  const purchasingPowerLoss = d.purchasingPowerLoss ?? Math.max(0, input.currentValue - purchasingPowerValue);
  return { nominalGain, nominalReturn, postTaxReturn, realPostTaxReturn, postTaxValue, purchasingPowerValue, purchasingPowerLoss };
}

function calculateFromBackendDrags(input: RealityCheckInput, d: DragDecompositionDto): RealityCheckResult {
  const v = resolveBackendValues(input, d);
  const dragWaterfall = resolveBackendStages(d);

  return {
    nominalReturn: v.nominalReturn,
    taxDrag: d.totalTaxDrag,
    postTaxReturn: v.postTaxReturn,
    inflationDrag: d.inflationDrag,
    realPostTaxReturn: v.realPostTaxReturn,
    nominalGain: v.nominalGain,
    estimatedTax: Math.round((input.currentValue - v.postTaxValue) * 100) / 100,
    postTaxValue: v.postTaxValue,
    purchasingPowerValue: v.purchasingPowerValue,
    purchasingPowerLoss: v.purchasingPowerLoss,
    benchmarkSpread: d.benchmarkSpread ?? 0,
    dragWaterfall,
    invariantHolds: v.realPostTaxReturn <= v.postTaxReturn + 1e-5 && v.postTaxReturn <= v.nominalReturn + 1e-5,
  };
}

function calculateFromClientAssumptions(input: RealityCheckInput): RealityCheckResult {
  const assumptions: RealityCheckAssumptions = { ...DEFAULT_ASSUMPTIONS, ...input.assumptions };
  const nominalGain = Math.round((input.currentValue - input.investedCost) * 100) / 100;
  const nominalReturn = input.nominalReturn ?? (input.investedCost > 0 ? Math.round((nominalGain / input.investedCost) * 1e6) / 1e6 : 0);
  const decomp = calculateReturnsDecomposition(nominalReturn, assumptions.taxRate, assumptions.inflationRate);
  const wealth = calculatePurchasingPowerWealth(input.currentValue, nominalGain, assumptions);
  const benchmarkSpread = computeBenchmarkSpread(decomp.realPostTaxReturn, assumptions.taxRate, assumptions.inflationRate);
  const dragWaterfall = buildWaterfallStages(nominalReturn, decomp);
  const invariantHolds = decomp.realPostTaxReturn <= decomp.postTaxReturn + 1e-5 && decomp.postTaxReturn <= nominalReturn + 1e-5;

  return {
    nominalReturn,
    taxDrag: decomp.taxDrag,
    postTaxReturn: decomp.postTaxReturn,
    inflationDrag: decomp.inflationDrag,
    realPostTaxReturn: decomp.realPostTaxReturn,
    nominalGain,
    estimatedTax: wealth.estimatedTax,
    postTaxValue: wealth.postTaxValue,
    purchasingPowerValue: wealth.purchasingPowerValue,
    purchasingPowerLoss: wealth.purchasingPowerLoss,
    benchmarkSpread,
    dragWaterfall,
    invariantHolds,
  };
}

/**
 * Calculates reality check display metrics using backend DTOs when present,
 * with fallback to client simulation when offline.
 *
 * @param input Input values and optional backend drag DTO
 * @returns Formatted reality check metrics
 */
export function calculateRealityCheckMetrics(input: RealityCheckInput): RealityCheckResult {
  if (input.drags) {
    return calculateFromBackendDrags(input, input.drags);
  }
  return calculateFromClientAssumptions(input);
}

/**
 * Derives historical checkpoints from raw timeline points.
 *
 * @param points Raw historical valuation points
 * @returns Enriched historical checkpoints
 */
export function deriveHistoricalCheckpoints(points: HistoricalRawPoint[]): HistoricalCheckpoint[] {
  let rollingAth = 0;
  return points.map((p) => {
    rollingAth = Math.max(rollingAth, p.value);
    const isAth = p.isAth ?? (p.value >= rollingAth);
    const athValue = p.athValue ?? rollingAth;
    const drawdownPct = p.drawdownPercentage ?? (rollingAth > 0 ? Math.round(((p.value - rollingAth) / rollingAth) * 10000) / 100 : 0);
    const unrealizedGain = p.unrealizedGain ?? Math.round((p.value - p.investedAmount) * 100) / 100;
    const gainPct = p.gainPercentage ?? (p.investedAmount > 0 ? Math.round(((unrealizedGain / p.investedAmount) * 100) * 100) / 100 : 0);
    return { date: p.date, value: p.value, investedAmount: p.investedAmount, unrealizedGain, gainPct, isAth, athValue, drawdownPct };
  });
}

function getCutoffDays(range: HistoryRangePreset): number {
  switch (range) {
    case '1M': return 30;
    case '3M': return 90;
    case '6M': return 180;
    case '1Y': return 365;
    case '3Y': return 365 * 3;
    case '5Y': return 365 * 5;
    case 'ALL': return 0;
  }
}

/**
 * Filters historical checkpoints by a preset timeline range.
 *
 * @param checkpoints Historical checkpoints array
 * @param range Preset range filter
 * @returns Filtered historical checkpoints
 */
export function filterCheckpointsByRange(checkpoints: HistoricalCheckpoint[], range: HistoryRangePreset): HistoricalCheckpoint[] {
  if (range === 'ALL' || checkpoints.length === 0) return checkpoints;
  const days = getCutoffDays(range);
  const cutoffTime = new Date().getTime() - (days * 24 * 60 * 60 * 1000);
  const filtered = checkpoints.filter((cp) => new Date(cp.date).getTime() >= cutoffTime);
  if (filtered.length === 0 && checkpoints.length > 0) {
    const last = checkpoints[checkpoints.length - 1];
    return last ? [last] : [];
  }
  return filtered;
}
