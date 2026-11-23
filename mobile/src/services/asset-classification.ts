/**
 * @file asset-classification.ts
 * @description Canonical asset classification, token normalization, and color palette definitions.
 */

export type CanonicalAssetClass = 'Equity' | 'Debt' | 'Arbitrage' | 'Gold' | 'Cash' | 'Other';

export const ASSET_CLASSES: readonly CanonicalAssetClass[] = [
  'Equity',
  'Debt',
  'Arbitrage',
  'Gold',
  'Cash',
  'Other',
] as const;

export const ALLOCATION_COLORS: Readonly<Record<CanonicalAssetClass, string>> = {
  Equity: '#38bdf8',
  Debt: '#10b981',
  Arbitrage: '#ec4899',
  Gold: '#f59e0b',
  Cash: '#06b6d4',
  Other: '#71717a',
};

const DEBT_TOKENS = ['debt', 'bond', 'liquid', 'gilt', 'money market', 'overnight', 'treasury'] as const;
const EQUITY_TOKENS = ['equity', 'stock', 'index', 'nifty', 'sensex', 'large', 'mid', 'small', 'flexi', 'multi'] as const;
const GOLD_TOKENS = ['gold', 'sgb', 'sovereign', 'silver', 'commodity'] as const;
const CASH_TOKENS = ['cash', 'bank'] as const;

/**
 * Checks whether the combined string contains any of the specified search tokens.
 *
 * @param lowerText - Lowercased search text
 * @param tokens - Readonly list of string tokens to match
 * @returns True if at least one token is found
 */
export function hasToken(lowerText: string, tokens: readonly string[]): boolean {
  for (const token of tokens) {
    if (lowerText.includes(token)) return true;
  }
  return false;
}

/**
 * Normalizes an explicit declared asset category string into a CanonicalAssetClass.
 *
 * @param category - Raw declared category from backend Single Source of Truth
 * @returns CanonicalAssetClass or null if unmapped
 */
export function matchCategory(category: string): CanonicalAssetClass | null {
  const upperCategory = category.trim().toUpperCase();
  if (upperCategory === 'EQUITY') return 'Equity';
  if (upperCategory === 'DEBT') return 'Debt';
  if (upperCategory === 'ARBITRAGE') return 'Arbitrage';
  if (upperCategory === 'GOLD') return 'Gold';
  if (upperCategory === 'CASH') return 'Cash';
  if (upperCategory === 'OTHER') return 'Other';
  return null;
}

/**
 * Fallback token-based classification matching against scheme name and asset class text.
 *
 * @param combinedText - Concatenated name and asset class text
 * @returns Matched CanonicalAssetClass defaulting to 'Other'
 */
export function matchTokens(combinedText: string): CanonicalAssetClass {
  const lowerCombined = combinedText.toLowerCase();
  if (lowerCombined.includes('arbitrage')) return 'Arbitrage';
  if (hasToken(lowerCombined, EQUITY_TOKENS)) return 'Equity';
  if (hasToken(lowerCombined, DEBT_TOKENS)) return 'Debt';
  if (hasToken(lowerCombined, GOLD_TOKENS)) return 'Gold';
  if (hasToken(lowerCombined, CASH_TOKENS)) return 'Cash';
  return 'Other';
}

/**
 * Normalizes raw scheme metadata and server asset category into a CanonicalAssetClass.
 *
 * Prioritizes backend SSoT declared category, falling back to heuristic token matching.
 *
 * @param raw - Raw asset class string
 * @param category - Optional declared server asset category
 * @returns Normalized CanonicalAssetClass
 */
export function normalizeAssetClass(raw: string, category?: string | null): CanonicalAssetClass {
  if (category) {
    const matchedCategory = matchCategory(category);
    if (matchedCategory) return matchedCategory;
  }
  return matchTokens(`${raw || ''} ${category || ''}`);
}
