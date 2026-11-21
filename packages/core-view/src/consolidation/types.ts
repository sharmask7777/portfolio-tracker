/**
 * @file types.ts
 * @description Types for portfolio folio inputs and consolidated scheme groups.
 */

export interface AssetInput {
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly type?: string | undefined;
  readonly isin?: string | undefined;
  readonly amfiCode?: string | undefined;
  readonly schemeCode?: string | undefined;
}

export interface FolioMetricsInput {
  readonly investedAmount?: number | undefined;
  readonly currentValue?: number | undefined;
  readonly dayChange?: number | undefined;
  readonly dayChangePercentage?: number | undefined;
  readonly xirr?: number | undefined;
  readonly postTaxXirr?: number | undefined;
  readonly absoluteReturn?: number | undefined;
  readonly postTaxAbsoluteReturn?: number | undefined;
  readonly estimatedTax?: number | undefined;
  readonly totalGain?: number | undefined;
  readonly currentPrice?: number | undefined;
  readonly cagr?: number | undefined;
}

export interface FolioInput {
  readonly id: string;
  readonly number?: string | undefined;
  readonly folioNumber?: string | undefined;
  readonly amcName?: string | undefined;
  readonly amc?: string | undefined;
  readonly units?: number | undefined;
  readonly currentNav?: number | undefined;
  readonly pan?: string | undefined;
  readonly asset?: AssetInput | undefined;
  readonly metrics?: FolioMetricsInput | undefined;
  readonly transactions?: unknown[] | undefined;
}

export interface ConsolidatedMetrics {
  readonly investedAmount: number;
  readonly currentValue: number;
  readonly dayChange: number;
  readonly dayChangePercentage: number;
  readonly xirr: number;
  readonly postTaxXirr: number;
  readonly absoluteReturn: number;
  readonly postTaxAbsoluteReturn: number;
  readonly estimatedTax: number;
  readonly netRealizableValue: number;
}

export interface ConsolidatedSchemeGroup {
  readonly id: string;
  readonly schemeName: string;
  readonly isin?: string | undefined;
  readonly amfiCode?: string | undefined;
  readonly type: string;
  readonly pans: string[];
  readonly metrics: ConsolidatedMetrics;
  readonly folios: FolioInput[];
  readonly folioCount: number;
}

export type PerformanceMode = 'XIRR' | 'ABS';

export type SchemeSortField =
  | 'name'
  | 'type'
  | 'invested'
  | 'value'
  | 'dayChange'
  | 'performance'
  | 'postTaxPerformance';

export type SortDirection = 'asc' | 'desc';
