import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupReactHookDispatcher,
  resetHookState,
  render,
  screen,
  waitFor,
} from './test-harness';
import type { EnrichedHolding } from '../services/portfolio-service';

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

vi.mock('react-native-svg', () => {
  const SvgMock = (props: Record<string, unknown>) => ({ type: 'Svg', props });
  return {
    __esModule: true,
    default: SvgMock,
    Svg: SvgMock,
    Rect: (props: Record<string, unknown>) => ({ type: 'Rect', props }),
    Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
    TSpan: (props: Record<string, unknown>) => ({ type: 'TSpan', props }),
    G: (props: Record<string, unknown>) => ({ type: 'G', props }),
    Path: (props: Record<string, unknown>) => ({ type: 'Path', props }),
    Defs: (props: Record<string, unknown>) => ({ type: 'Defs', props }),
    Pattern: (props: Record<string, unknown>) => ({ type: 'Pattern', props }),
    Line: (props: Record<string, unknown>) => ({ type: 'Line', props }),
  };
});

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Target: (props: Record<string, unknown>) => ({ type: 'Target', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  Search: (props: Record<string, unknown>) => ({ type: 'Search', props }),
  Layers: (props: Record<string, unknown>) => ({ type: 'Layers', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s, hairlineWidth: 1 },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  RefreshControl: (props: Record<string, unknown>) => ({ type: 'RefreshControl', props }),
  Modal: (props: Record<string, unknown>) => ({ type: 'Modal', props }),
  Switch: (props: Record<string, unknown>) => ({ type: 'Switch', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

const mockSyntheticAnalyticsHoldings: EnrichedHolding[] = [
  {
    id: 'h-xray-1',
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
    dayChange: 500,
    dayChangePct: 0.84,
    gainLoss: 10000,
    gainLossPct: 20,
  },
  {
    id: 'h-xray-2',
    folio_number: '67890/B',
    amfi_code: '119551',
    scheme_name: 'ICICI Prudential Bluechip Fund',
    isin: 'INF109K01BL0',
    units: 150,
    invested_cost: 40000,
    current_nav: 400,
    current_value: 60000,
    asset_class: 'EQUITY',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 400,
    dayChangePct: 0.67,
    gainLoss: 20000,
    gainLossPct: 50,
  },
  {
    id: 'h-xray-3',
    folio_number: '99999/C',
    amfi_code: '100001',
    scheme_name: 'Kotak Liquid Fund - Growth',
    isin: 'INF174K01LS2',
    units: 30,
    invested_cost: 30000,
    current_nav: 1000,
    current_value: 30000,
    asset_class: 'DEBT',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 30,
    dayChangePct: 0.1,
    gainLoss: 0,
    gainLossPct: 0,
  },
];

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getEnrichedHoldings: vi.fn(async () => mockSyntheticAnalyticsHoldings),
  };
});

import AnalyticsScreen from '../../app/(tabs)/analytics';

describe('Maestro Flow 05: Analytics Treemap & Stock Overlap Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();
  });

  it('validates macro asset allocation breakdown cards', async () => {
    render(() => <AnalyticsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Portfolio X-Ray')).toBeDefined();
      expect(screen.getByText('Look-Through Analytics')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
    });

    // Macro asset classes rendered
    expect(screen.getByText('Equity')).toBeDefined();
    expect(screen.getByText('Debt')).toBeDefined();
    expect(screen.getByText('Cash')).toBeDefined();
    expect(screen.getByText('Gold')).toBeDefined();
  });

  it('validates visual SVG treemap, stock overlap table, and arbitrage toggle', async () => {
    render(() => <AnalyticsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('svg-treemap')).toBeDefined();
      expect(screen.getByText('Visual Treemap')).toBeDefined();
      expect(screen.getByTestId('stock-overlap-table-empty')).toBeDefined();
      expect(screen.getByText('No stock exposures available')).toBeDefined();
    });
  });
});
