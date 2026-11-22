import type { SQLiteDatabase } from 'expo-sqlite';
import type { PortfolioAnalyticsEntity } from './schema';

/**
 * Persists full analytical look-through, sector breakdown, and stock exposures for a portfolio.
 *
 * @param db - SQLite database instance
 * @param entity - Analytics entity containing serialized X-Ray and stock exposures
 */
export async function savePortfolioAnalytics(
  db: SQLiteDatabase,
  entity: PortfolioAnalyticsEntity,
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO portfolio_analytics (
      portfolio_id, xray_json, exposures_json, exposures_ex_arb_json, tax_summary_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?);`,
    [
      entity.portfolio_id,
      entity.xray_json,
      entity.exposures_json,
      entity.exposures_ex_arb_json,
      entity.tax_summary_json,
      entity.updated_at,
    ],
  );
}

/**
 * Retrieves cached analytical look-through and stock exposures from SQLite.
 *
 * If portfolioId is omitted, queries the first available portfolio analytics record.
 *
 * @param db - SQLite database instance
 * @param portfolioId - Optional portfolio identifier
 * @returns Cached portfolio analytics record or null
 */
export async function getPortfolioAnalytics(
  db: SQLiteDatabase,
  portfolioId?: string,
): Promise<PortfolioAnalyticsEntity | null> {
  if (portfolioId && portfolioId !== 'default') {
    return db.getFirstAsync<PortfolioAnalyticsEntity>(
      'SELECT * FROM portfolio_analytics WHERE portfolio_id = ?;',
      [portfolioId],
    );
  }

  return db.getFirstAsync<PortfolioAnalyticsEntity>(
    'SELECT * FROM portfolio_analytics ORDER BY updated_at DESC LIMIT 1;',
  );
}
