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
import type { DashboardSummary, EnrichedHolding } from '../services/portfolio-service';
import { saveFamilyProfiles } from '../services/family-service';
import { Platform } from 'react-native';

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
  getDocumentAsync: vi.fn(async () => ({
    canceled: false,
    assets: [
      {
        name: 'synthetic_cas_statement.pdf',
        uri: 'file:///data/synthetic_cas_statement.pdf',
        size: 1048576,
      },
    ],
  })),
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
  User: (props: Record<string, unknown>) => ({ type: 'User', props }),
  UserPlus: (props: Record<string, unknown>) => ({ type: 'UserPlus', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
  Edit3: (props: Record<string, unknown>) => ({ type: 'Edit3', props }),
  Calendar: (props: Record<string, unknown>) => ({ type: 'Calendar', props }),
  AlertTriangle: (props: Record<string, unknown>) => ({ type: 'AlertTriangle', props }),
  AlertCircle: (props: Record<string, unknown>) => ({ type: 'AlertCircle', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  CheckCircle2: (props: Record<string, unknown>) => ({ type: 'CheckCircle2', props }),
  Sparkles: (props: Record<string, unknown>) => ({ type: 'Sparkles', props }),
  Calculator: (props: Record<string, unknown>) => ({ type: 'Calculator', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
  TrendingUp: (props: Record<string, unknown>) => ({ type: 'TrendingUp', props }),
  Copy: (props: Record<string, unknown>) => ({ type: 'Copy', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  FileText: (props: Record<string, unknown>) => ({ type: 'FileText', props }),
  Search: (props: Record<string, unknown>) => ({ type: 'Search', props }),
  Layers: (props: Record<string, unknown>) => ({ type: 'Layers', props }),
  Zap: (props: Record<string, unknown>) => ({ type: 'Zap', props }),
  SlidersHorizontal: (props: Record<string, unknown>) => ({ type: 'SlidersHorizontal', props }),
  ShieldAlert: (props: Record<string, unknown>) => ({ type: 'ShieldAlert', props }),
  BarChart2: (props: Record<string, unknown>) => ({ type: 'BarChart2', props }),
}));

let mockQueueStatusState = {
  pendingCount: 0,
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  history: [] as Array<Record<string, unknown>>,
};

vi.mock('../../src/services/upload-queue', () => ({
  enqueueCasUpload: vi.fn(async () => {
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
          created_at: '2026-11-24T10:00:00Z',
          updated_at: '2026-11-24T10:00:00Z',
          retry_count: 0,
        },
      ],
    };
    return { id: 'q_synthetic_01', status: 'PENDING' };
  }),
  flushUploadQueue: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
  getUploadQueueStatus: vi.fn(async () => mockQueueStatusState),
  isServerReachable: vi.fn(async () => false),
}));

vi.mock('../services/family-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/family-service')>();
  return {
    ...actual,
    getStoredFolios: vi.fn(async () => [
      {
        id: 'f1',
        portfolio_id: 'port-1',
        asset_id: 'a1',
        folio_number: '10396016',
        amc: 'PPFAS',
        pan: 'ABCDE1234F',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'f2',
        portfolio_id: 'port-1',
        asset_id: 'a2',
        folio_number: '98765432',
        amc: 'HDFC',
        pan: 'ABCDE1234F',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]),
  };
});

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
  PanResponder: { create: (c: Record<string, unknown>) => ({ panHandlers: c }) },
  Switch: (props: Record<string, unknown>) => ({ type: 'Switch', props }),
  StatusBar: { currentHeight: 24 },
  Alert: { alert: vi.fn() },
  Platform: { OS: 'android', select: (s: Record<string, unknown>) => s['android'] ?? s['default'] },
}));

const mockSyntheticDashboardSummary: DashboardSummary = {
  totalCurrentValue: 14500000,
  totalInvestedCost: 10000000,
  unrealizedGain: 4500000,
  unrealizedGainPct: 45.0,
  dayGain: 14500,
  dayGainPct: 0.10,
  assetAllocation: [
    { name: 'Equity', amount: 9500000, percentage: 65.5, color: '#3b82f6' },
    { name: 'Debt', amount: 5000000, percentage: 34.5, color: '#10b981' },
  ],
  holdingsCount: 2,
  lastUpdated: '2026-11-24',
  isOfflineFallback: false,
  metrics: {
    totalInvested: 10000000,
    totalValue: 14500000,
    postTaxTotalValue: 13950000,
    netRealizableValue: 13950000,
    totalGain: 4500000,
    absoluteReturn: 0.45,
    xirr: 0.165,
    postTaxXirr: 0.142,
    realPostTaxXirr: 0.082,
    estimatedTax: 550000,
    dayChange: 14500,
    dayChangePercentage: 0.10,
    drags: {
      nominalXirr: 0.165,
      postTaxXirr: 0.142,
      debtDrag: 0.008,
      equityDrag: 0.012,
      cessAndOtherDrag: 0.003,
      inflationDrag: 0.060,
      totalTaxDrag: 0.023,
      totalOverallDrag: 0.083,
      realPostTaxXirr: 0.082,
      benchmarkSpread: 0.065,
      postTaxValue: 13950000,
      purchasingPowerValue: 11200000,
      purchasingPowerLoss: 3300000,
      stages: [
        { step: 1, key: 'gross_nominal', label: 'Gross Nominal', rate: 0.165, drag: 0.0, description: 'Pre-tax annualized IRR' },
        { step: 2, key: 'debt_drag', label: 'Sec 50AA Debt Drag', rate: 0.008, drag: -0.008, description: 'Slab rate debt fund taxation' },
        { step: 3, key: 'equity_drag', label: 'Sec 112A/111A Equity', rate: 0.012, drag: -0.012, description: '12.5% LTCG / 20% STCG' },
        { step: 4, key: 'cess_drag', label: 'Cess & Overheads', rate: 0.003, drag: -0.003, description: '4% health & edu cess' },
        { step: 5, key: 'inflation_drag', label: 'CPI Inflation Drag', rate: 0.060, drag: -0.060, description: 'Purchasing power deflator' },
        { step: 6, key: 'real_xirr', label: 'Real Purchasing XIRR', rate: 0.082, drag: 0.0, description: 'True real compounding' },
      ],
    },
  },
};

const mockSyntheticHoldings: EnrichedHolding[] = [
  {
    id: 'h1',
    folio_number: '10396016',
    amfi_code: null,
    isin: null,
    scheme_name: 'Parag Parikh Flexi Cap Fund',
    asset_class: 'EQUITY',
    units: 60000,
    current_nav: 158.33,
    current_value: 9500000,
    invested_cost: 6000000,
    nav_date: '2026-11-24',
    updated_at: '2026-11-24T10:00:00Z',
    day_change: 9500,
    day_change_pct: 0.10,
    dayChange: 9500,
    dayChangePct: 0.10,
    gainLoss: 3500000,
    gainLossPct: 58.33,
    xirr: 18.5,
  },
  {
    id: 'h2',
    folio_number: '98765432',
    amfi_code: null,
    isin: null,
    scheme_name: 'HDFC Corporate Bond Fund',
    asset_class: 'DEBT',
    units: 160000,
    current_nav: 31.25,
    current_value: 5000000,
    invested_cost: 4000000,
    nav_date: '2026-11-24',
    updated_at: '2026-11-24T10:00:00Z',
    day_change: 5000,
    day_change_pct: 0.10,
    dayChange: 5000,
    dayChangePct: 0.10,
    gainLoss: 1000000,
    gainLossPct: 25.0,
    xirr: 7.5,
  },
];

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(async () => mockSyntheticDashboardSummary),
    getEnrichedHoldings: vi.fn(async () => mockSyntheticHoldings),
    getHistoricalData: vi.fn(async () => [
      { date: '2026-11-20', totalValue: 14200000, postTaxTotalValue: 13700000 },
      { date: '2026-11-24', totalValue: 14500000, postTaxTotalValue: 13950000 },
    ]),
  };
});

// Import Screens dynamically after mocks
import DashboardScreen from '../../app/(tabs)/index';
import TaxScreen from '../../app/(tabs)/tax';
import AnalyticsScreen from '../../app/(tabs)/analytics';
import UploadTabScreen from '../../app/(tabs)/upload';

describe('Agent-Driven Comprehensive UAT Suite: Mobile (Android & iOS)', () => {
  beforeEach(async () => {
    setupReactHookDispatcher();
    resetHookState();
    mockStorage.clear();
    mockStorage.set('api_base_url', 'http://10.0.2.2:3001');
    mockStorage.set('auth_token', 'synthetic_device_pairing_token');
    mockStorage.set('pin_auth_enabled', 'false');

    await saveFamilyProfiles([
      {
        id: 'prof-primary',
        name: 'Aarav Sharma',
        pan: 'ABCDE1234F',
        relationship: 'Self',
        isPrimary: true,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      },
      {
        id: 'prof-spouse',
        name: 'Neha Patel',
        pan: 'ALPAC1001A',
        relationship: 'Spouse',
        isPrimary: false,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      },
    ]);
  });

  it('UAT-MOB-1: Android Platform Journey - Zero-Balance resilience, Scope switcher, and Reality Check banner', async () => {
    (Platform as { OS: string }).OS = 'android';

    render(() => <DashboardScreen />);

    // 1. Verify dashboard rendering and net worth cards
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByTestId('net-worth-card')).toBeDefined();
      expect(screen.getByText('Total Net Worth')).toBeDefined();
      expect(screen.getByTestId('reality-check-mode-toggle-card')).toBeDefined();
    });

    // 2. Verify Family Multi-PAN Scope Selector header
    await waitFor(() => {
      expect(screen.getByTestId('scope-selector-header')).toBeDefined();
      expect(screen.getByText('Consolidated')).toBeDefined();
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
    });

    // 3. Toggle Reality Check Mode
    fireEvent.press(screen.getByTestId('reality-check-toggle-reality'));
    await waitFor(() => {
      expect(screen.getByTestId('reality-check-banner')).toBeDefined();
      expect(screen.getByText('Reality Check Teardown')).toBeDefined();
      expect(screen.getByText('Drag Waterfall')).toBeDefined();
      expect(screen.getByText('Gross Nominal')).toBeDefined();
      expect(screen.getByText('Real Purchasing XIRR')).toBeDefined();
    });
  }, 60000);

  it('UAT-MOB-2: iOS Platform Journey - Tax harvesting, advance tax matrix, and CAS upload queuing', async () => {
    (Platform as { OS: string }).OS = 'ios';

    // 1. Tax & Statutory Compliance Screen
    render(() => <TaxScreen />);
    await waitFor(() => {
      expect(screen.getByText('Tax & ITR')).toBeDefined();
      expect(screen.getByTestId('tax-summary-card')).toBeDefined();
      expect(screen.getByText('Sec 112A ₹1.25L Exemption')).toBeDefined();
      expect(screen.getByTestId('advance-tax-matrix-card')).toBeDefined();
      expect(screen.getByTestId('harvest-opportunities-list')).toBeDefined();
    });

    // 2. Open Sell Simulation Modal
    fireEvent.press(screen.getByTestId('open-sell-simulation-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('simulation-modal')).toBeDefined();
      expect(screen.getByText('Simulate Redemption')).toBeDefined();
    });
    fireEvent.press(screen.getByTestId('close-simulation-modal-btn'));

    // 3. Analytics Look-Through Screen
    resetHookState();
    render(() => <AnalyticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio X-Ray')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
      expect(screen.getByTestId('svg-treemap')).toBeDefined();
      expect(screen.getByTestId('stock-overlap-table-empty')).toBeDefined();
    });

    // 4. CAS Upload Screen and Outbox Persistence
    resetHookState();
    render(() => <UploadTabScreen />);
    await waitFor(() => {
      expect(screen.getByText('Upload CAS Statement')).toBeDefined();
      expect(screen.getByText('Choose CAS PDF File')).toBeDefined();
    });

    fireEvent.press(screen.getByText('Choose CAS PDF File'));
    await waitFor(() => {
      expect(screen.getByText('synthetic_cas_statement.pdf')).toBeDefined();
    });

    fireEvent.changeText(screen.getByTestId('password-input'), 'ABCDE1234F');
    fireEvent.press(screen.getByText('Upload Statement'));

    await waitFor(() => {
      expect(screen.getByText('Queued for upload when server reconnects')).toBeDefined();
      expect(screen.getByText('Upload Outbox')).toBeDefined();
    });
  }, 60000);
});
