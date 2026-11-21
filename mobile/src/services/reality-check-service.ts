/**
 * Reality check calculations and historical portfolio checkpoint processing.
 *
 * Implements the Fisher equation for purchasing-power adjusted returns:
 *   (1 + R_post) / (1 + i) - 1
 *
 * Mathematical Invariant:
 *   Real Post-Tax Return <= Post-Tax Return <= Nominal Return (when i >= 0 and tax >= 0).
 *
 * @module reality-check-service
 */

export interface RealityCheckAssumptions {
  inflationRate: number;
  taxRate: number;
  horizonYears: number;
}

export const DEFAULT_ASSUMPTIONS: RealityCheckAssumptions = {
  inflationRate: 0.06,
  taxRate: 0.15,
  horizonYears: 3,
};

export interface RealityCheckInput {
  currentValue: number;
  investedCost: number;
  nominalReturn?: number | undefined;
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

/**
 * Computes tax drag, nominal post-tax return, and Fisher real purchasing power return.
 *
 * @param nominalReturn Gross nominal annualized return
 * @param taxRate Marginal tax bracket
 * @param inflationRate Annual CPI inflation rate
 * @returns Decomposed return rates
 */
function calculateReturnsDecomposition(
  nominalReturn: number,
  taxRate: number,
  inflationRate: number,
): ReturnsDecomposition {
  const taxDrag = nominalReturn > 0
    ? Math.round(nominalReturn * taxRate * 1000000) / 1000000
    : 0;
  const postTaxReturn = Math.round((nominalReturn - taxDrag) * 1000000) / 1000000;
  const realPostTaxReturn = Math.round(
    (((1 + postTaxReturn) / (1 + inflationRate)) - 1) * 1000000,
  ) / 1000000;
  const inflationDrag = Math.round((postTaxReturn - realPostTaxReturn) * 1000000) / 1000000;

  return { taxDrag, postTaxReturn, realPostTaxReturn, inflationDrag };
}

/**
 * Calculates post-tax wealth and purchasing power deflated over horizon.
 *
 * @param currentValue Current portfolio market valuation
 * @param nominalGain Unrealized capital gain amount
 * @param assumptions Macro inflation, tax rate, and compounding horizon
 * @returns Wealth and purchasing power metrics
 */
function calculatePurchasingPowerWealth(
  currentValue: number,
  nominalGain: number,
  assumptions: RealityCheckAssumptions,
): { estimatedTax: number; postTaxValue: number; purchasingPowerValue: number; purchasingPowerLoss: number } {
  const estimatedTax = nominalGain > 0
    ? Math.round(nominalGain * assumptions.taxRate * 100) / 100
    : 0;
  const postTaxValue = Math.round((currentValue - estimatedTax) * 100) / 100;
  const deflator = Math.pow(1 + assumptions.inflationRate, assumptions.horizonYears);
  const purchasingPowerValue = Math.round((postTaxValue / deflator) * 100) / 100;
  const purchasingPowerLoss = Math.round((currentValue - purchasingPowerValue) * 100) / 100;

  return { estimatedTax, postTaxValue, purchasingPowerValue, purchasingPowerLoss };
}

/**
 * Computes spread over risk-free asset benchmark (6.5% nominal FD).
 *
 * @param realPostTaxReturn Real purchasing-power adjusted return
 * @param taxRate Marginal tax rate
 * @param inflationRate Annual CPI inflation rate
 * @returns Spread over real safe benchmark
 */
function computeBenchmarkSpread(
  realPostTaxReturn: number,
  taxRate: number,
  inflationRate: number,
): number {
  const rfNominal = 0.065;
  const rfPostTax = rfNominal * (1 - taxRate);
  const rfReal = ((1 + rfPostTax) / (1 + inflationRate)) - 1;
  return Math.round((realPostTaxReturn - rfReal) * 1000000) / 1000000;
}

/**
 * Assembles the sequential 5-stage drag waterfall.
 *
 * @param nominalReturn Gross nominal return
 * @param decomp Decomposed tax, inflation, and real returns
 * @returns Array of waterfall stages
 */
function buildWaterfallStages(
  nominalReturn: number,
  decomp: ReturnsDecomposition,
): DragWaterfallStage[] {
  return [
    { step: 1, label: 'Gross Nominal', rate: nominalReturn, drag: 0, description: 'Pre-tax annualized return' },
    { step: 2, label: 'Tax Drag', rate: decomp.taxDrag, drag: -decomp.taxDrag, description: 'Statutory capital gains drag' },
    { step: 3, label: 'Post-Tax Nominal', rate: decomp.postTaxReturn, drag: 0, description: 'Net retained post statutory tax' },
    { step: 4, label: 'CPI Inflation Drag', rate: decomp.inflationDrag, drag: -decomp.inflationDrag, description: 'Purchasing power deflator erosion' },
    { step: 5, label: 'Real Purchasing Return', rate: decomp.realPostTaxReturn, drag: 0, description: 'True wealth compounding over inflation' },
  ];
}

/**
 * Calculates Reality Check metrics, return drags, and real purchasing-power adjusted metrics.
 *
 * @param input Portfolio valuation, invested capital, and assumption overrides
 * @returns Comprehensive reality check decomposition
 */
export function calculateRealityCheckMetrics(
  input: RealityCheckInput,
): RealityCheckResult {
  const assumptions: RealityCheckAssumptions = { ...DEFAULT_ASSUMPTIONS, ...input.assumptions };
  const nominalGain = Math.round((input.currentValue - input.investedCost) * 100) / 100;
  const nominalReturn = input.nominalReturn ?? (
    input.investedCost > 0 ? Math.round((nominalGain / input.investedCost) * 1000000) / 1000000 : 0
  );

  const decomp = calculateReturnsDecomposition(nominalReturn, assumptions.taxRate, assumptions.inflationRate);
  const wealth = calculatePurchasingPowerWealth(input.currentValue, nominalGain, assumptions);
  const benchmarkSpread = computeBenchmarkSpread(decomp.realPostTaxReturn, assumptions.taxRate, assumptions.inflationRate);
  const dragWaterfall = buildWaterfallStages(nominalReturn, decomp);
  const invariantHolds = decomp.realPostTaxReturn <= decomp.postTaxReturn + 0.00001
    && decomp.postTaxReturn <= nominalReturn + 0.00001;

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
 * Derives mark-to-market historical checkpoints with All-Time High (ATH) tracking and drawdown.
 *
 * @param points Chronological valuation checkpoints
 * @returns Enriched checkpoints with ATH and drawdown metrics
 */
export function deriveHistoricalCheckpoints(
  points: HistoricalRawPoint[],
): HistoricalCheckpoint[] {
  let rollingAth = 0;

  return points.map((p) => {
    rollingAth = Math.max(rollingAth, p.value);
    const isAth = p.value >= rollingAth;
    const drawdownPct = rollingAth > 0
      ? Math.round(((p.value - rollingAth) / rollingAth) * 10000) / 100
      : 0;
    const unrealizedGain = Math.round((p.value - p.investedAmount) * 100) / 100;
    const gainPct = p.investedAmount > 0
      ? Math.round(((unrealizedGain / p.investedAmount) * 100) * 100) / 100
      : 0;

    return {
      date: p.date,
      value: p.value,
      investedAmount: p.investedAmount,
      unrealizedGain,
      gainPct,
      isAth,
      athValue: rollingAth,
      drawdownPct,
    };
  });
}

/**
 * Gets cutoff days for range filter.
 *
 * @param range History range preset
 * @returns Number of days
 */
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
 * Filters historical checkpoints by range preset.
 *
 * @param checkpoints Enriched historical checkpoints
 * @param range History range filter preset
 * @returns Filtered checkpoints
 */
export function filterCheckpointsByRange(
  checkpoints: HistoricalCheckpoint[],
  range: HistoryRangePreset,
): HistoricalCheckpoint[] {
  if (range === 'ALL' || checkpoints.length === 0) return checkpoints;

  const days = getCutoffDays(range);
  const now = new Date();
  const cutoffTime = now.getTime() - (days * 24 * 60 * 60 * 1000);

  const filtered = checkpoints.filter((cp) => new Date(cp.date).getTime() >= cutoffTime);
  if (filtered.length === 0 && checkpoints.length > 0) {
    const last = checkpoints[checkpoints.length - 1];
    return last ? [last] : [];
  }
  return filtered;
}
