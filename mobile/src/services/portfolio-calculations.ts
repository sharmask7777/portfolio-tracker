/**
 * @file portfolio-calculations.ts
 * @description In-memory financial aggregation, currency formatting, folio parsing, and summary metrics.
 */

import type { HoldingEntity } from '../db/schema';
import { generateUuid } from '../db/repository';
import {
  type CanonicalAssetClass,
  ASSET_CLASSES,
  ALLOCATION_COLORS,
  normalizeAssetClass,
} from './asset-classification';

export {
  type CanonicalAssetClass,
  ASSET_CLASSES,
  ALLOCATION_COLORS,
  normalizeAssetClass,
};

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
  id?: string | undefined;
  type?: string | undefined;
  date?: string | undefined;
  units?: number | undefined;
  nav?: number | undefined;
  amount?: number | undefined;
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
  asset?: {
    amfiCode?: string | null | undefined;
    name?: string | undefined;
    isin?: string | null | undefined;
    assetType?: string | undefined;
  } | undefined;
  metrics?: {
    investedAmount?: number | undefined;
    currentValue?: number | undefined;
    currentPrice?: number | undefined;
    dayChange?: number | undefined;
    dayChangePercentage?: number | undefined;
    xirr?: number | null | undefined;
    absoluteReturn?: number | undefined;
    totalGain?: number | undefined;
    postTaxXirr?: number | null | undefined;
    postTaxAbsoluteReturn?: number | null | undefined;
    estimatedTax?: number | null | undefined;
    netRealizableValue?: number | null | undefined;
  } | undefined;
  transactions?: ServerTransactionData[] | undefined;
}

/**
 * Formats a monetary amount into standard Indian Rupee notation (₹x,xx,xxx.xx).
 *
 * @param amount - The numeric amount in INR
 * @returns Formatted currency string
 */
export function formatInr(amount: number): string {
  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);
  const formatted = absoluteAmount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Formats a percentage value with signed indicator (+x.xx% or -x.xx%).
 *
 * @param pct - The numeric percentage value
 * @returns Signed percentage string
 */
export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Filters enriched holdings by search query and asset class filter.
 *
 * @param holdings - List of enriched holdings to filter
 * @param query - Optional search query string matching scheme name or folio number
 * @param assetClass - Optional asset class filter string
 * @returns Filtered array of enriched holdings
 */
export function filterHoldings(
  holdings: EnrichedHolding[],
  query?: string,
  assetClass?: string,
): EnrichedHolding[] {
  let list = holdings;
  if (query && query.trim().length > 0) {
    const normalizedQuery = query.trim().toLowerCase();
    list = list.filter(
      (holding) =>
        holding.scheme_name.toLowerCase().includes(normalizedQuery) ||
        holding.folio_number.toLowerCase().includes(normalizedQuery),
    );
  }
  if (assetClass && assetClass.trim().length > 0) {
    list = list.filter(
      (holding) =>
        normalizeAssetClass(holding.asset_class, holding.asset_category) === assetClass,
    );
  }
  return list;
}

/**
 * Groups a collection of enriched holdings by their canonical asset class.
 *
 * @param holdings - List of enriched holdings to group
 * @returns Array of grouped holdings with aggregated values
 */
export function groupHoldingsByAssetClass(
  holdings: EnrichedHolding[],
): GroupedHoldings[] {
  const groups: GroupedHoldings[] = [];

  for (const assetClass of ASSET_CLASSES) {
    const list = holdings.filter(
      (holding) =>
        normalizeAssetClass(holding.asset_class, holding.asset_category) === assetClass,
    );
    if (list.length > 0) {
      const val = list.reduce((sum, item) => sum + item.current_value, 0);
      const inv = list.reduce((sum, item) => sum + item.invested_cost, 0);
      groups.push({
        assetClass,
        totalValue: Math.round(val * 100) / 100,
        totalInvested: Math.round(inv * 100) / 100,
        holdings: list,
      });
    }
  }
  return groups;
}

/**
 * Constructs canonical asset allocation breakdown items from holdings and total portfolio value.
 *
 * @param holdings - List of enriched holdings
 * @param totalValue - Total current valuation of portfolio in INR
 * @returns List of asset allocation items with percentage weights and colors
 */
export function buildAssetAllocation(
  holdings: EnrichedHolding[],
  totalValue: number,
): AssetAllocationItem[] {
  const items: AssetAllocationItem[] = [];

  for (const assetClass of ASSET_CLASSES) {
    const sum = holdings
      .filter(
        (holding) =>
          normalizeAssetClass(holding.asset_class, holding.asset_category) === assetClass,
      )
      .reduce((acc, holding) => acc + holding.current_value, 0);
    if (sum > 0) {
      const percentage =
        totalValue > 0 ? Math.round((sum / totalValue) * 100 * 10) / 10 : 0;
      items.push({
        name: assetClass,
        amount: Math.round(sum * 100) / 100,
        percentage,
        color: ALLOCATION_COLORS[assetClass],
      });
    }
  }
  return items;
}

function extractFolioNumber(serverFolio: ServerFolioData): string {
  return serverFolio.number || serverFolio.folioNumber || 'UNKNOWN';
}

function extractHoldingPrices(
  serverFolio: ServerFolioData,
  units: number,
): { price: number; val: number } {
  const price =
    typeof serverFolio.metrics?.currentPrice === 'number'
      ? serverFolio.metrics.currentPrice
      : 0;
  const val =
    typeof serverFolio.metrics?.currentValue === 'number'
      ? serverFolio.metrics.currentValue
      : units * price;
  return { price, val };
}

function extractAssetMeta(serverFolio: ServerFolioData): {
  schemeName: string;
  amfiCode: string | null;
  isin: string | null;
  assetClass: string;
} {
  return {
    schemeName: serverFolio.asset?.name || 'Unknown Scheme',
    amfiCode: serverFolio.asset?.amfiCode || null,
    isin: serverFolio.asset?.isin || null,
    assetClass: serverFolio.asset?.assetType || 'EQUITY',
  };
}

type RawFolioMetrics = NonNullable<ServerFolioData['metrics']>;

function extractBaseMetrics(m: RawFolioMetrics) {
  return {
    investedCost: Number(m.investedAmount || 0),
    dayChange: m.dayChange ?? 0,
    dayChangePct: m.dayChangePercentage ?? 0,
    xirr: m.xirr ?? null,
    absoluteReturn: m.absoluteReturn ?? 0,
  };
}

function extractTaxMetrics(m: RawFolioMetrics) {
  return {
    totalGain: m.totalGain ?? null,
    postTaxXirr: m.postTaxXirr ?? null,
    postTaxAbsoluteReturn: m.postTaxAbsoluteReturn ?? null,
    estimatedTax: m.estimatedTax ?? null,
    netRealizableValue: m.netRealizableValue ?? null,
  };
}

function extractHoldingMetrics(metrics?: ServerFolioData['metrics']) {
  const m = metrics ?? {};
  return { ...extractBaseMetrics(m), ...extractTaxMetrics(m) };
}

/**
 * Maps raw server folio payload item into a validated local SQLite HoldingEntity.
 *
 * @param serverFolio - Server folio data object
 * @param now - Current ISO timestamp string
 * @returns Local HoldingEntity record or null
 */
export function mapRawFolioToHolding(
  serverFolio: ServerFolioData,
  now: string,
): HoldingEntity | null {
  const units = Number(serverFolio.units || 0);
  const folioNumber = extractFolioNumber(serverFolio);
  const { price, val } = extractHoldingPrices(serverFolio, units);
  const meta = extractAssetMeta(serverFolio);
  const metrics = extractHoldingMetrics(serverFolio.metrics);
  const navDate = now.split('T')[0] || '';

  return {
    id: serverFolio.id || generateUuid(),
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
    asset_category: serverFolio.assetCategory ?? meta.assetClass,
    total_gain: metrics.totalGain,
    post_tax_xirr: metrics.postTaxXirr,
    post_tax_absolute_return: metrics.postTaxAbsoluteReturn,
    estimated_tax: metrics.estimatedTax,
    net_realizable_value: metrics.netRealizableValue,
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

  for (const holding of holdings) {
    totalValue += holding.current_value;
    totalInvested += holding.invested_cost;
    totalDayGain += holding.dayChange;
    prevTotalValue += holding.current_value - holding.dayChange;
    if (!latestUpdate || holding.updated_at > latestUpdate) latestUpdate = holding.updated_at;
  }

  const roundedValue = Math.round(totalValue * 100) / 100;
  const roundedInvested = Math.round(totalInvested * 100) / 100;
  const unrealizedGain = Math.round((roundedValue - roundedInvested) * 100) / 100;
  const unrealizedGainPct =
    roundedInvested > 0 ? Math.round((unrealizedGain / roundedInvested) * 10000) / 100 : 0;
  const roundedDayGain = Math.round(totalDayGain * 100) / 100;
  const dayGainPct =
    prevTotalValue > 0 ? Math.round((roundedDayGain / prevTotalValue) * 10000) / 100 : 0;

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
