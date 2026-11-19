import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  FolioEntity,
  HoldingEntity,
  NavHistoryEntity,
  PortfolioEntity,
  SyncQueueItem,
  SyncQueueStatus,
} from './schema';

export interface PortfolioSnapshotInput {
  portfolio: PortfolioEntity;
  folios: FolioEntity[];
  holdings: HoldingEntity[];
}

export interface UpdateNavInput {
  nav: number;
  navDate: string;
  updatedAt?: string;
}

export interface EnqueueUploadInput {
  id?: string;
  filePath: string;
  fileName: string;
  passwordKey?: string | null;
  status?: SyncQueueStatus;
  createdAt?: string;
  updatedAt?: string;
  retryCount?: number;
}

function formatUuid(bytes: Uint8Array): string {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return formatUuid(bytes);
}

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

export async function getPendingUploads(
  db: SQLiteDatabase,
): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT id, file_path, file_name, status, password_key, created_at, updated_at, retry_count
     FROM sync_queue
     WHERE status = 'PENDING'
     ORDER BY created_at ASC;`,
  );
}

export async function enqueueUpload(
  db: SQLiteDatabase,
  input: EnqueueUploadInput,
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();
  const item: SyncQueueItem = {
    id: input.id ?? generateUuid(),
    file_path: input.filePath,
    file_name: input.fileName,
    status: input.status ?? 'PENDING',
    password_key: input.passwordKey ?? null,
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
    retry_count: input.retryCount ?? 0,
  };

  await db.runAsync(
    `INSERT INTO sync_queue (id, file_path, file_name, status, password_key, created_at, updated_at, retry_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      item.id,
      item.file_path,
      item.file_name,
      item.status,
      item.password_key,
      item.created_at,
      item.updated_at,
      item.retry_count,
    ],
  );

  return item;
}

export async function updateQueueStatus(
  db: SQLiteDatabase,
  id: string,
  status: SyncQueueStatus,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue 
     SET status = ?, updated_at = ?,
         retry_count = CASE WHEN ? = 'FAILED' THEN retry_count + 1 ELSE retry_count END
     WHERE id = ?;`,
    [status, updatedAt, status, id],
  );
}

export async function getQueueItemById(
  db: SQLiteDatabase,
  id: string,
): Promise<SyncQueueItem | null> {
  return db.getFirstAsync<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE id = ?;',
    [id],
  );
}

export interface QueueCounts {
  pending: number;
  completed: number;
  failed: number;
  total: number;
}

export async function getAllUploads(
  db: SQLiteDatabase,
  limit = 50,
): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT id, file_path, file_name, status, password_key, created_at, updated_at, retry_count
     FROM sync_queue
     ORDER BY created_at DESC, rowid DESC
     LIMIT ?;`,
    [limit],
  );
}

export async function getQueueCounts(db: SQLiteDatabase): Promise<QueueCounts> {
  const rows = await db.getAllAsync<{ status: SyncQueueStatus; count: number }>(
    'SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status;',
  );
  let pending = 0;
  let completed = 0;
  let failed = 0;
  let total = 0;
  for (const row of rows) {
    total += row.count;
    if (row.status === 'PENDING' || row.status === 'PROCESSING') {
      pending += row.count;
    } else if (row.status === 'COMPLETED') {
      completed += row.count;
    } else if (row.status === 'FAILED') {
      failed += row.count;
    }
  }
  return { pending, completed, failed, total };
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
