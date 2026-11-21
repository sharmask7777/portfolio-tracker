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
import type { UploadQueueStatus } from '../services/upload-queue';
import { saveFamilyProfiles, type FamilyProfile } from '../services/family-service';
import { saveGoals, type FinancialGoal } from '../services/goals-service';

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
        name: 'synthetic_cams_statement.pdf',
        uri: 'file:///data/synthetic_cams_statement.pdf',
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

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s, hairlineWidth: 1 },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
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

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockHoldings: EnrichedHolding[] = [
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

const mockSummary: DashboardSummary = {
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

let queueState: UploadQueueStatus = {
  pendingCount: 0,
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  history: [],
};

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(async () => mockSummary),
    getEnrichedHoldings: vi.fn(async () => mockHoldings),
    checkServerReachable: vi.fn(async () => false),
  };
});

vi.mock('../../src/services/upload-queue', () => ({
  enqueueCasUpload: vi.fn(async () => {
    queueState = {
      pendingCount: 1,
      completedCount: 0,
      failedCount: 0,
      totalCount: 1,
      history: [
        {
          id: 'q1',
          file_path: 'file:///cams.pdf',
          file_name: 'synthetic_cams_statement.pdf',
          status: 'PENDING',
          password_key: 'ABCDE1234F',
          created_at: '2026-11-18T10:00:00Z',
          updated_at: '2026-11-18T10:00:00Z',
          retry_count: 0,
        },
      ],
    };
    return 'q1';
  }),
  flushUploadQueue: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
  getUploadQueueStatus: vi.fn(async () => queueState),
  isServerReachable: vi.fn(async () => false),
}));

vi.mock('../services/family-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/family-service')>();
  return {
    ...actual,
    getStoredFolios: vi.fn(async () => []),
  };
});

import SplashScreen from '../../app/index';
import PairScreen from '../../app/(auth)/pair';
import LockScreen from '../../app/(auth)/lock';
import DashboardScreen from '../../app/(tabs)/index';
import HoldingsScreen from '../../app/(tabs)/holdings';
import TaxScreen from '../../app/(tabs)/tax';
import AnalyticsScreen from '../../app/(tabs)/analytics';
import InsightsScreen from '../../app/(tabs)/insights';
import UploadTabScreen from '../../app/(tabs)/upload';
import SettingsScreen from '../../app/(tabs)/settings';
import { SECURE_STORE_KEYS } from '../services/auth-service';

describe('Hermetic Mobile E2E Integration Runner', () => {
  const initialProfiles: FamilyProfile[] = [
    {
      id: 'prof-e2e-1',
      name: 'Aarav Sharma',
      pan: 'ABCDE1234F',
      relationship: 'Self',
      isPrimary: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const initialGoals: FinancialGoal[] = [
    {
      id: 'goal-e2e-1',
      name: 'Retirement 2045',
      category: 'Retirement',
      priority: 'High',
      targetAmount: 10000000,
      targetDate: '2045-12-31',
      allocatedPercentage: 50,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockStorage.clear();
    mockFetch.mockReset();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();

    queueState = {
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0,
      totalCount: 0,
      history: [],
    };

    await saveFamilyProfiles(initialProfiles);
    await saveGoals(initialGoals);
  });

  it('runs the complete cross-platform user journey hermetically across all 8 core domains', async () => {
    // Stage 1: Splash screen routes to Pair screen when no credentials exist
    render(() => <SplashScreen />);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/pair');
    });

    // Stage 2: Pair screen manual pairing
    resetHookState();
    render(() => <PairScreen />);
    expect(screen.getByText('Pair with Server')).toBeDefined();
    expect(screen.getByText('Scan Web QR Code')).toBeDefined();
    expect(screen.getByText('Enter Pairing Code Manually')).toBeDefined();

    fireEvent.press(screen.getByText('Enter Pairing Code Manually'));
    fireEvent.changeText(screen.getByTestId('server-url-input'), 'http://localhost:8080');
    fireEvent.changeText(screen.getByTestId('pairing-secret-input'), 'pair_synthetic_test_secret');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'token_hermetic_e2e_123',
        user: { id: 'usr_hermetic', email: 'aarav@synthetic.dev' },
      }),
    });

    fireEvent.press(screen.getByText('Connect & Pair'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      expect(mockStorage.get(SECURE_STORE_KEYS.DEVICE_TOKEN)).toBe('token_hermetic_e2e_123');
    });

    // Stage 3: Biometric LockScreen protects returning app session
    resetHookState();
    render(() => <LockScreen />);
    expect(screen.getByText('Portfolio Tracker')).toBeDefined();
    expect(screen.getByText('Unlock Portfolio')).toBeDefined();

    fireEvent.press(screen.getByText('Unlock Portfolio'));
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });

    // Stage 4: Dashboard view rendering, Reality Check toggle, and Historical Trend chart
    resetHookState();
    render(() => <DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByTestId('net-worth-card')).toBeDefined();
      expect(screen.getByText('Total Net Worth')).toBeDefined();
      expect(screen.getByTestId('asset-allocation-card')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
      expect(screen.getByTestId('reality-check-mode-toggle-card')).toBeDefined();
      expect(screen.getByTestId('historical-trend-chart')).toBeDefined();
    });

    // Toggle Reality Check mode ON
    fireEvent.press(screen.getByTestId('reality-check-toggle-reality'));
    await waitFor(() => {
      expect(screen.getByTestId('reality-check-banner')).toBeDefined();
      expect(screen.getByText('Reality Check Teardown')).toBeDefined();
    });

    // Stage 5: Holdings exploration and scheme search filter
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

    fireEvent.changeText(screen.getByTestId('holdings-search-input'), 'HDFC');
    await waitFor(() => {
      expect(screen.getByTestId('holding-card-h1')).toBeDefined();
      expect(screen.queryByTestId('holding-card-h2')).toBeNull();
    });

    // Stage 6: Tax & Statutory Compliance (Section 112A exemption, Table F matrix, Sell simulation)
    resetHookState();
    render(() => <TaxScreen />);
    await waitFor(() => {
      expect(screen.getByText('Tax & ITR')).toBeDefined();
      expect(screen.getByTestId('tax-summary-card')).toBeDefined();
      expect(screen.getByText('Sec 112A ₹1.25L Exemption')).toBeDefined();
      expect(screen.getByTestId('advance-tax-matrix-card')).toBeDefined();
      expect(screen.getByTestId('harvest-opportunities-list')).toBeDefined();
    });

    fireEvent.press(screen.getByTestId('open-sell-simulation-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('simulation-modal')).toBeDefined();
      expect(screen.getByText('Simulate Redemption')).toBeDefined();
    });
    fireEvent.press(screen.getByTestId('close-simulation-modal-btn'));

    // Stage 7: Analytics & Stock X-Ray (Asset allocation, Treemap, Stock Overlap)
    resetHookState();
    render(() => <AnalyticsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio X-Ray')).toBeDefined();
      expect(screen.getByText('Asset Allocation')).toBeDefined();
      expect(screen.getByTestId('svg-treemap')).toBeDefined();
      expect(screen.getByTestId('stock-overlap-table')).toBeDefined();
    });

    // Stage 8: Family Profiles & Multi-PAN Management
    resetHookState();
    render(() => <DashboardScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('scope-selector-header')).toBeDefined();
      expect(screen.getByText('Consolidated')).toBeDefined();
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
    });

    // Stage 9: Goals & Smart Financial Insights
    resetHookState();
    render(() => <InsightsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Goals & Insights')).toBeDefined();
      expect(screen.getByText('Total Goals Target')).toBeDefined();
      expect(screen.getByText('Smart Portfolio Insights')).toBeDefined();
      expect(screen.getByText('Retirement 2045')).toBeDefined();
    });

    // Stage 10: CAS Upload form and Outbox queuing
    resetHookState();
    render(() => <UploadTabScreen />);
    expect(screen.getByText('Upload CAS Statement')).toBeDefined();
    expect(screen.getByText('Choose CAS PDF File')).toBeDefined();

    fireEvent.press(screen.getByText('Choose CAS PDF File'));
    await waitFor(() => {
      expect(screen.getByText('synthetic_cams_statement.pdf')).toBeDefined();
    });

    fireEvent.changeText(screen.getByTestId('password-input'), 'ABCDE1234F');
    fireEvent.press(screen.getByText('Upload Statement'));

    await waitFor(() => {
      expect(screen.getByText('Queued for upload when server reconnects')).toBeDefined();
      expect(screen.getByText('Upload Outbox')).toBeDefined();
      expect(screen.getByText('Pending')).toBeDefined();
      expect(screen.getByText('Sync Now')).toBeDefined();
    });

    // Stage 11: Settings screen server configuration, family profiles, and status
    resetHookState();
    render(() => <SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('settings-connection-card')).toBeDefined();
      expect(screen.getByText('Server Connection')).toBeDefined();
      expect(screen.getByTestId('settings-family-profiles-card')).toBeDefined();
      expect(screen.getByText('Offline / Standalone')).toBeDefined();
      expect(screen.getByText('http://localhost:8080')).toBeDefined();
      expect(screen.getByText('Disconnect / Unpair Device')).toBeDefined();
    });
  });
});
