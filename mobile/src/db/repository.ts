import type { SQLiteDatabase } from 'expo-sqlite';
import type { AssetAllocationDto, PanBreakdownDto, SummaryMetrics } from '../types/generated';
import type {
  FolioEntity,
  HoldingEntity,
  NavHistoryEntity,
  PortfolioEntity,
  TransactionEntity,
} from './schema';
import {
  upsertTransaction,
  getTransactionsByFolio,
  deleteFolioAndTransactions,
} from './transaction-repository';

export {
  upsertTransaction,
  getTransactionsByFolio,
  deleteFolioAndTransactions,
};

export interface StoredSummaryEnvelope {
  metrics: SummaryMetrics;
  panBreakdowns?: PanBreakdownDto[] | undefined;
  assetAllocation?: AssetAllocationDto[] | undefined;
}

export interface PortfolioSnapshotInput {
  portfolio: PortfolioEntity;
  folios: FolioEntity[];
  holdings: HoldingEntity[];
  transactions?: TransactionEntity[];
}

export interface UpdateNavInput {
  nav: number;
  navDate: string;
  updatedAt?: string;
}

export {
  generateUuid,
  type EnqueueUploadInput,
  type QueueStatusOptions,
  type QueueCounts,
  getPendingUploads,
  enqueueUpload,
  updateQueueStatus,
  getQueueItemById,
  getAllUploads,
  getQueueCounts,
} from './upload-repository';

async function upsertPortfolio(
  db: SQLiteDatabase,
  portfolio: PortfolioEntity,
  summaryMetricsJson?: string | null,
): Promise<void> {
  const metricsPayload = summaryMetricsJson ?? portfolio.summary_metrics_json ?? null;
  await db.runAsync(
    `INSERT INTO portfolios (id, name, updated_at, summary_metrics_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at,
       summary_metrics_json = COALESCE(excluded.summary_metrics_json, portfolios.summary_metrics_json);`,
    [portfolio.id, portfolio.name, portfolio.updated_at, metricsPayload],
  );
}

async function upsertFolio(db: SQLiteDatabase, folio: FolioEntity): Promise<void> {
  await db.runAsync(
    `INSERT INTO folios (folio_number, amc_name, pan, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(folio_number) DO UPDATE SET
       amc_name = excluded.amc_name,
       pan = excluded.pan,
       updated_at = excluded.updated_at;`,
    [folio.folio_number, folio.amc_name, folio.pan, folio.updated_at],
  );
}

function buildCoreHoldingParams(holding: HoldingEntity) {
  return [
    holding.id, holding.folio_number, holding.amfi_code, holding.scheme_name, holding.isin,
    holding.units, holding.invested_cost, holding.current_nav, holding.current_value,
    holding.asset_class, holding.nav_date, holding.updated_at,
  ];
}

function buildMetricHoldingParams(holding: HoldingEntity) {
  return [
    holding.day_change ?? 0, holding.day_change_pct ?? 0, holding.xirr ?? null,
    holding.absolute_return ?? 0, holding.asset_category ?? null,
  ];
}

function buildTaxHoldingParams(holding: HoldingEntity) {
  return [
    holding.total_gain ?? null, holding.post_tax_xirr ?? null,
    holding.post_tax_absolute_return ?? null, holding.estimated_tax ?? null,
    holding.net_realizable_value ?? null,
  ];
}

function buildHoldingParams(holding: HoldingEntity) {
  return [
    ...buildCoreHoldingParams(holding),
    ...buildMetricHoldingParams(holding),
    ...buildTaxHoldingParams(holding),
  ];
}

async function upsertHolding(db: SQLiteDatabase, holding: HoldingEntity): Promise<void> {
  await db.runAsync(
    `INSERT INTO holdings (
       id, folio_number, amfi_code, scheme_name, isin,
       units, invested_cost, current_nav, current_value,
       asset_class, nav_date, updated_at,
       day_change, day_change_pct, xirr, absolute_return, asset_category,
       total_gain, post_tax_xirr, post_tax_absolute_return, estimated_tax, net_realizable_value
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       folio_number = excluded.folio_number, amfi_code = excluded.amfi_code,
       scheme_name = excluded.scheme_name, isin = excluded.isin,
       units = excluded.units, invested_cost = excluded.invested_cost,
       current_nav = excluded.current_nav, current_value = excluded.current_value,
       asset_class = excluded.asset_class, nav_date = excluded.nav_date,
       updated_at = excluded.updated_at, day_change = excluded.day_change,
       day_change_pct = excluded.day_change_pct, xirr = excluded.xirr,
       absolute_return = excluded.absolute_return, asset_category = excluded.asset_category,
       total_gain = excluded.total_gain, post_tax_xirr = excluded.post_tax_xirr,
       post_tax_absolute_return = excluded.post_tax_absolute_return,
       estimated_tax = excluded.estimated_tax, net_realizable_value = excluded.net_realizable_value;`,
    buildHoldingParams(holding),
  );
}

export async function savePortfolioSnapshot(
  db: SQLiteDatabase,
  snapshot: PortfolioSnapshotInput,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await upsertPortfolio(db, snapshot.portfolio);
    for (const folio of snapshot.folios) {
      await upsertFolio(db, folio);
    }
    for (const holding of snapshot.holdings) {
      await upsertHolding(db, holding);
    }
    if (snapshot.transactions) {
      for (const tx of snapshot.transactions) {
        await upsertTransaction(db, tx);
      }
    }
  });
}

/**
 * Atomically replaces non-manual server folios, holdings, and transactions with the
 * authoritative backend snapshot, pruning stale or deduplicated records while preserving
 * local MANUAL_* assets and persisting backend summary metrics.
 */
export async function reconcileServerSnapshot(
  db: SQLiteDatabase,
  snapshot: PortfolioSnapshotInput,
  summaryMetricsJson?: string | null,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM holdings WHERE folio_number NOT LIKE 'MANUAL_%';");
    await db.runAsync("DELETE FROM folios WHERE folio_number NOT LIKE 'MANUAL_%';");
    await db.runAsync("DELETE FROM transactions WHERE folio_number NOT LIKE 'MANUAL_%';");
    await upsertPortfolio(db, snapshot.portfolio, summaryMetricsJson);
    for (const folio of snapshot.folios) {
      await upsertFolio(db, folio);
    }
    for (const holding of snapshot.holdings) {
      await upsertHolding(db, holding);
    }
    if (snapshot.transactions) {
      for (const tx of snapshot.transactions) {
        await upsertTransaction(db, tx);
      }
    }
  });
}

function parseSummaryEnvelope(rawJson: string): StoredSummaryEnvelope | null {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (parsed && typeof parsed['metrics'] === 'object' && parsed['metrics'] !== null) {
      return parsed as unknown as StoredSummaryEnvelope;
    }
    if (parsed && typeof parsed['totalValue'] === 'number') {
      return { metrics: parsed as unknown as SummaryMetrics };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveScopedSummaryBundle(
  db: SQLiteDatabase,
  scopeId: string,
  bundle: StoredSummaryEnvelope,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO summary_cache (scope_id, summary_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(scope_id) DO UPDATE SET
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at;`,
    [scopeId, JSON.stringify(bundle), new Date().toISOString()],
  );
}

export async function getStoredSummaryBundle(
  db: SQLiteDatabase,
  scopeId: string = 'consolidated',
): Promise<StoredSummaryEnvelope | null> {
  const cached = await db.getFirstAsync<{ summary_json: string }>(
    'SELECT summary_json FROM summary_cache WHERE scope_id = ?;',
    [scopeId],
  );
  if (cached?.summary_json) return parseSummaryEnvelope(cached.summary_json);
  if (scopeId !== 'consolidated') return null;
  const row = await db.getFirstAsync<{ summary_metrics_json: string | null }>(
    'SELECT summary_metrics_json FROM portfolios WHERE summary_metrics_json IS NOT NULL ORDER BY updated_at DESC LIMIT 1;',
  );
  return row?.summary_metrics_json ? parseSummaryEnvelope(row.summary_metrics_json) : null;
}

export async function getStoredSummaryMetrics(
  db: SQLiteDatabase,
  scopeId: string = 'consolidated',
): Promise<SummaryMetrics | null> {
  const bundle = await getStoredSummaryBundle(db, scopeId);
  return bundle?.metrics ?? null;
}

export async function getPortfolioHoldings(
  db: SQLiteDatabase,
  folioNumber?: string,
): Promise<HoldingEntity[]> {
  if (folioNumber) {
    return db.getAllAsync<HoldingEntity>(
      'SELECT * FROM holdings WHERE units >= 0.001 AND folio_number = ? ORDER BY scheme_name ASC;',
      [folioNumber],
    );
  }
  return db.getAllAsync<HoldingEntity>(
    'SELECT * FROM holdings WHERE units >= 0.001 ORDER BY scheme_name ASC;',
  );
}

export async function getClosedHoldings(
  db: SQLiteDatabase,
): Promise<HoldingEntity[]> {
  return db.getAllAsync<HoldingEntity>(
    'SELECT * FROM holdings WHERE units < 0.001 ORDER BY scheme_name ASC;',
  );
}

export async function updateHoldingNav(
  db: SQLiteDatabase,
  amfiCode: string,
  update: UpdateNavInput,
): Promise<void> {
  const updatedAt = update.updatedAt ?? new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE holdings 
       SET current_nav = ?, current_value = units * ?, nav_date = ?, updated_at = ? 
       WHERE amfi_code = ? AND units >= 0.001;`,
      [update.nav, update.nav, update.navDate, updatedAt, amfiCode],
    );
    await db.runAsync(
      `INSERT INTO nav_history (amfi_code, date, nav) 
       VALUES (?, ?, ?) 
       ON CONFLICT(amfi_code, date) DO UPDATE SET nav = excluded.nav;`,
      [amfiCode, update.navDate, update.nav],
    );
  });
}

export async function getPortfolioById(
  db: SQLiteDatabase,
  id: string,
): Promise<PortfolioEntity | null> {
  return db.getFirstAsync<PortfolioEntity>(
    'SELECT id, name, updated_at FROM portfolios WHERE id = ?;',
    [id],
  );
}

export async function getAllFolios(
  db: SQLiteDatabase,
): Promise<FolioEntity[]> {
  return db.getAllAsync<FolioEntity>(
    'SELECT * FROM folios ORDER BY folio_number ASC;',
  );
}

export async function getNavHistory(
  db: SQLiteDatabase,
  amfiCode: string,
): Promise<NavHistoryEntity[]> {
  return db.getAllAsync<NavHistoryEntity>(
    'SELECT * FROM nav_history WHERE amfi_code = ? ORDER BY date ASC;',
    [amfiCode],
  );
}
