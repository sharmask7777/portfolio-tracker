import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';

const { mockStorage, mockDocumentPicker, mockLocalAuth } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockDocumentPicker: {
    getDocumentAsync: vi.fn(),
  },
  mockLocalAuth: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    authenticateAsync: vi.fn(),
  },
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => createInMemoryTestDatabase()),
}));

vi.mock('expo-local-authentication', () => mockLocalAuth);

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string): Promise<void> => {
    mockStorage.delete(key);
  }),
}));

vi.mock('expo-document-picker', () => mockDocumentPicker);

import { initDatabase, closeDatabase, setDatabaseInstance } from '../db/client';
import {
  getPendingUploads,
  getQueueItemById,
  updateQueueStatus,
} from '../db/repository';
import {
  DEFAULT_UPLOAD_ENDPOINT,
  buildUploadUrl,
  enqueueCasUpload,
  flushUploadQueue,
  getUploadQueueStatus,
  isServerReachable,
} from './upload-queue';
import {
  pickCasDocument,
  submitCasUpload,
  runOutboxSync,
} from './upload-actions';
import { saveStoredCredentials } from './auth-service';

type SqlInput = null | number | bigint | string | Uint8Array;

function extractParams(args: unknown[]): SqlInput[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as SqlInput[];
  }
  return args as SqlInput[];
}

function createInMemoryTestDatabase(): SQLiteDatabase {
  const nodeDb = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => {
      nodeDb.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        lastInsertRowId: Number(res.lastInsertRowid),
        changes: Number(res.changes),
      };
    },
    getAllAsync: async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      return stmt.all(...params) as unknown as T[];
    },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.get(...params);
      return (res ?? null) as unknown as T | null;
    },
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      nodeDb.exec('BEGIN TRANSACTION;');
      try {
        const result = await task();
        nodeDb.exec('COMMIT;');
        return result;
      } catch (err) {
        nodeDb.exec('ROLLBACK;');
        throw err;
      }
    },
    closeAsync: async () => {
      nodeDb.close();
    },
  } as unknown as SQLiteDatabase;
}

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('upload-queue service & CAS upload workflow', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    mockStorage.clear();
    mockFetch.mockReset();
    vi.clearAllMocks();
    db = createInMemoryTestDatabase();
    await initDatabase(db);
    setDatabaseInstance(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
    setDatabaseInstance(null);
  });

  describe('buildUploadUrl', () => {
    it('constructs correct default endpoint URL', () => {
      expect(DEFAULT_UPLOAD_ENDPOINT).toBe('/api/portfolio/upload');
      expect(buildUploadUrl('https://api.example.com')).toBe(
        `https://api.example.com${DEFAULT_UPLOAD_ENDPOINT}`,
      );
      expect(buildUploadUrl('https://api.example.com/')).toBe(
        `https://api.example.com${DEFAULT_UPLOAD_ENDPOINT}`,
      );
    });

    it('respects custom endpoint paths with or without leading slashes', () => {
      expect(buildUploadUrl('https://api.example.com', '/api/cas/upload')).toBe(
        'https://api.example.com/api/cas/upload',
      );
      expect(buildUploadUrl('https://api.example.com', 'api/portfolio/upload')).toBe(
        'https://api.example.com/api/portfolio/upload',
      );
    });
  });

  describe('enqueueCasUpload & secure password storage', () => {
    it('enqueues a statement without password', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///data/cas_jan.pdf',
          fileName: 'cas_jan.pdf',
          password: null,
        },
        db,
      );

      expect(item.id).toBeDefined();
      expect(item.file_name).toBe('cas_jan.pdf');
      expect(item.file_path).toBe('file:///data/cas_jan.pdf');
      expect(item.status).toBe('PENDING');
      expect(item.password_key).toBeNull();
      expect(item.retry_count).toBe(0);

      const pending = await getPendingUploads(db);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(item.id);
    });

    it('securely stores password in SecureStore when provided', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///data/cams_protected.pdf',
          fileName: 'cams_protected.pdf',
          password: 'SECURE_PAN_PASSWORD',
        },
        db,
      );

      expect(item.password_key).toBeDefined();
      expect(item.password_key).toMatch(/^CAS_PWD_/);

      const storedPassword = mockStorage.get(item.password_key!);
      expect(storedPassword).toBe('SECURE_PAN_PASSWORD');

      const persisted = await getQueueItemById(db, item.id);
      expect(persisted?.password_key).toBe(item.password_key);
    });
  });

  describe('flushUploadQueue online synchronization', () => {
    it('returns error when server URL is not configured and no stored credentials exist', async () => {
      const result = await flushUploadQueue(undefined, undefined, { db });
      expect(result.processed).toBe(0);
      expect(result.errors).toContain('Server URL not configured');
    });

    it('returns zero processed when queue is empty', async () => {
      const result = await flushUploadQueue(
        'https://portfolio.test',
        'token-123',
        { db },
      );
      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('flushes pending upload, sends multipart request, marks COMPLETED, and deletes password', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///var/mobile/cams.pdf',
          fileName: 'cams.pdf',
          password: 'MY_PAN_SECRET',
        },
        db,
      );

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      const result = await flushUploadQueue(
        'https://portfolio.test',
        'device-jwt-token',
        { db },
      );

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call?.[0]).toBe(`https://portfolio.test${DEFAULT_UPLOAD_ENDPOINT}`);

      const reqInit = call?.[1] as RequestInit;
      expect(reqInit.method).toBe('POST');
      expect((reqInit.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer device-jwt-token',
      );
      expect(reqInit.body).toBeInstanceOf(FormData);

      // Verify item updated in SQLite
      const updated = await getQueueItemById(db, item.id);
      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.retry_count).toBe(0);

      // Verify password was removed from SecureStore
      expect(mockStorage.has(item.password_key!)).toBe(false);

      // Verify queue is now empty of pending items
      const pending = await getPendingUploads(db);
      expect(pending).toHaveLength(0);
    });

    it('uses fallback credentials from auth-service if not explicitly provided', async () => {
      await saveStoredCredentials('https://paired.server.io', 'paired-jwt-token', {
        id: 'user-1',
        email: 'user@example.com',
      });

      await enqueueCasUpload(
        {
          filePath: 'file:///var/mobile/kfin.pdf',
          fileName: 'kfin.pdf',
        },
        db,
      );

      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
      });

      const result = await flushUploadQueue(undefined, undefined, { db });
      expect(result.succeeded).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://paired.server.io${DEFAULT_UPLOAD_ENDPOINT}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer paired-jwt-token',
          }),
        }),
      );
    });
  });

  describe('offline queuing & failure retry increments', () => {
    it('marks item FAILED and increments retry_count when server responds with HTTP 500', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///var/mobile/error_cas.pdf',
          fileName: 'error_cas.pdf',
          password: 'PAN_PRESERVED',
        },
        db,
      );

      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
      });

      const result = await flushUploadQueue(
        'https://portfolio.test',
        'token-abc',
        { db },
      );

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('HTTP 500');

      const updated = await getQueueItemById(db, item.id);
      expect(updated?.status).toBe('PENDING');
      expect(updated?.retry_count).toBe(1);

      // Password should NOT be deleted on failure
      expect(mockStorage.get(item.password_key!)).toBe('PAN_PRESERVED');
    });

    it('marks item FAILED permanently on 400 Bad Request error', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///var/mobile/corrupted_cas.pdf',
          fileName: 'corrupted_cas.pdf',
        },
        db,
      );

      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
      });

      const result = await flushUploadQueue(
        'https://portfolio.test',
        'token-abc',
        { db },
      );

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);

      const updated = await getQueueItemById(db, item.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.retry_count).toBe(1);
    });

    it('handles network failure exception gracefully and increments retry count', async () => {
      const item = await enqueueCasUpload(
        {
          filePath: 'file:///var/mobile/network_err.pdf',
          fileName: 'network_err.pdf',
        },
        db,
      );

      mockFetch.mockRejectedValueOnce(new Error('Network request failed: unreachable'));

      const result = await flushUploadQueue(
        'https://portfolio.test',
        'token-abc',
        { db },
      );

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toBe('Network request failed: unreachable');

      const updated = await getQueueItemById(db, item.id);
      expect(updated?.status).toBe('PENDING');
      expect(updated?.retry_count).toBe(1);

      // Retry again increments retry_count further
      await updateQueueStatus(db, item.id, 'PENDING');
      mockFetch.mockRejectedValueOnce(new Error('Connection timed out'));

      await flushUploadQueue('https://portfolio.test', 'token-abc', { db });
      const updatedTwice = await getQueueItemById(db, item.id);
      expect(updatedTwice?.retry_count).toBe(2);
    });
  });

  describe('getUploadQueueStatus', () => {
    it('aggregates pending, completed, and failed counts with full history', async () => {
      const item1 = await enqueueCasUpload(
        { filePath: '/p1.pdf', fileName: 'p1.pdf' },
        db,
      );
      const item2 = await enqueueCasUpload(
        { filePath: '/p2.pdf', fileName: 'p2.pdf' },
        db,
      );
      const item3 = await enqueueCasUpload(
        { filePath: '/p3.pdf', fileName: 'p3.pdf' },
        db,
      );

      await updateQueueStatus(db, item1.id, 'COMPLETED');
      await updateQueueStatus(db, item2.id, 'FAILED');

      const status = await getUploadQueueStatus(db);
      expect(status.totalCount).toBe(3);
      expect(status.pendingCount).toBe(1);
      expect(status.completedCount).toBe(1);
      expect(status.failedCount).toBe(1);
      expect(status.history).toHaveLength(3);
      expect(status.history[0]?.id).toBe(item3.id);
    });
  });

  describe('isServerReachable', () => {
    it('returns true when health endpoint responds < 500', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });
      const reachable = await isServerReachable('https://server.domain');
      expect(reachable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://server.domain/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns false when health check returns 500 or network fails', async () => {
      mockFetch.mockResolvedValueOnce({ status: 503 });
      expect(await isServerReachable('https://server.domain')).toBe(false);

      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await isServerReachable('https://server.domain')).toBe(false);

      expect(await isServerReachable('')).toBe(false);
    });
  });

  describe('Document Selection & Screen Action Handlers', () => {
    it('calls onSelect with asset details when user picks a document', async () => {
      mockDocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            name: 'cams_cas_march.pdf',
            uri: 'file:///cache/cams_cas_march.pdf',
            size: 2048000,
          },
        ],
      });

      const onSelect = vi.fn();
      const onError = vi.fn();

      await pickCasDocument(onSelect, onError);
      expect(onSelect).toHaveBeenCalledWith({
        name: 'cams_cas_march.pdf',
        uri: 'file:///cache/cams_cas_march.pdf',
        size: 2048000,
      });
      expect(onError).not.toHaveBeenCalled();
    });

    it('ignores canceled picker action', async () => {
      mockDocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const onSelect = vi.fn();
      const onError = vi.fn();

      await pickCasDocument(onSelect, onError);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('handles document picker error exception', async () => {
      mockDocumentPicker.getDocumentAsync.mockRejectedValueOnce(
        new Error('Permission denied'),
      );

      const onSelect = vi.fn();
      const onError = vi.fn();

      await pickCasDocument(onSelect, onError);
      expect(onError).toHaveBeenCalledWith('Failed to open document picker');
    });

    it('submitCasUpload enqueues to outbox and triggers upload when server is online', async () => {
      await saveStoredCredentials('https://api.portfolio.org', 'token-online', {
        id: 'u1',
        email: 'u1@example.com',
      });

      // Health check returns 200 (online)
      mockFetch.mockResolvedValueOnce({ status: 200 });
      // Upload returns 200 (success)
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });

      const onStatus = vi.fn();
      await submitCasUpload(
        {
          name: 'cams_online.pdf',
          uri: 'file:///path/cams_online.pdf',
          size: 1024,
        },
        'PAN1234',
        onStatus,
      );

      expect(onStatus).toHaveBeenCalledWith({
        type: 'success',
        text: 'Statement uploaded and processed successfully!',
      });

      const status = await getUploadQueueStatus(db);
      expect(status.completedCount).toBe(1);
    });

    it('submitCasUpload enqueues to outbox with indicator when server is offline', async () => {
      await saveStoredCredentials('https://api.offline.org', 'token-offline', {
        id: 'u1',
        email: 'u1@example.com',
      });

      // Health check fails (offline)
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      const onStatus = vi.fn();
      await submitCasUpload(
        {
          name: 'cams_offline.pdf',
          uri: 'file:///path/cams_offline.pdf',
          size: 1024,
        },
        'PAN1234',
        onStatus,
      );

      expect(onStatus).toHaveBeenCalledWith({
        type: 'warning',
        text: 'Queued for upload when server reconnects',
      });

      // Item should be pending in outbox
      const status = await getUploadQueueStatus(db);
      expect(status.pendingCount).toBe(1);
    });

    it('runOutboxSync handles no server, offline, and successful online sync', async () => {
      const onStatus = vi.fn();

      // Case 1: No server
      await runOutboxSync(onStatus);
      expect(onStatus).toHaveBeenCalledWith({
        type: 'error',
        text: 'No server paired. Configure server in Settings.',
      });

      // Pair server
      await saveStoredCredentials('https://api.test.org', 'token-test', {
        id: 'u2',
        email: 'u2@example.com',
      });

      // Case 2: Offline
      mockFetch.mockRejectedValueOnce(new Error('Unreachable'));
      await runOutboxSync(onStatus);
      expect(onStatus).toHaveBeenCalledWith({
        type: 'warning',
        text: 'Queued for upload when server reconnects',
      });

      // Enqueue a pending item
      await enqueueCasUpload(
        { filePath: '/f.pdf', fileName: 'f.pdf' },
        db,
      );

      // Case 3: Online and success
      mockFetch.mockResolvedValueOnce({ status: 200 }); // health
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true }); // upload
      await runOutboxSync(onStatus);
      expect(onStatus).toHaveBeenCalledWith({
        type: 'success',
        text: 'Synced 1 statement(s) successfully!',
      });
    });
  });
});
