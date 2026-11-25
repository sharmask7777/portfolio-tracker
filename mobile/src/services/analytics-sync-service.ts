import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  savePortfolioAnalytics,
  getPortfolioAnalytics,
} from '../db/analytics-repository';
import type { XRayData, StockExposure } from './hierarchy-types';

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
  /** Portfolio UUID */
  portfolioId: string;
  /** Bearer JWT token */
  token: string;
  /** Target SQLite database */
  db: SQLiteDatabase;
}

async function fetchEndpointText(url: string, headers: Record<string, string>): Promise<string> {
  try {
    const res = await fetch(url, { headers });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

/**
 * Synchronizes look-through X-Ray, stock overlap exposures, and statutory tax summaries from backend.
 *
 * Persists results into SQLite `portfolio_analytics` table for instant offline retrieval.
 *
 * @param params - Request and database parameters
 */
function getCurrentFinancialYear(): string {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export async function syncPortfolioAnalyticsFromServer(
  params: SyncAnalyticsParams,
): Promise<void> {
  const { serverUrl, portfolioId, token, db } = params;
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  try {
    const currentFy = getCurrentFinancialYear();
    const [xrayJson, expJson, expExArbJson, taxSummaryJson] = await Promise.all([
      fetchEndpointText(`${trimmed}/api/portfolio/${portfolioId}/xray`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${portfolioId}/exposures?excludeArbitrage=false`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${portfolioId}/exposures?excludeArbitrage=true`, headers),
      fetchEndpointText(`${trimmed}/api/portfolio/${portfolioId}/tax-summary?fy=${currentFy}`, headers),
    ]);

    if (xrayJson || expJson || taxSummaryJson) {
      await savePortfolioAnalytics(db, {
        portfolio_id: portfolioId,
        xray_json: xrayJson || '',
        exposures_json: expJson || '[]',
        exposures_ex_arb_json: expExArbJson || expJson || '[]',
        tax_summary_json: taxSummaryJson || null,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // Preserve existing SQLite offline cache on network failure
  }
}

/**
 * Cached analytics payload retrieved from SQLite.
 */
export interface CachedAnalyticsResult {
  xrayData: XRayData | null;
  exposures: StockExposure[] | null;
  exposuresExArb: StockExposure[] | null;
  taxSummary: Record<string, unknown> | null;
}

/**
 * Retrieves cached look-through X-Ray, stock exposures, and tax summary from SQLite.
 *
 * @param db - Optional SQLite database instance
 * @param portfolioId - Optional portfolio identifier
 * @returns Cached analytics data or null values
 */
export async function getCachedPortfolioAnalytics(
  db?: SQLiteDatabase,
  portfolioId?: string,
): Promise<CachedAnalyticsResult> {
  try {
    const targetDb = await resolveDb(db);
    const row = await getPortfolioAnalytics(targetDb, portfolioId);
    if (!row) {
      return { xrayData: null, exposures: null, exposuresExArb: null, taxSummary: null };
    }

    const xrayData = row.xray_json ? (JSON.parse(row.xray_json) as XRayData) : null;
    const exposures = row.exposures_json
      ? (JSON.parse(row.exposures_json) as StockExposure[])
      : null;
    const exposuresExArb = row.exposures_ex_arb_json
      ? (JSON.parse(row.exposures_ex_arb_json) as StockExposure[])
      : exposures;
    const taxSummary = row.tax_summary_json
      ? (JSON.parse(row.tax_summary_json) as Record<string, unknown>)
      : null;

    return { xrayData, exposures, exposuresExArb, taxSummary };
  } catch {
    return { xrayData: null, exposures: null, exposuresExArb: null, taxSummary: null };
  }
}
