import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';

export const DEFAULT_DATABASE_NAME = 'portfolio.db';

let databaseInstance: SQLiteDatabase | null = null;

export async function initDatabase(customDb?: SQLiteDatabase): Promise<SQLiteDatabase> {
  const db = customDb ?? (await openDatabaseAsync(DEFAULT_DATABASE_NAME));
  if (db && typeof db.execAsync === 'function') {
    await db.execAsync(CREATE_TABLES_SQL);
  }
  databaseInstance = db;
  return db;
}

export function getDatabaseInstance(): SQLiteDatabase | null {
  return databaseInstance;
}

export function setDatabaseInstance(db: SQLiteDatabase | null): void {
  databaseInstance = db;
}

export async function closeDatabase(db?: SQLiteDatabase): Promise<void> {
  const target = db ?? databaseInstance;
  if (!target) {
    return;
  }
  await target.closeAsync();
  if (target === databaseInstance) {
    databaseInstance = null;
  }
}
