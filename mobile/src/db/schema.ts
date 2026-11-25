export interface PortfolioEntity {
  id: string;
  name: string;
  updated_at: string;
  summary_metrics_json?: string | null | undefined;
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
  day_change?: number | undefined;
  day_change_pct?: number | undefined;
  xirr?: number | undefined;
  absolute_return?: number | undefined;
  asset_category?: string | null | undefined;
}

export interface TransactionEntity {
  id: string;
  folio_number: string;
  date: string;
  type: string;
  units: number;
  nav: number;
  amount: number;
  created_at: string;
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

export interface PortfolioHistoryEntity {
  portfolio_id: string;
  date: string;
  value: number;
  invested_amount: number;
}

export interface PortfolioAnalyticsEntity {
  portfolio_id: string;
  xray_json: string;
  exposures_json: string;
  exposures_ex_arb_json: string;
  tax_summary_json: string | null;
  updated_at: string;
}

export const CREATE_PORTFOLIOS_TABLE = `
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary_metrics_json TEXT
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
  updated_at TEXT NOT NULL,
  day_change REAL DEFAULT 0,
  day_change_pct REAL DEFAULT 0,
  xirr REAL DEFAULT 0,
  absolute_return REAL DEFAULT 0,
  asset_category TEXT
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

export const CREATE_PORTFOLIO_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS portfolio_history (
  portfolio_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  invested_amount REAL NOT NULL,
  PRIMARY KEY (portfolio_id, date)
);
`.trim();

export const CREATE_PORTFOLIO_ANALYTICS_TABLE = `
CREATE TABLE IF NOT EXISTS portfolio_analytics (
  portfolio_id TEXT PRIMARY KEY,
  xray_json TEXT NOT NULL,
  exposures_json TEXT NOT NULL,
  exposures_ex_arb_json TEXT NOT NULL,
  tax_summary_json TEXT,
  updated_at TEXT NOT NULL
);
`.trim();

export const CREATE_TRANSACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  folio_number TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  units REAL NOT NULL,
  nav REAL NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL
);
`.trim();

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_holdings_folio ON holdings (folio_number);
CREATE INDEX IF NOT EXISTS idx_holdings_amfi ON holdings (amfi_code);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_id ON portfolio_history (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_folio ON transactions (folio_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
`.trim();

export const MIGRATION_STATEMENTS = [
  CREATE_PORTFOLIOS_TABLE,
  CREATE_FOLIOS_TABLE,
  CREATE_HOLDINGS_TABLE,
  CREATE_NAV_HISTORY_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_PORTFOLIO_HISTORY_TABLE,
  CREATE_PORTFOLIO_ANALYTICS_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_INDEXES,
] as const;

export const CREATE_TABLES_SQL = MIGRATION_STATEMENTS.join('\n\n');
