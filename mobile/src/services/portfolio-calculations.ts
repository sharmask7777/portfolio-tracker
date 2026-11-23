import type { HoldingEntity } from '../db/schema';
import { generateUuid } from '../db/repository';

export type CanonicalAssetClass = 'Equity' | 'Debt' | 'Arbitrage' | 'Gold' | 'Cash' | 'Other';

export interface AssetAllocationItem {
  name: CanonicalAssetClass;
  amount: number;
  percentage: number;
  color: string;
}

export interface EnrichedHolding extends HoldingEntity {
  dayChange: number;
  dayChangePct: number;
  gainLoss: number;
  gainLossPct: number;
}

export interface GroupedHoldings {
  assetClass: CanonicalAssetClass;
  totalValue: number;
  totalInvested: number;
  holdings: EnrichedHolding[];
}

export interface ServerTransactionData {
  id?: string; type?: string; date?: string; units?: number; nav?: number; amount?: number;
}

export interface ServerFolioData {
  id?: string | undefined;
  number?: string | undefined;
  folioNumber?: string | undefined;
  amc?: string | undefined;
  amcName?: string | undefined;
  pan?: string | undefined;
  units?: number | string | undefined;
  assetCategory?: string | undefined;
  asset?: { amfiCode?: string | null | undefined; name?: string | undefined; isin?: string | null | undefined; assetType?: string | undefined } | undefined;
  metrics?: {
    investedAmount?: number | undefined;
    currentValue?: number | undefined;
    currentPrice?: number | undefined;
    dayChange?: number | undefined;
    dayChangePercentage?: number | undefined;
    xirr?: number | undefined;
    absoluteReturn?: number | undefined;
  } | undefined;
  transactions?: ServerTransactionData[] | undefined;
}

function matchCategory(cat: string): CanonicalAssetClass | null {
  const u = cat.trim().toUpperCase();
  if (u.includes('ARBITRAGE')) return 'Arbitrage';
  if (u.includes('EQUITY')) return 'Equity';
  if (u.includes('DEBT')) return 'Debt';
  if (u.includes('GOLD')) return 'Gold';
  if (u.includes('CASH')) return 'Cash';
  if (u.includes('OTHER')) return 'Other';
  return null;
}

const DEBT_TOKENS = ['debt', 'bond', 'liquid', 'gilt', 'treasury'];
const EQUITY_TOKENS = ['equity', 'stock', 'index'];
const GOLD_TOKENS = ['gold', 'sgb', 'silver'];
const CASH_TOKENS = ['cash', 'overnight'];

function hasToken(str: string, tokens: readonly string[]): boolean {
  return tokens.some((t) => str.includes(t));
}

function matchTokens(combined: string): CanonicalAssetClass {
  const l = combined.toLowerCase();
  if (l.includes('arbitrage')) return 'Arbitrage';
  if (hasToken(l, EQUITY_TOKENS)) return 'Equity';
  if (hasToken(l, DEBT_TOKENS)) return 'Debt';
  if (hasToken(l, GOLD_TOKENS)) return 'Gold';
  if (hasToken(l, CASH_TOKENS)) return 'Cash';
  return 'Other';
}

export function normalizeAssetClass(
  raw: string,
  category?: string | null,
): CanonicalAssetClass {
  if (category) {
    const matched = matchCategory(category);
    if (matched) return matched;
  }
  return matchTokens(`${raw || ''} ${category || ''}`);
}

export function formatInr(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function filterHoldings(
  holdings: EnrichedHolding[],
  query?: string,
  assetClass?: string,
): EnrichedHolding[] {
  let list = holdings;
  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    list = list.filter((h) => h.scheme_name.toLowerCase().includes(q) || h.folio_number.toLowerCase().includes(q));
  }
  if (assetClass && assetClass.trim().length > 0) {
    list = list.filter((h) => normalizeAssetClass(h.asset_class, h.asset_category) === assetClass);
  }
  return list;
}

export const ASSET_CLASSES: readonly CanonicalAssetClass[] = [
  'Equity',
  'Debt',
  'Arbitrage',
  'Gold',
  'Cash',
  'Other',
] as const;

export const ALLOCATION_COLORS: Record<CanonicalAssetClass, string> = {
  Equity: '#38bdf8',
  Debt: '#10b981',
  Arbitrage: '#ec4899',
  Gold: '#f59e0b',
  Cash: '#06b6d4',
  Other: '#71717a',
};

export function groupHoldingsByAssetClass(
  holdings: EnrichedHolding[],
): GroupedHoldings[] {
  const groups: GroupedHoldings[] = [];

  for (const c of ASSET_CLASSES) {
    const list = holdings.filter(
      (h) => normalizeAssetClass(h.asset_class, h.asset_category) === c,
    );
    if (list.length > 0) {
      const val = list.reduce((sum, item) => sum + item.current_value, 0);
      const inv = list.reduce((sum, item) => sum + item.invested_cost, 0);
      groups.push({
        assetClass: c,
        totalValue: Math.round(val * 100) / 100,
        totalInvested: Math.round(inv * 100) / 100,
        holdings: list,
      });
    }
  }
  return groups;
}

export function buildAssetAllocation(
  holdings: EnrichedHolding[],
  totalValue: number,
): AssetAllocationItem[] {
  const items: AssetAllocationItem[] = [];

  for (const c of ASSET_CLASSES) {
    const sum = holdings
      .filter((h) => normalizeAssetClass(h.asset_class, h.asset_category) === c)
      .reduce((acc, h) => acc + h.current_value, 0);
    if (sum > 0) {
      const percentage = totalValue > 0
        ? Math.round((sum / totalValue) * 100 * 10) / 10
        : 0;
      items.push({
        name: c,
        amount: Math.round(sum * 100) / 100,
        percentage,
        color: ALLOCATION_COLORS[c],
      });
    }
  }
  return items;
}

function extractFolioNumber(f: ServerFolioData): string {
  return f.number || f.folioNumber || 'UNKNOWN';
}

function extractHoldingPrices(f: ServerFolioData, units: number): { price: number; val: number } {
  const price = typeof f.metrics?.currentPrice === 'number' ? f.metrics.currentPrice : 0;
  const val = typeof f.metrics?.currentValue === 'number' ? f.metrics.currentValue : units * price;
  return { price, val };
}

function extractAssetMeta(f: ServerFolioData) {
  return {
    schemeName: f.asset?.name || 'Unknown Scheme', amfiCode: f.asset?.amfiCode || null,
    isin: f.asset?.isin || null, assetClass: f.asset?.assetType || 'EQUITY',
  };
}

function extractHoldingMetrics(m?: ServerFolioData['metrics']) {
  if (!m) return { investedCost: 0, dayChange: 0, dayChangePct: 0, xirr: 0, absoluteReturn: 0 };
  return {
    investedCost: Number(m.investedAmount || 0),
    dayChange: m.dayChange ?? 0, dayChangePct: m.dayChangePercentage ?? 0,
    xirr: m.xirr ?? 0, absoluteReturn: m.absoluteReturn ?? 0,
  };
}

export function mapRawFolioToHolding(
  f: ServerFolioData,
  now: string,
): HoldingEntity | null {
  const units = Number(f.units || 0);
  const folioNumber = extractFolioNumber(f);
  const { price, val } = extractHoldingPrices(f, units);
  const meta = extractAssetMeta(f);
  const metrics = extractHoldingMetrics(f.metrics);
  const navDate = now.split('T')[0] || '';

  return {
    id: f.id || generateUuid(),
    folio_number: folioNumber,
    amfi_code: meta.amfiCode,
    scheme_name: meta.schemeName,
    isin: meta.isin,
    units,
    invested_cost: metrics.investedCost,
    current_nav: price,
    current_value: val,
    asset_class: meta.assetClass,
    nav_date: navDate,
    updated_at: now,
    day_change: metrics.dayChange,
    day_change_pct: metrics.dayChangePct,
    xirr: metrics.xirr,
    absolute_return: metrics.absoluteReturn,
    asset_category: f.assetCategory ?? meta.assetClass,
  };
}

/**
 * Computes dashboard summary metrics from a given list of enriched holdings.
 *
 * @param holdings - List of enriched holdings (filtered or consolidated)
 * @returns Dashboard summary metrics object
 */
export function summarizeHoldings(holdings: EnrichedHolding[]): {
  totalCurrentValue: number;
  totalInvestedCost: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  dayGain: number;
  dayGainPct: number;
  assetAllocation: AssetAllocationItem[];
  holdingsCount: number;
  lastUpdated: string | null;
} {
  let totalValue = 0;
  let totalInvested = 0;
  let totalDayGain = 0;
  let prevTotalValue = 0;
  let latestUpdate: string | null = null;

  for (const h of holdings) {
    totalValue += h.current_value;
    totalInvested += h.invested_cost;
    totalDayGain += h.dayChange;
    prevTotalValue += h.current_value - h.dayChange;
    if (!latestUpdate || h.updated_at > latestUpdate) latestUpdate = h.updated_at;
  }

  const roundedValue = Math.round(totalValue * 100) / 100;
  const roundedInvested = Math.round(totalInvested * 100) / 100;
  const unrealizedGain = Math.round((roundedValue - roundedInvested) * 100) / 100;
  const unrealizedGainPct = roundedInvested > 0 ? Math.round((unrealizedGain / roundedInvested) * 10000) / 100 : 0;
  const roundedDayGain = Math.round(totalDayGain * 100) / 100;
  const dayGainPct = prevTotalValue > 0 ? Math.round((roundedDayGain / prevTotalValue) * 10000) / 100 : 0;

  return {
    totalCurrentValue: roundedValue,
    totalInvestedCost: roundedInvested,
    unrealizedGain,
    unrealizedGainPct,
    dayGain: roundedDayGain,
    dayGainPct,
    assetAllocation: buildAssetAllocation(holdings, roundedValue),
    holdingsCount: holdings.length,
    lastUpdated: latestUpdate,
  };
}

