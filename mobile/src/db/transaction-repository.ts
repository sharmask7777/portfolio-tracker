import type { SQLiteDatabase } from 'expo-sqlite';
import type { TransactionEntity } from './schema';

/**
 * Persists a transaction entity into SQLite.
 *
 * @param db SQLite database instance
 * @param tx Transaction record
 */
export async function upsertTransaction(db: SQLiteDatabase, tx: TransactionEntity): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (id, folio_number, date, type, units, nav, amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       folio_number = excluded.folio_number,
       date = excluded.date,
       type = excluded.type,
       units = excluded.units,
       nav = excluded.nav,
       amount = excluded.amount,
       created_at = excluded.created_at;`,
    [tx.id, tx.folio_number, tx.date, tx.type, tx.units, tx.nav, tx.amount, tx.created_at],
  );
}

/**
 * Retrieves all chronological transactions recorded for a given folio.
 *
 * @param db SQLite database instance
 * @param folioNumber Folio identifier
 * @returns Array of transaction records
 */
export async function getTransactionsByFolio(
  db: SQLiteDatabase,
  folioNumber: string,
): Promise<TransactionEntity[]> {
  return db.getAllAsync<TransactionEntity>(
    'SELECT * FROM transactions WHERE folio_number = ? ORDER BY date DESC, created_at DESC;',
    [folioNumber],
  );
}

/**
 * Deletes a folio along with its associated child holdings and transactions.
 *
 * @param db SQLite database instance
 * @param folioNumber Folio identifier
 */
export async function deleteFolioAndTransactions(
  db: SQLiteDatabase,
  folioNumber: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions WHERE folio_number = ?;', [folioNumber]);
    await db.runAsync('DELETE FROM holdings WHERE folio_number = ?;', [folioNumber]);
    await db.runAsync('DELETE FROM folios WHERE folio_number = ?;', [folioNumber]);
  });
}
