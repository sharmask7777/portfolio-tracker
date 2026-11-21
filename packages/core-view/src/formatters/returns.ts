/**
 * @file returns.ts
 * @description Formatters and sanitizers for financial returns and percentages.
 */

/**
 * Bounds return rates within realistic limits to prevent math overflows and rendering anomalies.
 *
 * @param rate - The nominal return rate to sanitize (e.g. 0.15 for 15%).
 * @param fallback - The baseline return rate (typically absolute return) if invalid.
 * @returns Cleaned return rate clamped between -1.0 (-100%) and 10.0 (+1000%).
 */
export function sanitizeReturnRate(
  rate: number | null | undefined,
  fallback: number = 0
): number {
  if (rate === null || rate === undefined || Number.isNaN(rate) || !Number.isFinite(rate)) {
    return fallback;
  }
  // Clamp between -100% (-1.0) and +1000% (10.0)
  return Math.min(10.0, Math.max(-1.0, rate));
}

export interface PercentFormatOptions {
  /** Decimal places (default: 2) */
  readonly decimals?: number;
  /** Whether to append explicit plus sign for positive numbers (e.g. "+15.20%") */
  readonly showSign?: boolean;
  /** Value to return if input is null/undefined or non-finite (default: "N/A") */
  readonly fallback?: string;
}

/**
 * Formats a decimal return rate into a percentage string.
 *
 * @param rate - Decimal rate (e.g., 0.1543 -> 15.43%).
 * @param options - Formatting options.
 * @returns Formatted percentage string.
 */
export function formatPercent(
  rate: number | null | undefined,
  options?: PercentFormatOptions
): string {
  const fallback = options?.fallback ?? 'N/A';
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return fallback;
  }

  const decimals = options?.decimals ?? 2;
  const showSign = options?.showSign ?? false;
  const percentage = rate * 100;
  const sign = showSign && percentage > 0 ? '+' : '';

  return `${sign}${percentage.toFixed(decimals)}%`;
}
