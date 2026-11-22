import type { SQLiteDatabase } from 'expo-sqlite';
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

async function upsertPortfolio(db: SQLiteDatabase, portfolio: PortfolioEntity): Promise<void> {
  await db.runAsync(
    `INSERT INTO portfolios (id, name, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at;`,
    [portfolio.id, portfolio.name, portfolio.updated_at],
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

async function upsertHolding(db: SQLiteDatabase, holding: HoldingEntity): Promise<void> {
  await db.runAsync(
    `INSERT INTO holdings (
       id, folio_number, amfi_code, scheme_name, isin,
       units, invested_cost, current_nav, current_value,
       asset_class, nav_date, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       folio_number = excluded.folio_number,
       amfi_code = excluded.amfi_code,
       scheme_name = excluded.scheme_name,
       isin = excluded.isin,
       units = excluded.units,
       invested_cost = excluded.invested_cost,
       current_nav = excluded.current_nav,
       current_value = excluded.current_value,
       asset_class = excluded.asset_class,
       nav_date = excluded.nav_date,
       updated_at = excluded.updated_at;`,
    [
      holding.id,
      holding.folio_number,
      holding.amfi_code,
      holding.scheme_name,
      holding.isin,
      holding.units,
      holding.invested_cost,
      holding.current_nav,
      holding.current_value,
      holding.asset_class,
      holding.nav_date,
      holding.updated_at,
    ],
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

export async function getPortfolioHoldings(
  db: SQLiteDatabase,
  folioNumber?: string,
): Promise<HoldingEntity[]> {
  if (folioNumber) {
    return db.getAllAsync<HoldingEntity>(
      'SELECT * FROM holdings WHERE units > 0 AND folio_number = ? ORDER BY scheme_name ASC;',
      [folioNumber],
    );
  }
  return db.getAllAsync<HoldingEntity>(
    'SELECT * FROM holdings WHERE units > 0 ORDER BY scheme_name ASC;',
  );
}

export async function getClosedHoldings(
  db: SQLiteDatabase,
): Promise<HoldingEntity[]> {
  return db.getAllAsync<HoldingEntity>(
    'SELECT * FROM holdings WHERE units = 0 ORDER BY scheme_name ASC;',
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
       WHERE amfi_code = ?;`,
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
    'SELECT * FROM portfolios WHERE id = ?;',
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
