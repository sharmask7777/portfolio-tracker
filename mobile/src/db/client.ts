import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';

export const DEFAULT_DATABASE_NAME = 'portfolio.db';

const MIGRATION_ALTERS = [
  'ALTER TABLE holdings ADD COLUMN day_change REAL DEFAULT 0;',
  'ALTER TABLE holdings ADD COLUMN day_change_pct REAL DEFAULT 0;',
  'ALTER TABLE holdings ADD COLUMN xirr REAL DEFAULT 0;',
  'ALTER TABLE holdings ADD COLUMN absolute_return REAL DEFAULT 0;',
  'ALTER TABLE holdings ADD COLUMN asset_category TEXT;',
] as const;

let databaseInstance: SQLiteDatabase | null = null;

async function runSafeMigrations(db: SQLiteDatabase): Promise<void> {
  for (const alter of MIGRATION_ALTERS) {
    try {
      await db.execAsync(alter);
    } catch {
      // Safely ignore if column already exists
    }
  }
}

export async function initDatabase(customDb?: SQLiteDatabase): Promise<SQLiteDatabase> {
  const db = customDb ?? (await openDatabaseAsync(DEFAULT_DATABASE_NAME));
  if (db && typeof db.execAsync === 'function') {
    await db.execAsync(CREATE_TABLES_SQL);
    await runSafeMigrations(db);
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
