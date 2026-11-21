import type { SQLiteDatabase } from 'expo-sqlite';
import type { HistoryPoint } from '../types/generated';
import type { PortfolioHistoryEntity } from './schema';

/**
 * Persists historical valuation points for a portfolio.
 *
 * @param db SQLite database instance
 * @param portfolioId Portfolio identifier
 * @param points Historical valuation timeline checkpoints
 */
export async function savePortfolioHistory(
  db: SQLiteDatabase,
  portfolioId: string,
  points: HistoryPoint[],
): Promise<void> {
  if (points.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        `INSERT OR REPLACE INTO portfolio_history (portfolio_id, date, value, invested_amount)
         VALUES (?, ?, ?, ?);`,
        [portfolioId, p.date, p.value, p.investedAmount],
      );
    }
  });
}

/**
 * Retrieves stored historical valuation points for a portfolio in chronological order.
 *
 * @param db SQLite database instance
 * @param portfolioId Portfolio identifier
 * @returns Historical valuation points
 */
export async function getPortfolioHistory(
  db: SQLiteDatabase,
  portfolioId: string,
): Promise<HistoryPoint[]> {
  const rows = await db.getAllAsync<PortfolioHistoryEntity>(
    `SELECT portfolio_id, date, value, invested_amount
     FROM portfolio_history
     WHERE portfolio_id = ?
     ORDER BY date ASC;`,
    [portfolioId],
  );
  return rows.map((r) => ({
    date: r.date,
    value: r.value,
    investedAmount: r.invested_amount,
  }));
}
