import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncQueueItem, SyncQueueStatus } from './schema';
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

export interface QueueStatusOptions {
  status: SyncQueueStatus;
  incrementRetry?: boolean;
}

export interface QueueCounts {
  pending: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Retrieves pending upload jobs from sync_queue table.
 *
 * @param db SQLite database instance
 * @returns Array of pending items
 */
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

/**
 * Enqueues a new CAS upload task.
 *
 * @param db SQLite database instance
 * @param input Upload item details
 * @returns Enqueued queue item
 */
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

/**
 * Updates status and retry count of a sync queue task.
 *
 * @param db SQLite database instance
 * @param id Queue item ID
 * @param statusOrOptions New status or options
 */
export async function updateQueueStatus(
  db: SQLiteDatabase,
  id: string,
  statusOrOptions: SyncQueueStatus | QueueStatusOptions,
): Promise<void> {
  const status = typeof statusOrOptions === 'string' ? statusOrOptions : statusOrOptions.status;
  const incrementRetry = typeof statusOrOptions === 'string' ? false : (statusOrOptions.incrementRetry ?? false);
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue 
     SET status = ?, updated_at = ?,
         retry_count = CASE WHEN ? = 'FAILED' OR ? = 1 THEN retry_count + 1 ELSE retry_count END
     WHERE id = ?;`,
    [status, updatedAt, status, incrementRetry ? 1 : 0, id],
  );
}

/**
 * Fetches single queue item by ID.
 *
 * @param db SQLite database instance
 * @param id Task ID
 * @returns Queue item or null
 */
export async function getQueueItemById(
  db: SQLiteDatabase,
  id: string,
): Promise<SyncQueueItem | null> {
  return db.getFirstAsync<SyncQueueItem>(
    'SELECT * FROM sync_queue WHERE id = ?;',
    [id],
  );
}

/**
 * Lists all uploads up to limit.
 *
 * @param db SQLite database instance
 * @param limit Query limit
 * @returns Array of sync queue items
 */
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

/**
 * Computes summary count statistics of sync queue items.
 *
 * @param db SQLite database instance
 * @returns Queue counts
 */
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
