import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  savePortfolioAnalytics,
  getPortfolioAnalytics,
} from '../db/analytics-repository';
import type { HarvestTicketResponse } from '../types/generated';
import { getStoredCredentials } from './auth-service';
import type { XRayData, StockExposure } from './hierarchy-types';
import type {
  FinancialGoal,
  GoalDeadlineStatus,
  GoalPriority,
} from './goals-service';

const DEFAULT_FY = '2024-25';

function sanitizeStoreKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getHarvestCacheKey(portfolioId: string): string {
  return `PORTFOLIO_HARVEST_${sanitizeStoreKey(portfolioId)}`;
}

function getTaxSummaryCacheKey(portfolioId: string, fy: string): string {
  return `PORTFOLIO_TAX_SUMMARY_${sanitizeStoreKey(portfolioId)}_${sanitizeStoreKey(fy)}`;
}

async function resolveDb(db?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (db) return db;
  const existing = getDatabaseInstance();
  if (existing) return existing;
  return initDatabase();
}

/**
 * Parameters for synchronizing portfolio analytics from the backend API.
 */
export interface SyncAnalyticsParams {
  /** Base server URL */
  serverUrl: string;
  /** Portfolio or scope identifier (`'consolidated'` or profile/portfolio UUID) */
  portfolioId: string;
  /** Bearer JWT token */
  token: string;
  /** Target SQLite database (defaults to singleton instance) */
  db?: SQLiteDatabase | undefined;
  /** Financial year string (e.g. `'2024-25'`) */
  fy?: string | undefined;
}

async function fetchEndpointText(url: string, headers: Record<string, string>): Promise<string> {
  try {
    const res = await fetch(url, { headers });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

interface ScopedCachePayload {
  portfolioId: string;
  fy: string;
  taxSummaryJson: string;
  harvestJson: string;
}

async function persistScopedCaches(payload: ScopedCachePayload): Promise<void> {
  const { portfolioId, fy, taxSummaryJson, harvestJson } = payload;
  try {
    const ops: Promise<void>[] = [];
    if (taxSummaryJson) {
      ops.push(SecureStore.setItemAsync(getTaxSummaryCacheKey(portfolioId, fy), taxSummaryJson));
    }
    if (harvestJson) {
      ops.push(SecureStore.setItemAsync(getHarvestCacheKey(portfolioId), harvestJson));
    }
    await Promise.all(ops);
  } catch {
    // SecureStore may be unavailable in some test environments
  }
}

/**
 * Synchronizes look-through X-Ray, stock overlap exposures, statutory tax summaries,
 * and Section 112A tax harvesting tickets from backend per scope.
 *
 * Persists results into SQLite `portfolio_analytics` and SecureStore for instant offline retrieval.
 *
 * @param params - Request and database parameters
 */
export async function syncPortfolioAnalyticsFromServer(
  params: SyncAnalyticsParams,
): Promise<void> {
  const { serverUrl, portfolioId, token, db, fy = DEFAULT_FY } = params;
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const encodedScope = encodeURIComponent(portfolioId);
  const encodedFy = encodeURIComponent(fy);

  try {
    const [xrayJson, expJson, expExArbJson, taxSummaryJson, harvestJson] = await Promise.all([
      fetchEndpointText(`${trimmed}/api/portfolio/${encodedScope}/xray`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${encodedScope}/exposures?excludeArbitrage=false`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${encodedScope}/exposures?excludeArbitrage=true`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${encodedScope}/tax-summary?fy=${encodedFy}`, headers),
      fetchEndpointText(`${trimmed}/api/tax/harvesting?scopeId=${encodedScope}`, headers),
    ]);

    await persistScopedCaches({ portfolioId, fy, taxSummaryJson, harvestJson });

    if (xrayJson && expJson) {
      const targetDb = await resolveDb(db);
      await savePortfolioAnalytics(targetDb, {
        portfolio_id: portfolioId,
        xray_json: xrayJson,
        exposures_json: expJson,
        exposures_ex_arb_json: expExArbJson || expJson,
        tax_summary_json: taxSummaryJson || null,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // Preserve existing SQLite offline cache on network failure
  }
}

/**
 * Cached analytics payload retrieved from SQLite and SecureStore.
 */
export interface CachedAnalyticsResult {
  xrayData: XRayData | null;
  exposures: StockExposure[] | null;
  exposuresExArb: StockExposure[] | null;
  taxSummary: Record<string, unknown> | null;
  harvestTicket: HarvestTicketResponse | null;
}

async function readScopedTaxSummary(
  portfolioId: string | undefined,
  fy: string | undefined,
  fallbackJson: string | null,
): Promise<Record<string, unknown> | null> {
  if (portfolioId && fy) {
    try {
      const fyRaw = await SecureStore.getItemAsync(getTaxSummaryCacheKey(portfolioId, fy));
      if (fyRaw) return JSON.parse(fyRaw) as Record<string, unknown>;
    } catch {
      // Fall back to SQLite row
    }
  }
  if (!fallbackJson) return null;
  try {
    return JSON.parse(fallbackJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readScopedHarvestTicket(
  portfolioId: string | undefined,
): Promise<HarvestTicketResponse | null> {
  if (!portfolioId) return null;
  try {
    const raw = await SecureStore.getItemAsync(getHarvestCacheKey(portfolioId));
    return raw ? (JSON.parse(raw) as HarvestTicketResponse) : null;
  } catch {
    return null;
  }
}

function emptyCachedResult(): CachedAnalyticsResult {
  return {
    xrayData: null,
    exposures: null,
    exposuresExArb: null,
    taxSummary: null,
    harvestTicket: null,
  };
}

/**
 * Retrieves cached look-through X-Ray, stock exposures, tax summary, and harvest ticket.
 *
 * @param db - Optional SQLite database instance
 * @param portfolioId - Optional portfolio or scope identifier
 * @param fy - Optional financial year for FY-specific tax summary lookup
 * @returns Cached analytics data or null values
 */
export async function getCachedPortfolioAnalytics(
  db?: SQLiteDatabase,
  portfolioId?: string,
  fy?: string,
): Promise<CachedAnalyticsResult> {
  try {
    const targetDb = await resolveDb(db);
    const row = await getPortfolioAnalytics(targetDb, portfolioId);
    const effectiveScope = portfolioId ?? row?.portfolio_id;
    const [taxSummary, harvestTicket] = await Promise.all([
      readScopedTaxSummary(effectiveScope, fy, row?.tax_summary_json ?? null),
      readScopedHarvestTicket(effectiveScope),
    ]);

    if (!row) {
      return { ...emptyCachedResult(), taxSummary, harvestTicket };
    }

    const xrayData = JSON.parse(row.xray_json) as XRayData;
    const exposures = JSON.parse(row.exposures_json) as StockExposure[];
    const exposuresExArb = row.exposures_ex_arb_json
      ? (JSON.parse(row.exposures_ex_arb_json) as StockExposure[])
      : exposures;

    return { xrayData, exposures, exposuresExArb, taxSummary, harvestTicket };
  } catch {
    return emptyCachedResult();
  }
}

/**
 * Synchronizes analytics and tax data for a given scope using stored credentials,
 * returning the updated cached analytics bundle.
 *
 * @param portfolioId - Scope identifier (`'consolidated'` or member profile UUID)
 * @param fy - Financial year (e.g. `'2024-25'`)
 * @returns Updated cached analytics result
 */
export async function syncScopedAnalytics(
  portfolioId: string,
  fy: string = DEFAULT_FY,
): Promise<CachedAnalyticsResult> {
  try {
    const creds = await getStoredCredentials();
    if (creds.serverUrl && creds.token) {
      await syncPortfolioAnalyticsFromServer({
        serverUrl: creds.serverUrl,
        portfolioId,
        token: creds.token,
        fy,
      });
    }
  } catch {
    // Offline or unauthenticated — fall through to cache
  }
  return getCachedPortfolioAnalytics(undefined, portfolioId, fy);
}

/**
 * Backend GoalMetricsDto shape returned by `/api/health/:portfolioId/goals`.
 */
export interface BackendGoalMetricsDto {
  currentValue: number;
  progressPercentage: number;
  projectedValue: number;
  shortfall: number;
  surplus: number;
  requiredMonthlySip: number;
  remainingDays: number;
  remainingMonths: number;
  status: string;
}

/**
 * Backend GoalResponse shape returned by `/api/health/:portfolioId/goals`.
 */
export interface BackendGoalResponse {
  id: string;
  portfolioId: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlySip: number;
  priority: string;
  allocatedPercentage: number;
  metrics: BackendGoalMetricsDto;
  createdAt: string;
  updatedAt: string;
}

function mapBackendPriority(raw: string): GoalPriority {
  const upper = raw.toUpperCase();
  if (upper === 'HIGH') return 'High';
  if (upper === 'LOW') return 'Low';
  return 'Medium';
}

function mapBackendStatus(raw: string): GoalDeadlineStatus {
  if (raw === 'Achieved' || raw === 'Completed') return 'Completed';
  if (raw === 'Behind' || raw === 'Needs Attention') return 'Behind';
  if (raw === 'Ahead') return 'Ahead';
  return 'On Track';
}

/**
 * Maps a backend {@link BackendGoalResponse} to a {@link FinancialGoal} with server-computed metrics.
 */
export function mapBackendGoalToFinancialGoal(dto: BackendGoalResponse): FinancialGoal {
  return {
    id: dto.id,
    name: dto.name,
    category: 'Custom',
    priority: mapBackendPriority(dto.priority),
    targetAmount: dto.targetAmount,
    targetDate: dto.targetDate,
    allocatedPercentage: dto.allocatedPercentage,
    serverMetrics: {
      currentValue: dto.metrics.currentValue,
      targetAmount: dto.targetAmount,
      progressPercentage: Math.round(dto.metrics.progressPercentage * 10) / 10,
      status: mapBackendStatus(dto.metrics.status),
      remainingAmount: Math.max(0, dto.targetAmount - dto.metrics.currentValue),
      remainingMonths: Math.max(0, dto.metrics.remainingMonths),
      requiredMonthlySip: Math.round(dto.metrics.requiredMonthlySip),
    },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/**
 * Fetches financial goals from `/api/health/:portfolioId/goals` when online.
 */
export async function fetchGoalsFromServer(portfolioId: string): Promise<FinancialGoal[] | null> {
  try {
    const creds = await getStoredCredentials();
    if (!creds.serverUrl || !creds.token) return null;
    const base = creds.serverUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health/${encodeURIComponent(portfolioId)}/goals`, {
      headers: { Authorization: `Bearer ${creds.token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BackendGoalResponse[];
    return Array.isArray(data) ? data.map(mapBackendGoalToFinancialGoal) : null;
  } catch {
    return null;
  }
}

/**
 * Creates or updates a goal on `/api/health/:portfolioId/goals`.
 */
export async function mutateGoalOnServer(
  pathSuffix: string,
  method: 'POST' | 'PUT',
  body: Record<string, unknown>,
): Promise<FinancialGoal | null> {
  try {
    const creds = await getStoredCredentials();
    if (!creds.serverUrl || !creds.token) return null;
    const base = creds.serverUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}${pathSuffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return mapBackendGoalToFinancialGoal((await res.json()) as BackendGoalResponse);
  } catch {
    return null;
  }
}

/**
 * Deletes a goal on `/api/health/:portfolioId/goals/:goalId`.
 */
export async function deleteGoalOnServer(id: string, portfolioId: string): Promise<void> {
  try {
    const creds = await getStoredCredentials();
    if (!creds.serverUrl || !creds.token) return;
    const base = creds.serverUrl.trim().replace(/\/+$/, '');
    await fetch(
      `${base}/api/health/${encodeURIComponent(portfolioId)}/goals/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${creds.token}` } },
    );
  } catch {
    // Offline — local delete still applied
  }
}
