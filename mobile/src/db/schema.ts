export interface PortfolioEntity {
  id: string;
  name: string;
  updated_at: string;
}

export interface FolioEntity {
  folio_number: string;
  amc_name: string;
  pan: string;
  updated_at: string;
}

export interface HoldingEntity {
  id: string;
  folio_number: string;
  amfi_code: string | null;
  scheme_name: string;
  isin: string | null;
  units: number;
  invested_cost: number;
  current_nav: number;
  current_value: number;
  asset_class: string;
  nav_date: string;
  updated_at: string;
}

export interface NavHistoryEntity {
  amfi_code: string;
  date: string;
  nav: number;
}

export type SyncQueueStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SyncQueueItem {
  id: string;
  file_path: string;
  file_name: string;
  status: SyncQueueStatus;
  password_key: string | null;
  created_at: string;
  updated_at: string;
  retry_count: number;
}

export const CREATE_PORTFOLIOS_TABLE = `
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`.trim();

export const CREATE_FOLIOS_TABLE = `
CREATE TABLE IF NOT EXISTS folios (
  folio_number TEXT PRIMARY KEY,
  amc_name TEXT NOT NULL,
  pan TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`.trim();

export const CREATE_HOLDINGS_TABLE = `
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  folio_number TEXT NOT NULL,
  amfi_code TEXT,
  scheme_name TEXT NOT NULL,
  isin TEXT,
  units REAL NOT NULL,
  invested_cost REAL NOT NULL,
  current_nav REAL NOT NULL,
  current_value REAL NOT NULL,
  asset_class TEXT NOT NULL,
  nav_date TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`.trim();

export const CREATE_NAV_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS nav_history (
  amfi_code TEXT NOT NULL,
  date TEXT NOT NULL,
  nav REAL NOT NULL,
  PRIMARY KEY (amfi_code, date)
);
`.trim();

export const CREATE_SYNC_QUEUE_TABLE = `
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL,
  password_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0
);
`.trim();

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_holdings_folio ON holdings (folio_number);
CREATE INDEX IF NOT EXISTS idx_holdings_amfi ON holdings (amfi_code);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
`.trim();

export const MIGRATION_STATEMENTS = [
  CREATE_PORTFOLIOS_TABLE,
  CREATE_FOLIOS_TABLE,
  CREATE_HOLDINGS_TABLE,
  CREATE_NAV_HISTORY_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_INDEXES,
] as const;

export const CREATE_TABLES_SQL = MIGRATION_STATEMENTS.join('\n\n');
