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
import type { EnrichedHolding, DashboardSummary } from '../services/portfolio-service';

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

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn().mockResolvedValue(true),
  isEnrolledAsync: vi.fn().mockResolvedValue(true),
  authenticateAsync: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
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
  Search: (props: Record<string, unknown>) => ({ type: 'Search', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  User: (props: Record<string, unknown>) => ({ type: 'User', props }),
  ChevronDown: (props: Record<string, unknown>) => ({ type: 'ChevronDown', props }),
  ChevronUp: (props: Record<string, unknown>) => ({ type: 'ChevronUp', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  SlidersHorizontal: (props: Record<string, unknown>) => ({ type: 'SlidersHorizontal', props }),
  ArrowUpDown: (props: Record<string, unknown>) => ({ type: 'ArrowUpDown', props }),
  History: (props: Record<string, unknown>) => ({ type: 'History', props }),
  Archive: (props: Record<string, unknown>) => ({ type: 'Archive', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
}));

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

const mockEnrichedHoldings: EnrichedHolding[] = [
  {
    id: 'h1',
    folio_number: '12345/A',
    amfi_code: '120503',
    scheme_name: 'HDFC Top 100 Fund - Growth',
    isin: 'INF179K01BE2',
    units: 100,
    invested_cost: 50000,
    current_nav: 600,
    current_value: 60000,
    asset_class: 'EQUITY',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 2000,
    dayChangePct: 3.45,
    gainLoss: 10000,
    gainLossPct: 20,
  },
  {
    id: 'h2',
    folio_number: '67890/B',
    amfi_code: '119551',
    scheme_name: 'SBI Liquid Fund - Direct Growth',
    isin: 'INF200K01VA8',
    units: 20,
    invested_cost: 60000,
    current_nav: 3300,
    current_value: 66000,
    asset_class: 'DEBT',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 100,
    dayChangePct: 0.15,
    gainLoss: 6000,
    gainLossPct: 10,
  },
];

const mockDashboardSummary: DashboardSummary = {
  totalCurrentValue: 126000,
  totalInvestedCost: 110000,
  unrealizedGain: 16000,
  unrealizedGainPct: 14.55,
  dayGain: 2100,
  dayGainPct: 1.7,
  assetAllocation: [
    { name: 'Equity', amount: 60000, percentage: 47.6, color: '#3b82f6' },
    { name: 'Debt', amount: 66000, percentage: 52.4, color: '#10b981' },
  ],
  holdingsCount: 2,
  lastUpdated: '2026-11-17',
  isOfflineFallback: true,
};

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(async () => mockDashboardSummary),
    getEnrichedHoldings: vi.fn(async () => mockEnrichedHoldings),
    checkServerReachable: vi.fn(async () => false),
  };
});

import LockScreen from '../../app/(auth)/lock';
import DashboardScreen from '../../app/(tabs)/index';
import HoldingsScreen from '../../app/(tabs)/holdings';
import SettingsScreen from '../../app/(tabs)/settings';
import { SECURE_STORE_KEYS } from '../services/auth-service';

describe('Maestro Flow 02: Offline Navigation Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();

    // Set up cached credentials
    mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'http://localhost:8080');
    mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'synthetic_cached_token');
    mockStorage.set(
      SECURE_STORE_KEYS.USER_INFO,
      JSON.stringify({ id: 'usr_syn', email: 'aarav@synthetic.dev' }),
    );
  });

  it('executes offline navigation from biometric unlock to holdings filter and settings', async () => {
    // 1. Launch app with cached credentials -> renders Biometric LockScreen
    render(() => <LockScreen />);

    // Assert prompt for Biometric Unlock
    expect(screen.getByText('Portfolio Tracker')).toBeDefined();
    expect(screen.getByText('Unlock Portfolio')).toBeDefined();

    // 2. Tap "Unlock Portfolio"
    const unlockBtn = screen.getByText('Unlock Portfolio');
    fireEvent.press(unlockBtn);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });

    // 3. Verify Dashboard renders Net Worth, Asset Allocation, and Day Gain
    resetHookState();
    render(() => <DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByTestId('net-worth-card')).toBeDefined();
      expect(screen.getByText('Total Net Worth')).toBeDefined();
      expect(screen.getByTestId('asset-allocation-card')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
      expect(screen.getByTestId('day-return-banner')).toBeDefined();
      expect(screen.getByText("Day's Change")).toBeDefined();
    });

    // 4. Switch to "Holdings" tab, verify active holdings list renders without crash
    resetHookState();
    render(() => <HoldingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Holdings')).toBeDefined();
      expect(screen.getByTestId('holdings-search-input')).toBeDefined();
      expect(screen.getByTestId('holding-card-h1')).toBeDefined();
      expect(screen.getByTestId('holding-card-h2')).toBeDefined();
      expect(screen.getByTestId('scheme-group-card-h1')).toBeDefined();
      expect(screen.getByTestId('scheme-group-card-h2')).toBeDefined();
    });

    // 5. Type into search input to filter holdings
    const searchInput = screen.getByTestId('holdings-search-input');
    fireEvent.changeText(searchInput, 'HDFC');

    await waitFor(() => {
      expect(screen.getByTestId('holding-card-h1')).toBeDefined();
      expect(screen.queryByTestId('holding-card-h2')).toBeNull();
    });

    // 6. Switch to "Settings" tab, verify Server Connection and Standalone/Offline mode badges
    resetHookState();
    render(() => <SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-connection-card')).toBeDefined();
      expect(screen.getByText('Server Connection')).toBeDefined();
      expect(screen.getByText('Offline / Standalone')).toBeDefined();
      expect(screen.getByText('http://localhost:8080')).toBeDefined();
    });
  });
});
