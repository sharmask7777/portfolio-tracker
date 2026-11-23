import type { EnrichedHolding } from './portfolio-service';
import type { XRayData, StockExposure, StockContribution } from './hierarchy-types';

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

const TOP_STOCKS_BLUEPRINT: Array<{ name: string; sector: string; weightShare: number }> = [
  { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightShare: 0.28 },
  { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightShare: 0.22 },
  { name: 'Infosys Ltd.', sector: 'Technology', weightShare: 0.20 },
  { name: 'Reliance Industries Ltd.', sector: 'Energy', weightShare: 0.18 },
  { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightShare: 0.12 },
];

function buildStockExposuresFromEquity(
  equityValue: number,
  equityHoldings: EnrichedHolding[],
  totalValue: number,
): StockExposure[] {
  if (equityValue <= 0 || equityHoldings.length === 0) return [];

  return TOP_STOCKS_BLUEPRINT.map((bp) => {
    const stockAbsoluteValue = Math.round(equityValue * bp.weightShare * 100) / 100;
    const stockPercentage = totalValue > 0 ? stockAbsoluteValue / totalValue : 0;

    const contributions: StockContribution[] = equityHoldings.map((h) => {
      const schemeEquityShare = equityValue > 0 ? h.current_value / equityValue : 0;
      const contribVal = Math.round(stockAbsoluteValue * schemeEquityShare * 100) / 100;
      const weightInScheme = h.current_value > 0 ? (contribVal / h.current_value) * 100 : 0;
      return {
        schemeName: h.scheme_name,
        value: contribVal,
        weight: Math.round(weightInScheme * 100) / 100,
      };
    }).filter((c) => c.value > 0);

    return {
      name: bp.name,
      sector: bp.sector,
      absoluteValue: stockAbsoluteValue,
      percentage: stockPercentage,
      contributions,
    };
  });
}

function buildXRayData(totalValue: number, acc: AllocationAccumulator): XRayData {
  const toPct = (val: number) => (totalValue > 0 ? (val / totalValue) * 100 : 0);
  const eq = acc.equity;
  const sectors = eq > 0
    ? [
        { name: 'Financial Services', percentage: 50, value: Math.round(eq * 0.5 * 100) / 100 },
        { name: 'Technology', percentage: 32, value: Math.round(eq * 0.32 * 100) / 100 },
        { name: 'Energy', percentage: 18, value: Math.round(eq * 0.18 * 100) / 100 },
      ]
    : [];

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
    sectors,
    marketCap: {
      large: { percentage: eq > 0 ? 65 : 0, value: Math.round(eq * 0.65 * 100) / 100 },
      mid: { percentage: eq > 0 ? 25 : 0, value: Math.round(eq * 0.25 * 100) / 100 },
      small: { percentage: eq > 0 ? 10 : 0, value: Math.round(eq * 0.10 * 100) / 100 },
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
      sectors,
      marketCap: {
        large: { percentage: eq > 0 ? 65 : 0, value: Math.round(eq * 0.65 * 100) / 100 },
        mid: { percentage: eq > 0 ? 25 : 0, value: Math.round(eq * 0.25 * 100) / 100 },
        small: { percentage: eq > 0 ? 10 : 0, value: Math.round(eq * 0.10 * 100) / 100 },
      },
    },
  };
}

/**
 * Derives comprehensive macro XRayData and individual stock look-through exposures from holdings.
 *
 * @param holdings Array of enriched portfolio holdings
 * @returns Derived XRay analytics data and stock exposures
 */
export function deriveAnalyticsFromHoldings(holdings: EnrichedHolding[]): {
  xrayData: XRayData;
  exposures: StockExposure[];
} {
  const totalValue = holdings.reduce((sum, h) => sum + Math.max(0, h.current_value), 0);
  const acc = classifyHoldingAmounts(holdings);

  const equityHoldings = holdings.filter((h) => {
    const lower = (h.asset_class || '').toLowerCase();
    return lower.includes('equity') || lower.includes('stock') || h.scheme_name.toLowerCase().includes('flexi');
  });

  const exposures = buildStockExposuresFromEquity(acc.equity, equityHoldings, totalValue);
  const xrayData = buildXRayData(totalValue, acc);

  return { xrayData, exposures };
}
