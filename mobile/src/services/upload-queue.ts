import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  enqueueUpload,
  getPendingUploads,
  updateQueueStatus,
  getAllUploads,
  getQueueCounts,
  generateUuid,
} from '../db/repository';
import type { SyncQueueItem, SyncQueueStatus } from '../db/schema';
import { getStoredCredentials } from './auth-service';
import { checkServerReachable } from './portfolio-service';

export type { SyncQueueItem, SyncQueueStatus };

export const DEFAULT_UPLOAD_ENDPOINT = '/api/portfolio/upload';

export interface EnqueueCasUploadInput {
  filePath: string;
  fileName: string;
  password?: string | null;
}

export interface FlushUploadOptions {
  db?: SQLiteDatabase;
  endpoint?: string;
}

export interface FlushResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface UploadQueueStatus {
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  history: SyncQueueItem[];
}

interface ServerUploadAuth {
  serverUrl: string;
  token?: string | null;
  endpoint?: string | undefined;
}

interface ItemUploadResult {
  success: boolean;
  error?: string;
}

async function resolveDb(db?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (db) return db;
  const existing = getDatabaseInstance();
  if (existing) return existing;
  return initDatabase();
}

export function buildUploadUrl(
  serverUrl: string,
  endpoint: string = DEFAULT_UPLOAD_ENDPOINT,
): string {
  const base = serverUrl.trim().replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

async function readQueuePassword(passwordKey: string | null): Promise<string> {
  if (!passwordKey) return '';
  try {
    return (await SecureStore.getItemAsync(passwordKey)) ?? '';
  } catch {
    return '';
  }
}

async function executeUploadRequest(
  item: SyncQueueItem,
  auth: ServerUploadAuth,
  password: string,
): Promise<{ status: number; ok: boolean }> {
  const formData = new FormData();
  formData.append('file', {
    uri: item.file_path,
    name: item.file_name,
    type: 'application/pdf',
  } as unknown as Blob);

  if (password.length > 0) {
    formData.append('password', password);
  }

  const headers: Record<string, string> = {};
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const endpoint = auth.endpoint ?? DEFAULT_UPLOAD_ENDPOINT;
  const url = buildUploadUrl(auth.serverUrl, endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  return { status: res.status, ok: res.status === 200 || res.status === 201 };
}

async function uploadSingleItem(
  item: SyncQueueItem,
  auth: ServerUploadAuth,
  db: SQLiteDatabase,
): Promise<ItemUploadResult> {
  await updateQueueStatus(db, item.id, 'PROCESSING');
  const password = await readQueuePassword(item.password_key);

  try {
    const res = await executeUploadRequest(item, auth, password);
    if (res.ok) {
      await updateQueueStatus(db, item.id, 'COMPLETED');
      if (item.password_key) {
        await SecureStore.deleteItemAsync(item.password_key).catch(() => {});
      }
      return { success: true };
    }

    const nextStatus = res.status >= 400 && res.status < 500 ? 'FAILED' : 'PENDING';
    await updateQueueStatus(db, item.id, { status: nextStatus, incrementRetry: true });
    return { success: false, error: `Upload rejected with HTTP ${res.status}` };
  } catch (err) {
    await updateQueueStatus(db, item.id, { status: 'PENDING', incrementRetry: true });
    const msg = err instanceof Error ? err.message : 'Upload network error';
    return { success: false, error: msg };
  }
}

async function getFallbackCredentials(
  targetUrl: string,
  token: string,
): Promise<{ serverUrl: string; token: string }> {
  if (targetUrl && token) {
    return { serverUrl: targetUrl, token };
  }
  const creds = await getStoredCredentials();
  return {
    serverUrl: targetUrl || creds.serverUrl || '',
    token: token || creds.token || '',
  };
}

async function resolveServerAuth(
  serverUrl?: string,
  deviceToken?: string,
  endpoint?: string,
): Promise<ServerUploadAuth | null> {
  const initialUrl = serverUrl ? serverUrl.trim() : '';
  const initialToken = deviceToken ?? '';
  const creds = await getFallbackCredentials(initialUrl, initialToken);

  if (!creds.serverUrl) {
    return null;
  }

  return {
    serverUrl: creds.serverUrl,
    token: creds.token || null,
    endpoint,
  };
}

async function processPendingBatch(
  items: SyncQueueItem[],
  auth: ServerUploadAuth,
  db: SQLiteDatabase,
): Promise<FlushResult> {
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const result = await uploadSingleItem(item, auth, db);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }

  return {
    processed: items.length,
    succeeded,
    failed,
    errors,
  };
}

export async function enqueueCasUpload(
  input: EnqueueCasUploadInput,
  db?: SQLiteDatabase,
): Promise<SyncQueueItem> {
  const database = await resolveDb(db);
  const queueId = generateUuid();
  let passwordKey: string | null = null;

  if (input.password && input.password.trim().length > 0) {
    passwordKey = `CAS_PWD_${queueId}`;
    await SecureStore.setItemAsync(passwordKey, input.password.trim());
  }

  return enqueueUpload(database, {
    id: queueId,
    filePath: input.filePath,
    fileName: input.fileName,
    passwordKey,
  });
}

export async function flushUploadQueue(
  serverUrl?: string,
  deviceToken?: string,
  options?: FlushUploadOptions,
): Promise<FlushResult> {
  const auth = await resolveServerAuth(serverUrl, deviceToken, options?.endpoint);
  if (!auth) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: ['Server URL not configured'],
    };
  }

  const database = await resolveDb(options?.db);
  const pendingItems = await getPendingUploads(database);
  if (pendingItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  return processPendingBatch(pendingItems, auth, database);
}

export async function getUploadQueueStatus(
  db?: SQLiteDatabase,
  limit = 50,
): Promise<UploadQueueStatus> {
  const database = await resolveDb(db);
  const [counts, history] = await Promise.all([
    getQueueCounts(database),
    getAllUploads(database, limit),
  ]);

  return {
    pendingCount: counts.pending,
    completedCount: counts.completed,
    failedCount: counts.failed,
    totalCount: counts.total,
    history,
  };
}

export async function isServerReachable(
  serverUrl: string,
  timeoutMs = 3000,
): Promise<boolean> {
  return checkServerReachable(serverUrl, timeoutMs);
}
