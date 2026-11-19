import type { HoldingEntity } from '../db/schema';
import { generateUuid } from '../db/repository';

export interface AssetAllocationItem {
  name: 'Equity' | 'Debt' | 'Hybrid' | 'Gold/Others';
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
  assetClass: 'Equity' | 'Debt' | 'Hybrid' | 'Gold/Others';
  totalValue: number;
  totalInvested: number;
  holdings: EnrichedHolding[];
}

export interface ServerFolioData {
  id?: string;
  number?: string;
  folioNumber?: string;
  amc?: string;
  amcName?: string;
  pan?: string;
  units?: number | string;
  asset?: {
    amfiCode?: string | null;
    name?: string;
    isin?: string | null;
    assetType?: string;
  };
  metrics?: {
    investedAmount?: number;
    currentValue?: number;
    currentPrice?: number;
  };
}

export function normalizeAssetClass(
  raw: string,
): 'Equity' | 'Debt' | 'Hybrid' | 'Gold/Others' {
  const upper = (raw || '').toUpperCase().trim();
  if (upper.includes('EQ') || upper.includes('EQUITY') || upper.includes('STOCK')) {
    return 'Equity';
  }
  if (upper.includes('DEBT') || upper.includes('BOND') || upper.includes('LIQUID')) {
    return 'Debt';
  }
  if (upper.includes('HYBRID') || upper.includes('BALANCED')) {
    return 'Hybrid';
  }
  return 'Gold/Others';
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
    list = list.filter(
      (h) =>
        h.scheme_name.toLowerCase().includes(q) ||
        h.folio_number.toLowerCase().includes(q),
    );
  }
  if (assetClass && assetClass.trim().length > 0) {
    list = list.filter((h) => normalizeAssetClass(h.asset_class) === assetClass);
  }
  return list;
}

export function groupHoldingsByAssetClass(
  holdings: EnrichedHolding[],
): GroupedHoldings[] {
  const classes: Array<'Equity' | 'Debt' | 'Hybrid' | 'Gold/Others'> = [
    'Equity',
    'Debt',
    'Hybrid',
    'Gold/Others',
  ];
  const groups: GroupedHoldings[] = [];

  for (const c of classes) {
    const list = holdings.filter((h) => normalizeAssetClass(h.asset_class) === c);
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
  const colors: Record<string, string> = {
    Equity: '#3b82f6',
    Debt: '#10b981',
    Hybrid: '#8b5cf6',
    'Gold/Others': '#f59e0b',
  };
  const classes: Array<'Equity' | 'Debt' | 'Hybrid' | 'Gold/Others'> = [
    'Equity',
    'Debt',
    'Hybrid',
    'Gold/Others',
  ];
  const items: AssetAllocationItem[] = [];

  for (const c of classes) {
    const sum = holdings
      .filter((h) => normalizeAssetClass(h.asset_class) === c)
      .reduce((acc, h) => acc + h.current_value, 0);
    if (sum > 0) {
      const percentage = totalValue > 0
        ? Math.round((sum / totalValue) * 100 * 10) / 10
        : 0;
      items.push({
        name: c,
        amount: Math.round(sum * 100) / 100,
        percentage,
        color: colors[c] ?? '#94a3b8',
      });
    }
  }
  return items;
}

function extractFolioNumber(f: ServerFolioData): string {
  if (f.number) return f.number;
  if (f.folioNumber) return f.folioNumber;
  return 'UNKNOWN';
}

function extractHoldingPrices(
  f: ServerFolioData,
  units: number,
): { price: number; val: number } {
  const metrics = f.metrics;
  const price = metrics && typeof metrics.currentPrice === 'number' ? metrics.currentPrice : 0;
  const val = metrics && typeof metrics.currentValue === 'number'
    ? metrics.currentValue
    : units * price;
  return { price, val };
}

function extractAssetMeta(f: ServerFolioData): {
  schemeName: string;
  amfiCode: string | null;
  isin: string | null;
  assetClass: string;
} {
  const asset = f.asset;
  return {
    schemeName: asset?.name || 'Unknown Scheme',
    amfiCode: asset?.amfiCode || null,
    isin: asset?.isin || null,
    assetClass: asset?.assetType || 'EQUITY',
  };
}

export function mapRawFolioToHolding(
  f: ServerFolioData,
  now: string,
): HoldingEntity | null {
  const units = Number(f.units || 0);
  if (units <= 0) return null;

  const folioNumber = extractFolioNumber(f);
  const { price, val } = extractHoldingPrices(f, units);
  const meta = extractAssetMeta(f);
  const navDate = now.split('T')[0] || '';

  return {
    id: f.id || generateUuid(),
    folio_number: folioNumber,
    amfi_code: meta.amfiCode,
    scheme_name: meta.schemeName,
    isin: meta.isin,
    units,
    invested_cost: Number(f.metrics?.investedAmount || 0),
    current_nav: price,
    current_value: val,
    asset_class: meta.assetClass,
    nav_date: navDate,
    updated_at: now,
  };
}
