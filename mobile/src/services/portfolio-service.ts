import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  getPortfolioHoldings,
  getClosedHoldings,
  getTransactionsByFolio,
  deleteFolioAndTransactions,
  getNavHistory,
} from '../db/repository';
import { flushUploadQueue } from './upload-queue';
import type { HoldingEntity, TransactionEntity } from '../db/schema';
import {
  refreshSchemeNavs,
  calculateDayValuationChange,
} from '../feeds/nav-fetcher';
import { getStoredCredentials } from './auth-service';
import {
  summarizeHoldings,
  type AssetAllocationItem,
  type EnrichedHolding,
} from './portfolio-calculations';
import { syncWithServer } from './portfolio-sync-service';
export { syncWithServer, parseServerPayload } from './portfolio-sync-service';

export type { TransactionEntity } from '../db/schema';
export * from './portfolio-calculations';

export interface DashboardSummary {
  totalCurrentValue: number;
  totalInvestedCost: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  dayGain: number;
  dayGainPct: number;
  assetAllocation: AssetAllocationItem[];
  holdingsCount: number;
  lastUpdated: string | null;
  isOfflineFallback: boolean;
  overallXirr?: number | undefined;
}

export interface RefreshResult {
  success: boolean;
  source: 'server' | 'public_feed' | 'offline_cache';
  dayGain?: number;
  dayGainPct?: number;
  error?: string;
}

async function resolveDb(db?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (db) return db;
  const existing = getDatabaseInstance();
  if (existing) return existing;
  return initDatabase();
}

async function calculateHoldingDayChange(
  db: SQLiteDatabase,
  holding: HoldingEntity,
): Promise<{ dayChange: number; dayChangePct: number }> {
  if (!holding.amfi_code) return { dayChange: 0, dayChangePct: 0 };
  try {
    const history = await getNavHistory(db, holding.amfi_code);
    if (history.length >= 2) {
      const latest = history[history.length - 1];
      const prev = history[history.length - 2];
      if (latest && prev && prev.nav > 0) {
        const diff = latest.nav - prev.nav;
        const dayChange = Math.round(holding.units * diff * 100) / 100;
        const dayChangePct = Math.round((diff / prev.nav) * 100 * 100) / 100;
        return { dayChange, dayChangePct };
      }
    }
  } catch {
    // Retain zero change on read error
  }
  return { dayChange: 0, dayChangePct: 0 };
}

function computeHoldingGainLoss(currentValue: number, investedCost: number): {
  gainLoss: number;
  gainLossPct: number;
} {
  const gainLoss = Math.round((currentValue - investedCost) * 100) / 100;
  const gainLossPct = investedCost > 0
    ? Math.round((gainLoss / investedCost) * 100 * 100) / 100
    : 0;
  return { gainLoss, gainLossPct };
}

async function resolveHoldingDayChange(
  db: SQLiteDatabase,
  holding: HoldingEntity,
): Promise<{ dayChange: number; dayChangePct: number }> {
  const dayChange = holding.day_change ?? 0;
  const dayChangePct = holding.day_change_pct ?? 0;
  if (dayChange !== 0 || dayChangePct !== 0) {
    return { dayChange, dayChangePct };
  }
  return calculateHoldingDayChange(db, holding);
}

export async function getEnrichedHoldings(
  db?: SQLiteDatabase,
): Promise<EnrichedHolding[]> {
  const targetDb = await resolveDb(db);
  if (!targetDb || typeof targetDb.getAllAsync !== 'function') {
    return [];
  }
  const rawHoldings = await getPortfolioHoldings(targetDb);
  const results: EnrichedHolding[] = [];

  for (const h of rawHoldings) {
    const { dayChange, dayChangePct } = await resolveHoldingDayChange(targetDb, h);
    const { gainLoss, gainLossPct } = computeHoldingGainLoss(h.current_value, h.invested_cost);
    results.push({ ...h, dayChange, dayChangePct, gainLoss, gainLossPct });
  }

  return results;
}

export async function getEnrichedClosedHoldings(
  db?: SQLiteDatabase,
): Promise<EnrichedHolding[]> {
  const targetDb = await resolveDb(db);
  if (!targetDb || typeof targetDb.getAllAsync !== 'function') {
    return [];
  }
  const rawClosed = await getClosedHoldings(targetDb);
  return rawClosed.map((h) => {
    const { gainLoss, gainLossPct } = computeHoldingGainLoss(h.current_value, h.invested_cost);
    return { ...h, dayChange: 0, dayChangePct: 0, gainLoss, gainLossPct };
  });
}

export async function getTransactionsForFolio(
  folioNumber: string,
  db?: SQLiteDatabase,
): Promise<TransactionEntity[]> {
  const targetDb = await resolveDb(db);
  if (!targetDb || typeof targetDb.getAllAsync !== 'function') {
    return [];
  }
  return getTransactionsByFolio(targetDb, folioNumber);
}

export async function deleteFolio(
  folioNumber: string,
  db?: SQLiteDatabase,
): Promise<void> {
  const targetDb = await resolveDb(db);
  if (!targetDb || typeof targetDb.runAsync !== 'function') {
    return;
  }
  return deleteFolioAndTransactions(targetDb, folioNumber);
}

export async function getDashboardSummary(
  db?: SQLiteDatabase,
): Promise<DashboardSummary> {
  const holdings = await getEnrichedHoldings(db);
  if (holdings.length === 0) {
    return {
      totalCurrentValue: 0,
      totalInvestedCost: 0,
      unrealizedGain: 0,
      unrealizedGainPct: 0,
      dayGain: 0,
      dayGainPct: 0,
      assetAllocation: [],
      holdingsCount: 0,
      lastUpdated: null,
      isOfflineFallback: false,
    };
  }

  const summary = summarizeHoldings(holdings);
  return {
    ...summary,
    overallXirr: computeOverallPortfolioXirr(holdings),
    isOfflineFallback: false,
  };
}

function extractHoldingReturnRate(h: EnrichedHolding): number {
  if (typeof h.xirr === 'number' && !Number.isNaN(h.xirr) && h.xirr !== 0) {
    return h.xirr;
  }
  if (typeof h.absolute_return === 'number' && !Number.isNaN(h.absolute_return)) {
    return h.absolute_return;
  }
  if (typeof h.gainLossPct === 'number' && !Number.isNaN(h.gainLossPct)) {
    return h.gainLossPct / 100;
  }
  return 0;
}

/**
 * Computes value-weighted overall portfolio annualized XIRR from holdings.
 * Falls back to absolute return for holdings without computed XIRR to prevent valuation truncation.
 *
 * @param holdings - Enriched holdings list
 * @returns Weighted XIRR or undefined if no holdings have valuation
 */
export function computeOverallPortfolioXirr(holdings: readonly EnrichedHolding[]): number | undefined {
  if (holdings.length === 0) return undefined;
  let totalValuation = 0;
  let weightedRateSum = 0;

  for (const h of holdings) {
    if (h.current_value > 0) {
      totalValuation += h.current_value;
      weightedRateSum += h.current_value * extractHoldingReturnRate(h);
    }
  }

  return totalValuation > 0 ? weightedRateSum / totalValuation : undefined;
}

export async function checkServerReachable(
  serverUrl: string,
  timeoutMs: number = 3000,
): Promise<boolean> {
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${trimmed}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function syncWithPublicFeed(
  db?: SQLiteDatabase,
): Promise<RefreshResult> {
  const targetDb = await resolveDb(db);
  if (!targetDb || typeof targetDb.getAllAsync !== 'function') {
    return { success: true, source: 'offline_cache' };
  }
  const holdings = await getPortfolioHoldings(targetDb);
  const amfiCodes = holdings
    .map((h) => h.amfi_code)
    .filter((code): code is string => Boolean(code && code.trim().length > 0));

  if (amfiCodes.length === 0) {
    return { success: true, source: 'offline_cache' };
  }

  try {
    const updatedNavs = await refreshSchemeNavs(amfiCodes, targetDb);
    const summary = calculateDayValuationChange(holdings, updatedNavs);
    return {
      success: true,
      source: 'public_feed',
      dayGain: summary.dayGain,
      dayGainPct: summary.dayGainPct,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Public feed refresh failed';
    return { success: false, source: 'public_feed', error: msg };
  }
}

export async function refreshPortfolio(
  db?: SQLiteDatabase,
): Promise<RefreshResult> {
  try {
    const targetDb = await resolveDb(db);
    if (!targetDb || typeof targetDb.getAllAsync !== 'function') {
      return { success: true, source: 'offline_cache' };
    }
    const creds = await getStoredCredentials();
    if (creds.serverUrl && creds.token) {
      const isReachable = await checkServerReachable(creds.serverUrl);
      if (isReachable) {
        await flushUploadQueue(creds.serverUrl, creds.token, { db: targetDb }).catch(() => {});
        const synced = await syncWithServer(creds.serverUrl, creds.token, targetDb);
        if (synced) return { success: true, source: 'server' };
      }
    }
    return syncWithPublicFeed(targetDb);
  } catch {
    return { success: false, source: 'offline_cache' };
  }
}
