import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  savePortfolioHistory,
  getPortfolioHistory,
} from '../db/history-repository';
import type { HistoryPoint } from '../types/generated';

async function resolveDb(db?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (db) return db;
  const existing = getDatabaseInstance();
  if (existing) return existing;
  return initDatabase();
}

/**
 * Synchronizes historical portfolio timeline from backend and caches into SQLite.
 *
 * @param params Synchronization request parameters
 */
export async function syncPortfolioHistoryFromServer(params: {
  historyUrl: string;
  portfolioId: string;
  token: string;
  db: SQLiteDatabase;
}): Promise<void> {
  const { historyUrl, portfolioId, token, db } = params;
  try {
    const res = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return;
    const historyData = (await res.json()) as HistoryPoint[];
    if (Array.isArray(historyData)) {
      await savePortfolioHistory(db, portfolioId, historyData);
    }
  } catch {
    // Retain existing local history cache if fetch fails
  }
}

/**
 * Retrieves cached historical valuation points for a portfolio.
 *
 * @param db Optional SQLite database instance
 * @param portfolioId Portfolio identifier
 * @returns Array of history points
 */
export async function getCachedPortfolioHistory(
  db?: SQLiteDatabase,
  portfolioId: string = 'default',
): Promise<HistoryPoint[]> {
  try {
    const targetDb = await resolveDb(db);
    return await getPortfolioHistory(targetDb, portfolioId);
  } catch {
    return [];
  }
}
