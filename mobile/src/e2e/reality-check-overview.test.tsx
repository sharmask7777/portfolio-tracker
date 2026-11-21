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
import type { DashboardSummary } from '../services/portfolio-service';
import {
  calculateRealityCheckMetrics,
  DEFAULT_ASSUMPTIONS,
} from '../services/reality-check-service';

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
  };
});

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  Zap: (props: Record<string, unknown>) => ({ type: 'Zap', props }),
  SlidersHorizontal: (props: Record<string, unknown>) => ({ type: 'SlidersHorizontal', props }),
  TrendingUp: (props: Record<string, unknown>) => ({ type: 'TrendingUp', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
  ShieldAlert: (props: Record<string, unknown>) => ({ type: 'ShieldAlert', props }),
  Calendar: (props: Record<string, unknown>) => ({ type: 'Calendar', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  BarChart2: (props: Record<string, unknown>) => ({ type: 'BarChart2', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
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
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

const mockSyntheticDashboardSummary: DashboardSummary = {
  totalCurrentValue: 1200000,
  totalInvestedCost: 1000000,
  unrealizedGain: 200000,
  unrealizedGainPct: 20,
  dayGain: 15000,
  dayGainPct: 1.25,
  assetAllocation: [
    { name: 'Equity', amount: 900000, percentage: 75, color: '#3b82f6' },
    { name: 'Debt', amount: 300000, percentage: 25, color: '#10b981' },
  ],
  holdingsCount: 5,
  lastUpdated: '2026-11-20',
  isOfflineFallback: false,
};

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(async () => mockSyntheticDashboardSummary),
  };
});

import DashboardScreen from '../../app/(tabs)/index';

describe('Maestro Flow 07: Reality Check & Historical Valuation Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();
  });

  it('validates Reality Check toggle, drag waterfall calculation, and assumptions modal', async () => {
    render(() => <DashboardScreen />);

    // 1. Initial dashboard rendering with net worth and reality check mode toggle
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.getByTestId('net-worth-card')).toBeDefined();
      expect(screen.getByTestId('reality-check-mode-toggle-card')).toBeDefined();
      expect(screen.queryByTestId('reality-check-banner')).toBeNull();
    });

    // 2. Toggle Reality Check mode ON
    const realityToggleBtn = screen.getByTestId('reality-check-toggle-reality');
    fireEvent.press(realityToggleBtn);

    // 3. Reality Check Banner appears with Fisher equation waterfall drag
    await waitFor(() => {
      expect(screen.getByTestId('reality-check-banner')).toBeDefined();
      expect(screen.getByText('Reality Check Teardown')).toBeDefined();
      expect(screen.getByText('Drag Waterfall')).toBeDefined();
    });

    // 4. Open Assumptions customization modal
    const assumptionsBtn = screen.getByTestId('reality-check-assumptions-button');
    fireEvent.press(assumptionsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('assumptions-modal')).toBeDefined();
      expect(screen.getByText('Reality Check Assumptions')).toBeDefined();
      expect(screen.getByTestId('assumptions-apply-button')).toBeDefined();
    });

    // 5. Apply assumptions
    const applyBtn = screen.getByTestId('assumptions-apply-button');
    fireEvent.press(applyBtn);

    // 6. Modal closes and banner remains active
    await waitFor(() => {
      expect(screen.getByTestId('assumptions-modal').props['visible']).toBe(false);
      expect(screen.getByTestId('reality-check-banner')).toBeDefined();
    });
  });

  it('validates SVG historical valuation chart checkpoints and range switching', async () => {
    render(() => <DashboardScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('historical-trend-chart')).toBeDefined();
      expect(screen.getByText('Valuation Trend & Checkpoints')).toBeDefined();
      expect(screen.getByTestId('ath-badge')).toBeDefined();
    });

    // Test range switcher buttons
    const range1Y = screen.getByTestId('range-button-1Y');
    fireEvent.press(range1Y);

    const range6M = screen.getByTestId('range-button-6M');
    fireEvent.press(range6M);

    const rangeAll = screen.getByTestId('range-button-ALL');
    fireEvent.press(rangeAll);
  });

  it('validates mathematical Fisher equation invariant: Real <= Post-Tax <= Nominal', () => {
    const result = calculateRealityCheckMetrics({
      currentValue: 1200000,
      investedCost: 1000000,
      nominalReturn: 0.20,
      assumptions: DEFAULT_ASSUMPTIONS,
    });

    expect(result.invariantHolds).toBe(true);
    expect(result.realPostTaxReturn).toBeLessThanOrEqual(result.postTaxReturn);
    expect(result.postTaxReturn).toBeLessThanOrEqual(result.nominalReturn);
    expect(result.inflationDrag).toBeGreaterThan(0);
    expect(result.taxDrag).toBeGreaterThan(0);
  });
});
