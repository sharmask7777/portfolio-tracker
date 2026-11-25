import type { EnrichedHolding } from './portfolio-service';
import type { XRayData, StockExposure } from './hierarchy-types';

interface AllocationAccumulator {
  equity: number;
  debt: number;
  cash: number;
  gold: number;
  other: number;
  arbitrage: number;
}

type AssetCategory = 'arbitrage' | 'cash' | 'gold' | 'debt' | 'hybrid' | 'equity';

function isCashOrLiquid(name: string): boolean {
  return name.includes('liquid') || name.includes('overnight') || name.includes('cash');
}

function isGold(name: string, assetClass: string): boolean {
  return name.includes('gold') || name.includes('sgb') || assetClass.includes('gold');
}

function isDebt(assetClass: string): boolean {
  return assetClass.includes('debt') || assetClass.includes('bond');
}

function isHybrid(assetClass: string): boolean {
  return assetClass.includes('hybrid') || assetClass.includes('balanced');
}

function matchHoldingCategory(cat: string): AssetCategory | null {
  if (cat.includes('arbitrage')) return 'arbitrage';
  if (cat.includes('cash')) return 'cash';
  if (cat.includes('gold')) return 'gold';
  if (cat.includes('debt')) return 'debt';
  if (cat.includes('hybrid')) return 'hybrid';
  return null;
}

function matchHoldingTokens(nameLower: string, assetClassLower: string): AssetCategory {
  if (nameLower.includes('arbitrage')) return 'arbitrage';
  if (isCashOrLiquid(nameLower)) return 'cash';
  if (isGold(nameLower, assetClassLower)) return 'gold';
  if (isDebt(assetClassLower)) return 'debt';
  if (isHybrid(assetClassLower)) return 'hybrid';
  return 'equity';
}

function categorizeHolding(
  nameLower: string,
  assetClassLower: string,
  categoryLower?: string,
): AssetCategory {
  if (categoryLower) {
    const matched = matchHoldingCategory(categoryLower);
    if (matched) return matched;
  }
  return matchHoldingTokens(nameLower, assetClassLower);
}

function accumulateVal(acc: AllocationAccumulator, cat: AssetCategory, val: number): void {
  if (cat === 'arbitrage') {
    acc.arbitrage += val;
  } else if (cat === 'cash') {
    acc.cash += val;
  } else if (cat === 'gold') {
    acc.gold += val;
  } else if (cat === 'debt') {
    acc.debt += val;
  } else if (cat === 'hybrid') {
    acc.equity += val * 0.65;
    acc.debt += val * 0.35;
  } else {
    acc.equity += val;
  }
}

function classifyHoldingAmounts(holdings: EnrichedHolding[]): AllocationAccumulator {
  const acc: AllocationAccumulator = { equity: 0, debt: 0, cash: 0, gold: 0, other: 0, arbitrage: 0 };
  for (const h of holdings) {
    const val = Math.max(0, h.current_value);
    const cat = categorizeHolding(
      h.scheme_name.toLowerCase(),
      (h.asset_class || '').toLowerCase(),
      (h.asset_category || '').toLowerCase(),
    );
    accumulateVal(acc, cat, val);
  }
  return acc;
}

function buildXRayData(totalValue: number, acc: AllocationAccumulator): XRayData {
  const toPct = (val: number) => (totalValue > 0 ? (val / totalValue) * 100 : 0);
  const eq = acc.equity;

  return {
    totalValue,
    assetAllocation: {
      equity: { percentage: toPct(eq), value: eq },
      debt: { percentage: toPct(acc.debt), value: acc.debt },
      cash: { percentage: toPct(acc.cash), value: acc.cash },
      gold: { percentage: toPct(acc.gold), value: acc.gold },
      arbitrage: { percentage: toPct(acc.arbitrage), value: acc.arbitrage },
      other: { percentage: toPct(acc.other), value: acc.other },
    },
    sectors: [],
    marketCap: {
      large: { percentage: 0, value: 0 },
      mid: { percentage: 0, value: 0 },
      small: { percentage: 0, value: 0 },
    },
    exArbitrage: {
      assetAllocation: {
        equity: { percentage: toPct(eq), value: eq },
        debt: { percentage: toPct(acc.debt), value: acc.debt },
        cash: { percentage: toPct(acc.cash), value: acc.cash },
        gold: { percentage: toPct(acc.gold), value: acc.gold },
        arbitrage: { percentage: toPct(acc.arbitrage), value: acc.arbitrage },
        other: { percentage: toPct(acc.other), value: acc.other },
      },
      sectors: [],
      marketCap: {
        large: { percentage: 0, value: 0 },
        mid: { percentage: 0, value: 0 },
        small: { percentage: 0, value: 0 },
      },
    },
  };
}

/**
 * Derives macro asset allocation XRayData from holdings when offline/uncached.
 * Look-through sectors, market cap, and stock exposures require backend sync.
 *
 * @param holdings Array of enriched portfolio holdings
 * @returns Derived XRay asset allocation and empty stock exposures
 */
export function deriveAnalyticsFromHoldings(holdings: EnrichedHolding[]): {
  xrayData: XRayData;
  exposures: StockExposure[];
} {
  const totalValue = holdings.reduce((sum, h) => sum + Math.max(0, h.current_value), 0);
  const acc = classifyHoldingAmounts(holdings);
  const xrayData = buildXRayData(totalValue, acc);

  return { xrayData, exposures: [] };
}
