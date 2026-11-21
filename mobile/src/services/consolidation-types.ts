export interface AssetInput {
  id?: string | undefined;
  name?: string | undefined;
  type?: string | undefined;
  isin?: string | undefined;
  amfiCode?: string | undefined;
  schemeCode?: string | undefined;
}

export interface FolioMetricsInput {
  investedAmount?: number | undefined;
  currentValue?: number | undefined;
  dayChange?: number | undefined;
  dayChangePercentage?: number | undefined;
  xirr?: number | undefined;
  postTaxXirr?: number | undefined;
  absoluteReturn?: number | undefined;
  postTaxAbsoluteReturn?: number | undefined;
  estimatedTax?: number | undefined;
  totalGain?: number | undefined;
  currentPrice?: number | undefined;
  cagr?: number | undefined;
}

export interface FolioInput {
  id: string;
  number?: string | undefined;
  folioNumber?: string | undefined;
  pan?: string | undefined;
  asset?: AssetInput | undefined;
  metrics?: FolioMetricsInput | undefined;
  transactions?: unknown[] | undefined;
}

export interface ConsolidatedMetrics {
  investedAmount: number;
  currentValue: number;
  dayChange: number;
  dayChangePercentage: number;
  xirr: number;
  postTaxXirr: number;
  absoluteReturn: number;
  postTaxAbsoluteReturn: number;
  estimatedTax: number;
  netRealizableValue: number;
}

export interface ConsolidatedSchemeGroup {
  id: string;
  schemeName: string;
  isin?: string | undefined;
  amfiCode?: string | undefined;
  type: string;
  pans: string[];
  metrics: ConsolidatedMetrics;
  folios: FolioInput[];
  folioCount: number;
}
