/**
 * @file currency.ts
 * @description Formatters for currency values in Indian numbering system (Lakhs / Crores).
 */

export interface IndianRupeeFormatOptions {
  /** Whether to format numbers >= 1 Lakh into compact representations ('L' or 'Cr'). Default: true */
  readonly compact?: boolean | undefined;
  /** Decimal places to show in compact form. Default: 2 */
  readonly decimals?: number | undefined;
  /** Whether to prefix with ₹ symbol. Default: true */
  readonly includeSymbol?: boolean | undefined;
}

/**
 * Formats a number in compact Lakhs / Crores notation.
 *
 * @param absValue - Absolute numeric value.
 * @param decimals - Decimal places.
 * @returns Compact string representation or null if below 1 Lakh.
 */
function formatCompactRupee(absValue: number, decimals: number): string | null {
  if (absValue >= 10_000_000) {
    return `${(absValue / 10_000_000).toFixed(decimals)} Cr`;
  }
  if (absValue >= 100_000) {
    return `${(absValue / 100_000).toFixed(decimals)} L`;
  }
  return null;
}

/**
 * Formats a numeric value in Indian Rupees (INR) with optional compact notation (Lakhs / Crores).
 *
 * @param value - Numerical currency value.
 * @param options - Formatting configuration.
 * @returns Formatted currency string.
 */
export function formatIndianRupee(value: number, options?: IndianRupeeFormatOptions): string {
  const compact = options?.compact ?? true;
  const decimals = options?.decimals ?? 2;
  const includeSymbol = options?.includeSymbol ?? true;

  if (!Number.isFinite(value)) return includeSymbol ? '₹0' : '0';

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const symbol = includeSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  if (compact) {
    const compactStr = formatCompactRupee(absValue, decimals);
    if (compactStr) return `${sign}${symbol}${compactStr}`;
  }

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: compact ? 0 : decimals,
    minimumFractionDigits: 0,
  }).format(absValue);

  return `${sign}${symbol}${formattedNumber}`;
}

/**
 * Formats a currency value with standard compact Indian Lakh/Crore formatting.
 *
 * @param value - Currency number.
 * @param decimals - Decimal precision (default 2).
 * @returns Compact Indian currency string (e.g. "₹1.50 Cr", "₹4.50 L", "₹45,000").
 */
export function formatCompactInr(value: number, decimals: number = 2): string {
  return formatIndianRupee(value, { compact: true, decimals, includeSymbol: true });
}

/**
 * Parses a currency string or numeric input into a clean number.
 *
 * @param input - Raw string or number.
 * @returns Clean numeric value or 0 if unparseable.
 */
export function parseCurrency(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;

  const sanitized = input.replace(/[₹,\s]/g, '');
  const parsed = parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}
