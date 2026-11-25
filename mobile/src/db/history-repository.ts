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
        `INSERT OR REPLACE INTO portfolio_history (
           portfolio_id, date, value, invested_amount,
           unrealized_gain, gain_percentage, is_ath, ath_value, drawdown_percentage
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          portfolioId,
          p.date,
          p.value,
          p.investedAmount,
          p.unrealizedGain,
          p.gainPercentage,
          p.isAth ? 1 : 0,
          p.athValue,
          p.drawdownPercentage,
        ],
      );
    }
  });
}

/**
 * Retrieves stored historical valuation points for a portfolio in chronological order.
 * If the provided portfolioId is 'default' and no explicit points match, falls back to the
 * first available portfolio id in SQLite.
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
    `SELECT portfolio_id, date, value, invested_amount,
            unrealized_gain, gain_percentage, is_ath, ath_value, drawdown_percentage
     FROM portfolio_history
     WHERE portfolio_id = (
       CASE 
         WHEN EXISTS (SELECT 1 FROM portfolio_history WHERE portfolio_id = ?) THEN ?
         WHEN ? = 'default' OR ? = '' THEN (
           COALESCE(
             (SELECT id FROM portfolios LIMIT 1),
             (SELECT portfolio_id FROM portfolio_history LIMIT 1)
           )
         )
         ELSE ?
       END
     )
     ORDER BY date ASC;`,
    [portfolioId, portfolioId, portfolioId, portfolioId, portfolioId],
  );
  return rows.map((r) => {
    const fallbackGain = Math.round((r.value - r.invested_amount) * 100) / 100;
    const fallbackGainPct = r.invested_amount > 0
      ? Math.round(((fallbackGain / r.invested_amount) * 100) * 100) / 100
      : 0;
    return {
      date: r.date,
      value: r.value,
      investedAmount: r.invested_amount,
      unrealizedGain: r.unrealized_gain ?? fallbackGain,
      gainPercentage: r.gain_percentage ?? fallbackGainPct,
      isAth: r.is_ath === 1,
      athValue: r.ath_value ?? r.value,
      drawdownPercentage: r.drawdown_percentage ?? 0,
    };
  });
}
