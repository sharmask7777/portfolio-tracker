import type { FolioView, FolioMetrics } from './generated/FolioView';
import type { HoldingsSummaryResponse } from './generated/HoldingsSummaryResponse';
import type { SummaryMetrics } from './generated/SummaryMetrics';
import type { DragDecompositionDto } from './generated/DragDecompositionDto';
import type { PanBreakdownDto } from './generated/PanBreakdownDto';

export interface EnrichedFolioMetrics {
  currentPrice?: number | undefined;
  investedAmount?: number | undefined;
  investedValue?: number | undefined;
  currentValue?: number | undefined;
  totalGain?: number | undefined;
  unrealizedGain?: number | undefined;
  absoluteReturn?: number | undefined;
  xirr?: number | undefined;
  netRealizableValue?: number | undefined;
  postTaxXirr?: number | undefined;
  postTaxAbsoluteReturn?: number | undefined;
  dayChange?: number | undefined;
  dayChangePercentage?: number | undefined;
}

export interface EnrichedFolioAsset {
  id?: string | undefined;
  name?: string | undefined;
  type?: string | undefined;
  assetClass?: string | undefined;
}

export interface EnrichedFolioView {
  id: string;
  schemeName: string;
  name?: string | undefined;
  number?: string | undefined;
  folioNumber?: string | undefined;
  amcName?: string | undefined;
  pan?: string | undefined;
  ownerName?: string | undefined;
  units?: number | undefined;
  currentNav?: number | undefined;
  currentValue?: number | undefined;
  investedValue?: number | undefined;
  unrealizedPnl?: number | undefined;
  returnPercentage?: number | undefined;
  xirr?: number | undefined;
  isin?: string | undefined;
  assetClass?: string | undefined;
  asset?: EnrichedFolioAsset | undefined;
  metrics?: EnrichedFolioMetrics | undefined;
  closed?: boolean | undefined;
}

export interface PortfolioSummaryResponse {
  id: string;
  metrics: SummaryMetrics;
  folios: EnrichedFolioView[];
  closedFolios?: EnrichedFolioView[] | undefined;
  holdingsSummary?: HoldingsSummaryResponse | undefined;
  panBreakdowns?: PanBreakdownDto[] | undefined;
  dragDecomposition?: DragDecompositionDto | undefined;
  taxSlab?: number | undefined;
}

/**
 * Safely converts an EnrichedFolioView to FolioView for simulation or components expecting FolioView.
 */
export function toFolioView(f: EnrichedFolioView): FolioView {
  const result: FolioView = {
    id: f.id,
  };
  const name = f.name ?? f.schemeName;
  if (name !== undefined) result.name = name;
  if (f.folioNumber !== undefined) result.folioNumber = f.folioNumber;

  if (f.asset) {
    const assetObj: NonNullable<FolioView['asset']> = {};
    if (f.asset.name !== undefined) assetObj.name = f.asset.name;
    if (f.asset.type !== undefined) assetObj.type = f.asset.type;
    result.asset = assetObj;
  }

  if (f.metrics) {
    const metricsObj: FolioMetrics = {};
    const price = f.metrics.currentPrice ?? f.currentNav;
    if (price !== undefined) metricsObj.currentPrice = price;
    const invested = f.metrics.investedAmount ?? f.investedValue;
    if (invested !== undefined) metricsObj.investedAmount = invested;
    const value = f.metrics.currentValue ?? f.currentValue;
    if (value !== undefined) metricsObj.currentValue = value;
    const gain = f.metrics.totalGain ?? f.unrealizedPnl;
    if (gain !== undefined) metricsObj.totalGain = gain;
    const abs = f.metrics.absoluteReturn ?? f.returnPercentage;
    if (abs !== undefined) metricsObj.absoluteReturn = abs;
    const xirrVal = f.metrics.xirr ?? f.xirr;
    if (xirrVal !== undefined) metricsObj.xirr = xirrVal;
    result.metrics = metricsObj;
  }

  return result;
}
