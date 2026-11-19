/**
 * Types and data contracts for public mutual fund NAV feeds and valuation calculations.
 */

/**
 * A single historical or latest NAV record from MFAPI.
 */
export interface MfApiNavRecord {
  /** Date of NAV formatted as "DD-MM-YYYY" */
  date: string;
  /** NAV per unit as a string (e.g. "125.4567") */
  nav: string;
}

/**
 * Metadata header returned by MFAPI.
 */
export interface MfApiMeta {
  scheme_code?: number;
  scheme_name?: string;
  isin_growth?: string;
  isin_div_reinvestment?: string;
  fund_house?: string;
  scheme_type?: string;
  scheme_category?: string;
}

/**
 * Root response payload returned by MFAPI (https://api.mfapi.in/mf/<amfi_code>).
 */
export interface MfApiResponse {
  meta?: MfApiMeta;
  data: MfApiNavRecord[];
  status: string;
}

/**
 * Result of fetching and calculating daily NAV metrics for a mutual fund scheme.
 */
export interface NavUpdateResult {
  /** AMFI scheme code */
  amfiCode: string;
  /** Whether the fetch and parse operation succeeded */
  success: boolean;
  /** Latest Net Asset Value */
  latestNav: number;
  /** Previous trading day Net Asset Value, or null if only 1 record exists */
  previousNav: number | null;
  /** Date of the latest NAV in ISO format (YYYY-MM-DD) */
  navDate: string;
  /** Absolute price change (latestNav - previousNav) */
  dayChange: number;
  /** Percentage change for the day ((latestNav - previousNav) / previousNav) * 100 */
  dayGainPct: number;
  /** Error message if the fetch or parse failed */
  error?: string;
}

/**
 * Summary metrics of portfolio day gain/loss after updating holdings with latest NAVs.
 */
export interface ValuationUpdateSummary {
  /** Total current valuation across all evaluated holdings */
  totalCurrentValue: number;
  /** Total absolute rupee day gain/loss across all updated holdings */
  totalDayGain: number;
  /** Percentage day change across the portfolio */
  totalDayGainPct: number;
  /** Alias for totalDayGain */
  dayGain: number;
  /** Alias for totalDayGainPct */
  dayGainPct: number;
  /** Total original invested cost across all holdings */
  totalInvestedCost: number;
  /** Total number of holdings provided */
  totalHoldings: number;
  /** Number of holdings successfully updated with latest NAV */
  updatedCount: number;
  /** Number of holdings that could not be updated or failed */
  failedCount: number;
}
