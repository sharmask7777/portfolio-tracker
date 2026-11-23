import React from 'react';

// Set up React hook dispatcher for testing functional components in Node
// @ts-expect-error React internals for test runner
React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
  useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, vi.fn()],
  useEffect: (fn: () => void) => fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => ({}),
};

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockLocalAuth, mockStorage } = vi.hoisted(() => ({
  mockLocalAuth: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    authenticateAsync: vi.fn(),
  },
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
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

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
  Tabs: Object.assign(
    (props: Record<string, unknown>) => ({ type: 'Tabs', props }),
    { Screen: (props: Record<string, unknown>) => ({ type: 'Tabs.Screen', props }) },
  ),
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

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Target: (props: Record<string, unknown>) => ({ type: 'Target', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
}));

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => ({ type: 'CameraView', props }),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

import { NetWorthCard } from '../src/components/NetWorthCard';
import { DayReturnBanner } from '../src/components/DayReturnBanner';
import { AssetAllocationCard } from '../src/components/AssetAllocationCard';
import { HoldingCard } from '../src/components/HoldingCard';
import { UploadFormCard } from '../src/components/UploadFormCard';
import { UploadQueueCard } from '../src/components/UploadQueueCard';
import {
  filterHoldings,
  groupHoldingsByAssetClass,
  type EnrichedHolding,
} from '../src/services/portfolio-service';
import DashboardScreen from '../app/(tabs)/index';
import HoldingsScreen from '../app/(tabs)/holdings';
import SettingsScreen from '../app/(tabs)/settings';
import UploadTabScreen from '../app/(tabs)/upload';
import TabsLayout from '../app/(tabs)/_layout';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('Tabs Screens & Components', () => {
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

  beforeEach(() => {
    mockStorage.clear();
    mockFetch.mockReset();
  });

  describe('Reusable Dashboard Components', () => {
    it('renders NetWorthCard with formatted values', () => {
      const element = NetWorthCard({
        totalCurrentValue: 126000,
        totalInvestedCost: 110000,
        unrealizedGain: 16000,
        unrealizedGainPct: 14.55,
      });

      expect(getProps(element)['testID']).toBe('net-worth-card');
      expect(getProps(element)['children']).toBeDefined();
    });

    it('renders NetWorthCard with XIRR toggle and overallXirr metric', () => {
      const onToggle = vi.fn();
      const element = NetWorthCard({
        totalCurrentValue: 126000,
        totalInvestedCost: 110000,
        unrealizedGain: 16000,
        unrealizedGainPct: 14.55,
        performanceMode: 'XIRR',
        overallXirr: 0.165,
        onTogglePerformanceMode: onToggle,
      });

      expect(getProps(element)['testID']).toBe('net-worth-card');
      const children = getProps(element)['children'] as Array<{ props?: Record<string, unknown> }>;
      const metricsRow = children[2]?.props?.children as Array<{ props?: Record<string, unknown> }>;
      const gainBlock = metricsRow[1]?.props?.children as Array<{ props?: Record<string, unknown> }>;
      expect(gainBlock[0]?.props?.children).toBe('Total Gain (XIRR)');
      expect(gainBlock[1]?.props?.children).toContain('+16.50%');
    });

    it('falls back to Total Gain (ABS) when overallXirr is undefined in XIRR mode', () => {
      const element = NetWorthCard({
        totalCurrentValue: 126000,
        totalInvestedCost: 110000,
        unrealizedGain: 16000,
        unrealizedGainPct: 14.55,
        performanceMode: 'XIRR',
        overallXirr: undefined,
      });

      const children = getProps(element)['children'] as Array<{ props?: Record<string, unknown> }>;
      const metricsRow = children[2]?.props?.children as Array<{ props?: Record<string, unknown> }>;
      const gainBlock = metricsRow[1]?.props?.children as Array<{ props?: Record<string, unknown> }>;
      expect(gainBlock[0]?.props?.children).toBe('Total Gain (ABS)');
      expect(gainBlock[1]?.props?.children).toContain('+14.55%');
    });

    it('renders DayReturnBanner with positive gain and offline badge', () => {
      const element = DayReturnBanner({
        dayGain: 2100,
        dayGainPct: 1.7,
        isOfflineFallback: true,
      });

      expect(getProps(element)['testID']).toBe('day-return-banner');
      expect(getProps(element)['children']).toBeDefined();
    });

    it('renders AssetAllocationCard with multiple asset classes', () => {
      const element = AssetAllocationCard({
        allocation: [
          { name: 'Equity', amount: 60000, percentage: 47.6, color: '#3b82f6' },
          { name: 'Debt', amount: 66000, percentage: 52.4, color: '#10b981' },
        ],
        totalValue: 126000,
      });

      expect(getProps(element)['testID']).toBe('asset-allocation-card');
    });

    it('renders HoldingCard with scheme name and metrics', () => {
      const element = HoldingCard({ holding: mockEnrichedHoldings[0]! });
      expect(getProps(element)['testID']).toBe('holding-card-h1');
    });
  });

  describe('Dashboard Screen with Cached SQLite Data', () => {
    it('renders DashboardScreen tree without errors', () => {
      const screen = DashboardScreen();
      expect(screen).toBeDefined();
    });
  });

  describe('Holdings Screen Search and Asset Class Filtering', () => {
    it('filters holdings by scheme name search query', () => {
      const result = filterHoldings(mockEnrichedHoldings, 'HDFC');
      expect(result).toHaveLength(1);
      expect(result[0]?.scheme_name).toContain('HDFC');
    });

    it('filters holdings by folio number search query', () => {
      const result = filterHoldings(mockEnrichedHoldings, '67890');
      expect(result).toHaveLength(1);
      expect(result[0]?.folio_number).toBe('67890/B');
    });

    it('filters holdings by asset class category', () => {
      const equityOnly = filterHoldings(mockEnrichedHoldings, undefined, 'Equity');
      expect(equityOnly).toHaveLength(1);
      expect(equityOnly[0]?.asset_class).toBe('EQUITY');

      const debtOnly = filterHoldings(mockEnrichedHoldings, undefined, 'Debt');
      expect(debtOnly).toHaveLength(1);
      expect(debtOnly[0]?.asset_class).toBe('DEBT');
    });

    it('groups holdings by asset class with subtotal aggregations', () => {
      const groups = groupHoldingsByAssetClass(mockEnrichedHoldings);
      expect(groups).toHaveLength(2);
      expect(groups[0]?.assetClass).toBe('Equity');
      expect(groups[0]?.totalValue).toBe(60000);
      expect(groups[1]?.assetClass).toBe('Debt');
      expect(groups[1]?.totalValue).toBe(66000);
    });

    it('renders HoldingsScreen tree without errors', () => {
      const screen = HoldingsScreen();
      expect(screen).toBeDefined();
    });
  });

  describe('Settings & Upload Screens', () => {
    it('renders SettingsScreen tree without errors', () => {
      const screen = SettingsScreen();
      expect(screen).toBeDefined();
    });

    it('renders UploadTabScreen tree without errors', () => {
      const screen = UploadTabScreen();
      expect(getProps(screen)['testID']).toBe('upload-screen');
    });

    it('renders UploadFormCard with picker, password field, and upload button', () => {
      const form = UploadFormCard({
        selectedFile: { name: 'cams_2026.pdf', uri: 'file:///cams_2026.pdf', size: 1048576 },
        password: 'PAN',
        isUploading: false,
        statusMsg: { type: 'warning', text: 'Queued for upload when server reconnects' },
        onPickDocument: vi.fn(),
        onChangePassword: vi.fn(),
        onUpload: vi.fn(),
      });
      expect(getProps(form)['testID']).toBe('upload-form-card');
    });

    it('renders UploadQueueCard with summary counts and sync button', () => {
      const card = UploadQueueCard({
        status: {
          pendingCount: 2,
          completedCount: 5,
          failedCount: 1,
          totalCount: 8,
          history: [
            {
              id: 'q1',
              file_path: '/cams.pdf',
              file_name: 'cams.pdf',
              status: 'PENDING',
              password_key: 'KEY1',
              created_at: '2026-04-01T10:00:00Z',
              updated_at: '2026-04-01T10:00:00Z',
              retry_count: 0,
            },
          ],
        },
        onSync: vi.fn(),
        isSyncing: false,
      });
      expect(getProps(card)['testID']).toBe('upload-queue-card');
    });
  });

  describe('TabsLayout 7 Core Navigation Tabs', () => {
    it('registers exactly 7 core tabs excluding retired family tab', () => {
      const layout = TabsLayout();
      expect(layout).toBeDefined();
      const props = getProps(layout);
      const children = props['children'] as Array<React.ReactElement<{ name: string; options: { title: string } }>>;
      expect(Array.isArray(children)).toBe(true);
      expect(children).toHaveLength(7);

      const tabNames = children.map((c) => c.props.name);
      expect(tabNames).toEqual([
        'index',
        'holdings',
        'analytics',
        'tax',
        'insights',
        'upload',
        'settings',
      ]);
      expect(tabNames).not.toContain('family');
    });
  });
});
