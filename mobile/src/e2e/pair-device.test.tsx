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

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
}));

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => ({ type: 'CameraView', props }),
  useCameraPermissions: () => [{ granted: false }, vi.fn()],
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn().mockResolvedValue(true),
  isEnrolledAsync: vi.fn().mockResolvedValue(true),
  authenticateAsync: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(async () => ({
      totalCurrentValue: 1250000,
      totalInvestedCost: 1000000,
      unrealizedGain: 250000,
      unrealizedGainPct: 25.0,
      dayGain: 15000,
      dayGainPct: 1.2,
      assetAllocation: [{ name: 'Equity', amount: 1250000, percentage: 100, color: '#3b82f6' }],
      holdingsCount: 5,
      lastUpdated: '2026-11-18',
      isOfflineFallback: false,
    })),
  };
});

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  RefreshControl: (props: Record<string, unknown>) => ({ type: 'RefreshControl', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import PairScreen from '../../app/(auth)/pair';
import DashboardScreen from '../../app/(tabs)/index';
import { SECURE_STORE_KEYS } from '../services/auth-service';

describe('Maestro Flow 01: Pair Device Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.mockReset();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();
  });

  it('executes full pair device flow from initial launch to dashboard', async () => {
    // 1. Launch app in initial unpaired state
    render(() => <PairScreen />);

    // Assert "Pair with Server" title is visible
    expect(screen.getByText('Pair with Server')).toBeDefined();

    // Assert "Scan Web QR Code" camera button and "Enter Pairing Code Manually" option are visible
    expect(screen.getByText('Scan Web QR Code')).toBeDefined();
    expect(screen.getByText('Enter Pairing Code Manually')).toBeDefined();

    // 2. Tap manual code entry
    const manualBtn = screen.getByText('Enter Pairing Code Manually');
    fireEvent.press(manualBtn);

    // Verify manual form rendered
    expect(screen.getByText('Server URL')).toBeDefined();
    expect(screen.getByText('Pairing Secret')).toBeDefined();
    expect(screen.getByText('Connect & Pair')).toBeDefined();

    // 3. Enter test server URL and synthetic pairing secret
    const urlInput = screen.getByTestId('server-url-input');
    fireEvent.changeText(urlInput, 'http://localhost:8080');

    const secretInput = screen.getByTestId('pairing-secret-input');
    fireEvent.changeText(secretInput, 'pair_synthetic_test_secret');

    // Mock API claim endpoint response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'synthetic_jwt_token_12345',
        user: {
          id: 'usr_synthetic_01',
          email: 'synthetic_investor@example.com',
        },
      }),
    });

    // 4. Tap "Connect & Pair"
    const connectBtn = screen.getByText('Connect & Pair');
    fireEvent.press(connectBtn);

    // Assert claimPairingSecret persisted credentials and navigated to tabs
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      expect(mockStorage.get(SECURE_STORE_KEYS.DEVICE_TOKEN)).toBe('synthetic_jwt_token_12345');
      expect(mockStorage.get(SECURE_STORE_KEYS.SERVER_URL)).toBe('http://localhost:8080');
    });

    // 5. Assert navigation to Dashboard with Net Worth Card visible
    resetHookState();
    render(() => <DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByTestId('net-worth-card')).toBeDefined();
      expect(screen.getByText('Total Net Worth')).toBeDefined();
    });
  });
});
