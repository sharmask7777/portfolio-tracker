import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  getPortfolioHoldings,
  getNavHistory,
  savePortfolioSnapshot,
  type PortfolioSnapshotInput,
} from '../db/repository';
import type { FolioEntity, HoldingEntity } from '../db/schema';
import {
  refreshSchemeNavs,
  calculateDayValuationChange,
} from '../feeds/nav-fetcher';
import { getStoredCredentials } from './auth-service';
import {
  mapRawFolioToHolding,
  summarizeHoldings,
  type AssetAllocationItem,
  type EnrichedHolding,
  type ServerFolioData,
} from './portfolio-calculations';

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

export async function getEnrichedHoldings(
  db?: SQLiteDatabase,
): Promise<EnrichedHolding[]> {
  const targetDb = await resolveDb(db);
  const rawHoldings = await getPortfolioHoldings(targetDb);
  const results: EnrichedHolding[] = [];

  for (const h of rawHoldings) {
    const { dayChange, dayChangePct } = await calculateHoldingDayChange(targetDb, h);
    const gainLoss = Math.round((h.current_value - h.invested_cost) * 100) / 100;
    const gainLossPct = h.invested_cost > 0
      ? Math.round((gainLoss / h.invested_cost) * 100 * 100) / 100
      : 0;
    results.push({ ...h, dayChange, dayChangePct, gainLoss, gainLossPct });
  }

  return results;
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
    isOfflineFallback: false,
  };
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

function extractFolioEntities(
  foliosList: ServerFolioData[],
  now: string,
): FolioEntity[] {
  return foliosList.map((f) => ({
    folio_number: f.number || f.folioNumber || 'UNKNOWN',
    amc_name: f.amc || f.amcName || 'Unknown AMC',
    pan: f.pan || 'NA',
    updated_at: now,
  }));
}

function extractHoldingEntities(
  foliosList: ServerFolioData[],
  now: string,
): HoldingEntity[] {
  const holdings: HoldingEntity[] = [];
  for (const f of foliosList) {
    const h = mapRawFolioToHolding(f, now);
    if (h) holdings.push(h);
  }
  return holdings;
}

function parseServerPayload(
  data: Record<string, unknown>,
): PortfolioSnapshotInput {
  const foliosList = (data['folios'] as ServerFolioData[]) || [];
  const now = new Date().toISOString();
  const id = typeof data['id'] === 'string' ? data['id'] : 'consolidated';
  const name = typeof data['name'] === 'string' ? data['name'] : 'Consolidated Portfolio';

  return {
    portfolio: { id, name, updated_at: now },
    folios: extractFolioEntities(foliosList, now),
    holdings: extractHoldingEntities(foliosList, now),
  };
}

export async function syncWithServer(
  serverUrl: string,
  token: string,
  db?: SQLiteDatabase,
): Promise<boolean> {
  const targetDb = await resolveDb(db);
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  const url = `${trimmed}/api/portfolio/summary`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as Record<string, unknown>;
    const snapshot = parseServerPayload(json);
    await savePortfolioSnapshot(targetDb, snapshot);
    return true;
  } catch {
    return false;
  }
}

export async function syncWithPublicFeed(
  db?: SQLiteDatabase,
): Promise<RefreshResult> {
  const targetDb = await resolveDb(db);
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
  const targetDb = await resolveDb(db);
  try {
    const creds = await getStoredCredentials();
    if (creds.serverUrl && creds.token) {
      const isReachable = await checkServerReachable(creds.serverUrl);
      if (isReachable) {
        const synced = await syncWithServer(creds.serverUrl, creds.token, targetDb);
        if (synced) return { success: true, source: 'server' };
      }
    }
  } catch {
    // Fall back to public feed
  }
  return syncWithPublicFeed(targetDb);
}
