import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupReactHookDispatcher,
  resetHookState,
  render,
  screen,
  fireEvent,
  waitFor,
} from './test-harness';
import type { UploadQueueStatus } from '../services/upload-queue';

const { mockStorage, mockRouter } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockRouter: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Tabs: Object.assign(
    (props: Record<string, unknown>) => ({ type: 'Tabs', props }),
    { Screen: (props: Record<string, unknown>) => ({ type: 'Tabs.Screen', props }) },
  ),
}));

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

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(async () => ({
    canceled: false,
    assets: [
      {
        name: 'synthetic_cas_statement.pdf',
        uri: 'file:///data/synthetic_cas_statement.pdf',
        size: 204800,
      },
    ],
  })),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn().mockResolvedValue(true),
  isEnrolledAsync: vi.fn().mockResolvedValue(true),
  authenticateAsync: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => ({ type: 'CameraView', props }),
  useCameraPermissions: () => [{ granted: false }, vi.fn()],
}));

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  RefreshControl: (props: Record<string, unknown>) => ({ type: 'RefreshControl', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

let mockQueueStatusState: UploadQueueStatus = {
  pendingCount: 0,
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  history: [],
};

const setCompletedQueueState = (): void => {
  mockQueueStatusState = {
    pendingCount: 0,
    completedCount: 1,
    failedCount: 0,
    totalCount: 1,
    history: [
      {
        id: 'q_synthetic_01',
        file_path: 'file:///data/synthetic_cas_statement.pdf',
        file_name: 'synthetic_cas_statement.pdf',
        status: 'COMPLETED',
        password_key: 'ABCDE1234F',
        created_at: '2026-11-18T10:00:00Z',
        updated_at: '2026-11-18T10:05:00Z',
        retry_count: 0,
      },
    ],
  };
};

const setPendingQueueState = (): void => {
  mockQueueStatusState = {
    pendingCount: 1,
    completedCount: 0,
    failedCount: 0,
    totalCount: 1,
    history: [
      {
        id: 'q_synthetic_01',
        file_path: 'file:///data/synthetic_cas_statement.pdf',
        file_name: 'synthetic_cas_statement.pdf',
        status: 'PENDING',
        password_key: 'ABCDE1234F',
        created_at: '2026-11-18T10:00:00Z',
        updated_at: '2026-11-18T10:00:00Z',
        retry_count: 0,
      },
    ],
  };
};

const mockEnqueueCasUpload = vi.fn(async () => {
  setPendingQueueState();
  return 'q_synthetic_01';
});

const mockFlushUploadQueue = vi.fn(async () => {
  setCompletedQueueState();
  return { succeeded: 1, failed: 0 };
});

const mockIsServerReachable = vi.fn(async (_url?: string): Promise<boolean> => false);
const mockRefreshPortfolio = vi.fn(async () => ({ success: true, source: 'server' as const }));

vi.mock('../../src/services/portfolio-service', () => ({
  refreshPortfolio: vi.fn(async () => mockRefreshPortfolio()),
}));

vi.mock('../../src/services/upload-queue', () => ({
  enqueueCasUpload: vi.fn(async () => mockEnqueueCasUpload()),
  flushUploadQueue: vi.fn(async () => mockFlushUploadQueue()),
  getUploadQueueStatus: vi.fn(async () => mockQueueStatusState),
  isServerReachable: vi.fn(async (url?: string) => mockIsServerReachable(url)),
}));

import UploadTabScreen from '../../app/(tabs)/upload';
import { SECURE_STORE_KEYS } from '../services/auth-service';

describe('Maestro Flow 03: CAS Upload Queue Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();

    mockIsServerReachable.mockResolvedValue(false);
    mockEnqueueCasUpload.mockImplementation(async () => {
      setPendingQueueState();
      return 'q_synthetic_01';
    });
    mockFlushUploadQueue.mockImplementation(async () => {
      setCompletedQueueState();
      return { succeeded: 1, failed: 0 };
    });

    mockQueueStatusState = {
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0,
      totalCount: 0,
      history: [],
    };

    mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'http://localhost:8080');
    mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'synthetic_device_token');
  });

  it('queues a CAS statement offline and reflects in Outbox queue with sync button', async () => {
    // 1. Switch to Upload tab
    render(() => <UploadTabScreen />);

    // Assert "Upload CAS Statement" header and "Choose CAS PDF File" button
    expect(screen.getByText('Upload CAS Statement')).toBeDefined();
    expect(screen.getByText('Choose CAS PDF File')).toBeDefined();

    // 2. Select document
    const pickBtn = screen.getByText('Choose CAS PDF File');
    fireEvent.press(pickBtn);

    await waitFor(() => {
      expect(screen.getByText('synthetic_cas_statement.pdf')).toBeDefined();
    });

    // 3. Enter synthetic PDF password (ABCDE1234F)
    const pwdInput = screen.getByTestId('password-input');
    fireEvent.changeText(pwdInput, 'ABCDE1234F');

    // 4. Tap "Upload Statement"
    const uploadBtn = screen.getByText('Upload Statement');
    fireEvent.press(uploadBtn);

    // 5. Assert outbox status card shows queued statement
    await waitFor(() => {
      expect(mockEnqueueCasUpload).toHaveBeenCalled();
      expect(screen.getByText('Queued for upload when server reconnects')).toBeDefined();
      expect(screen.getByText('Upload Outbox')).toBeDefined();
      expect(screen.getByText('Pending')).toBeDefined();
      expect(screen.getByText('PENDING')).toBeDefined();
      expect(screen.getByText('Sync Now')).toBeDefined();
      expect(screen.getByTestId('sync-outbox-btn')).toBeDefined();
    });

    // 6. Tap "Sync Now" to process outbox
    const syncBtn = screen.getByTestId('sync-outbox-btn');
    fireEvent.press(syncBtn);

    await waitFor(() => {
      expect(screen.getByText('Queued for upload when server reconnects')).toBeDefined();
    });
  });

  it('successfully uploads and syncs CAS statement when server is reachable on local network', async () => {
    mockIsServerReachable.mockResolvedValue(true);

    // 1. Switch to Upload tab
    render(() => <UploadTabScreen />);

    // Assert "Upload CAS Statement" header and "Choose CAS PDF File" button
    expect(screen.getByText('Upload CAS Statement')).toBeDefined();
    expect(screen.getByText('Choose CAS PDF File')).toBeDefined();

    // 2. Select document
    const pickBtn = screen.getByText('Choose CAS PDF File');
    fireEvent.press(pickBtn);

    await waitFor(() => {
      expect(screen.getByText('synthetic_cas_statement.pdf')).toBeDefined();
    });

    // 3. Enter synthetic PDF password (ABCDE1234F)
    const pwdInput = screen.getByTestId('password-input');
    fireEvent.changeText(pwdInput, 'ABCDE1234F');

    // 4. Tap "Upload Statement"
    const uploadBtn = screen.getByText('Upload Statement');
    fireEvent.press(uploadBtn);

    // 5. Assert immediate upload succeeds with reachable server and queue marks COMPLETED
    await waitFor(() => {
      expect(mockEnqueueCasUpload).toHaveBeenCalled();
      expect(mockFlushUploadQueue).toHaveBeenCalled();
      expect(
        screen.getByText('Statement uploaded and processed successfully!'),
      ).toBeDefined();
      expect(screen.getByText('Upload Outbox')).toBeDefined();
      expect(screen.getByText('COMPLETED')).toBeDefined();
    });

    // 6. Simulate an offline queueing event, then verify manual "Sync Now" button triggers sync and succeeds
    mockIsServerReachable.mockResolvedValueOnce(false);
    const pickBtn2 = screen.getByText('Choose CAS PDF File');
    fireEvent.press(pickBtn2);

    await waitFor(() => {
      expect(screen.getByText('synthetic_cas_statement.pdf')).toBeDefined();
    });

    fireEvent.changeText(screen.getByTestId('password-input'), 'ABCDE1234F');
    fireEvent.press(screen.getByText('Upload Statement'));

    await waitFor(() => {
      expect(
        screen.getByText('Queued for upload when server reconnects'),
      ).toBeDefined();
      expect(screen.getByTestId('sync-outbox-btn')).toBeDefined();
    });

    mockIsServerReachable.mockResolvedValue(true);
    const syncBtn = screen.getByTestId('sync-outbox-btn');
    fireEvent.press(syncBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Synced 1 statement(s) successfully!'),
      ).toBeDefined();
      expect(screen.getByText('COMPLETED')).toBeDefined();
    });
  });

  it('successfully flushes pending outbox via manual sync when server is reachable', async () => {
    mockIsServerReachable.mockResolvedValue(true);

    mockQueueStatusState = {
      pendingCount: 1,
      completedCount: 0,
      failedCount: 0,
      totalCount: 1,
      history: [
        {
          id: 'q_synthetic_01',
          file_path: 'file:///data/synthetic_cas_statement.pdf',
          file_name: 'synthetic_cas_statement.pdf',
          status: 'PENDING',
          password_key: 'ABCDE1234F',
          created_at: '2026-11-18T10:00:00Z',
          updated_at: '2026-11-18T10:00:00Z',
          retry_count: 0,
        },
      ],
    };

    render(() => <UploadTabScreen />);

    await waitFor(() => {
      expect(screen.getByText('Upload Outbox')).toBeDefined();
      expect(screen.getByText('Pending')).toBeDefined();
      expect(screen.getByTestId('sync-outbox-btn')).toBeDefined();
    });

    const syncBtn = screen.getByTestId('sync-outbox-btn');
    fireEvent.press(syncBtn);

    await waitFor(() => {
      expect(mockFlushUploadQueue).toHaveBeenCalled();
      expect(mockRefreshPortfolio).toHaveBeenCalled();
      expect(
        screen.getByText('Synced 1 statement(s) successfully!'),
      ).toBeDefined();
      expect(screen.getByText('COMPLETED')).toBeDefined();
    });
  });

  it('surfaces error status when async 202 polling ends in FAILED job status', async () => {
    mockIsServerReachable.mockResolvedValue(true);
    mockFlushUploadQueue.mockResolvedValueOnce({
      succeeded: 0,
      failed: 1,
      errors: ['Incorrect CAS PDF password'],
    } as never);

    render(() => <UploadTabScreen />);
    fireEvent.press(screen.getByText('Choose CAS PDF File'));
    await waitFor(() => {
      expect(screen.getByText('synthetic_cas_statement.pdf')).toBeDefined();
    });

    fireEvent.changeText(screen.getByTestId('password-input'), 'ABCDE1234F');
    fireEvent.press(screen.getByText('Upload Statement'));

    await waitFor(() => {
      expect(screen.getByText('Incorrect CAS PDF password')).toBeDefined();
      expect(mockRefreshPortfolio).not.toHaveBeenCalled();
    });
  });
});
