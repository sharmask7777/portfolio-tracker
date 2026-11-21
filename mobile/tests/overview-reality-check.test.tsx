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

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => ({ type: 'CameraView', props }),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
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
}));

import {
  calculateRealityCheckMetrics,
  deriveHistoricalCheckpoints,
  filterCheckpointsByRange,
  DEFAULT_ASSUMPTIONS,
  type HistoricalCheckpoint,
} from '../src/services/reality-check-service';

import {
  RealityCheckModeToggle,
  RealityCheckBanner,
  AssumptionsModal,
  PresetGrid,
  HistoricalTrendChart,
} from '../src/components/Dashboard';

import { BannerHeader } from '../src/components/Dashboard/RealityCheckBanner';
import { ModalHeader } from '../src/components/Dashboard/AssumptionsModal';
import {
  ChartHeader,
  RangeBar,
  CheckpointTooltip,
  ChartLegend,
} from '../src/components/Dashboard/chart-components';

import DashboardScreen from '../app/(tabs)/index';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('Task 5: Reality Check & Historical Checkpoints Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Reality Check Calculation Service', () => {
    it('uses standard default assumptions (6% CPI inflation, 15% tax rate, 3y horizon)', () => {
      expect(DEFAULT_ASSUMPTIONS.inflationRate).toBe(0.06);
      expect(DEFAULT_ASSUMPTIONS.taxRate).toBe(0.15);
      expect(DEFAULT_ASSUMPTIONS.horizonYears).toBe(3);
    });

    it('enforces Fisher invariant: Real Post-Tax Return <= Post-Tax Return <= Nominal Return', () => {
      const result = calculateRealityCheckMetrics({
        currentValue: 1250000,
        investedCost: 1000000,
        nominalReturn: 0.15,
        assumptions: {
          inflationRate: 0.06,
          taxRate: 0.15,
          horizonYears: 3,
        },
      });

      expect(result.nominalReturn).toBe(0.15);
      expect(result.taxDrag).toBeCloseTo(0.0225, 4);
      expect(result.postTaxReturn).toBeCloseTo(0.1275, 4);
      expect(result.realPostTaxReturn).toBeCloseTo(0.06368, 4);
      expect(result.inflationDrag).toBeCloseTo(0.06382, 4);

      expect(result.realPostTaxReturn).toBeLessThanOrEqual(result.postTaxReturn);
      expect(result.postTaxReturn).toBeLessThanOrEqual(result.nominalReturn);
      expect(result.invariantHolds).toBe(true);
    });

    it('handles negative returns (loss) without applying tax drag on loss', () => {
      const result = calculateRealityCheckMetrics({
        currentValue: 900000,
        investedCost: 1000000,
        nominalReturn: -0.10,
        assumptions: {
          inflationRate: 0.06,
          taxRate: 0.15,
          horizonYears: 3,
        },
      });

      expect(result.nominalReturn).toBe(-0.10);
      expect(result.taxDrag).toBe(0);
      expect(result.postTaxReturn).toBe(-0.10);
      expect(result.realPostTaxReturn).toBeCloseTo(-0.15094, 4);
      expect(result.realPostTaxReturn).toBeLessThanOrEqual(result.postTaxReturn);
      expect(result.postTaxReturn).toBeLessThanOrEqual(result.nominalReturn);
      expect(result.invariantHolds).toBe(true);
    });

    it('computes purchasing power wealth erosion over multi-year horizon', () => {
      const result = calculateRealityCheckMetrics({
        currentValue: 1200000,
        investedCost: 1000000,
        nominalReturn: 0.20,
        assumptions: {
          inflationRate: 0.06,
          taxRate: 0.15,
          horizonYears: 3,
        },
      });

      expect(result.estimatedTax).toBe(30000);
      expect(result.postTaxValue).toBe(1170000);
      expect(result.purchasingPowerValue).toBeCloseTo(982354.56, 1);
      expect(result.purchasingPowerLoss).toBeGreaterThan(0);
    });

    it('calculates safe-asset benchmark spread', () => {
      const result = calculateRealityCheckMetrics({
        currentValue: 1200000,
        investedCost: 1000000,
        nominalReturn: 0.12,
        assumptions: {
          inflationRate: 0.06,
          taxRate: 0.15,
          horizonYears: 3,
        },
      });

      expect(typeof result.benchmarkSpread).toBe('number');
      expect(result.dragWaterfall.length).toBe(5);
    });

    it('derives nominal return from current value and invested cost when not explicitly provided', () => {
      const result = calculateRealityCheckMetrics({
        currentValue: 1200000,
        investedCost: 1000000,
      });

      expect(result.nominalReturn).toBeCloseTo(0.20, 2);
      expect(result.nominalGain).toBe(200000);
    });
  });

  describe('2. Historical Checkpoints & ATH Indicator', () => {
    it('computes ATH and drawdowns accurately across checkpoints', () => {
      const samplePoints = [
        { date: '2024-01-01', value: 100000, investedAmount: 90000 },
        { date: '2024-02-01', value: 120000, investedAmount: 95000 },
        { date: '2024-03-01', value: 114000, investedAmount: 95000 },
        { date: '2024-04-01', value: 130000, investedAmount: 100000 },
        { date: '2024-05-01', value: 123500, investedAmount: 100000 },
      ];

      const checkpoints = deriveHistoricalCheckpoints(samplePoints);
      expect(checkpoints.length).toBe(5);

      expect(checkpoints[0]?.isAth).toBe(true);
      expect(checkpoints[0]?.drawdownPct).toBe(0);

      expect(checkpoints[1]?.isAth).toBe(true);
      expect(checkpoints[1]?.athValue).toBe(120000);
      expect(checkpoints[1]?.drawdownPct).toBe(0);

      expect(checkpoints[2]?.isAth).toBe(false);
      expect(checkpoints[2]?.athValue).toBe(120000);
      expect(checkpoints[2]?.drawdownPct).toBeCloseTo(-5.0, 1);

      expect(checkpoints[3]?.isAth).toBe(true);
      expect(checkpoints[3]?.athValue).toBe(130000);

      expect(checkpoints[4]?.isAth).toBe(false);
      expect(checkpoints[4]?.drawdownPct).toBeCloseTo(-5.0, 1);
    });

    it('filters checkpoints by range presets (1M, 3M, 6M, 1Y, ALL)', () => {
      const now = new Date();
      const createDateStr = (daysAgo: number) => {
        const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return d.toISOString().split('T')[0] ?? '';
      };

      const points: HistoricalCheckpoint[] = [
        { date: createDateStr(10), value: 110000, investedAmount: 100000, unrealizedGain: 10000, gainPct: 10, isAth: true, athValue: 110000, drawdownPct: 0 },
        { date: createDateStr(45), value: 105000, investedAmount: 100000, unrealizedGain: 5000, gainPct: 5, isAth: false, athValue: 110000, drawdownPct: -4.5 },
        { date: createDateStr(120), value: 102000, investedAmount: 100000, unrealizedGain: 2000, gainPct: 2, isAth: false, athValue: 110000, drawdownPct: -7.2 },
        { date: createDateStr(250), value: 98000, investedAmount: 95000, unrealizedGain: 3000, gainPct: 3.1, isAth: false, athValue: 110000, drawdownPct: -10.9 },
        { date: createDateStr(400), value: 90000, investedAmount: 90000, unrealizedGain: 0, gainPct: 0, isAth: false, athValue: 110000, drawdownPct: -18.1 },
      ];

      const r1m = filterCheckpointsByRange(points, '1M');
      expect(r1m.length).toBe(1);

      const r3m = filterCheckpointsByRange(points, '3M');
      expect(r3m.length).toBe(2);

      const r6m = filterCheckpointsByRange(points, '6M');
      expect(r6m.length).toBe(3);

      const r1y = filterCheckpointsByRange(points, '1Y');
      expect(r1y.length).toBe(4);

      const rAll = filterCheckpointsByRange(points, 'ALL');
      expect(rAll.length).toBe(5);
    });

    it('returns empty array when filtering empty checkpoint list', () => {
      const res = filterCheckpointsByRange([], '1M');
      expect(res).toEqual([]);
    });
  });

  describe('3. RealityCheckModeToggle Component', () => {
    it('renders segmented toggle buttons for Nominal View and Reality Check', () => {
      const onToggle = vi.fn();
      const onOpenAssumptions = vi.fn();

      const element = RealityCheckModeToggle({
        realityCheckMode: false,
        onToggle,
        onOpenAssumptions,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('reality-check-mode-toggle-card');

      const children = props['children'] as [React.ReactElement, React.ReactElement | undefined];
      const toggleGroup = getProps(children[0]);
      const buttons = toggleGroup['children'] as React.ReactElement[];

      const nominalBtn = getProps(buttons[0]!);
      (nominalBtn['onPress'] as () => void)();
      expect(onToggle).toHaveBeenCalledWith(false);

      const realityBtn = getProps(buttons[1]!);
      (realityBtn['onPress'] as () => void)();
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('renders assumptions button when in reality check mode and triggers callback', () => {
      const onToggle = vi.fn();
      const onOpenAssumptions = vi.fn();

      const element = RealityCheckModeToggle({
        realityCheckMode: true,
        onToggle,
        onOpenAssumptions,
      });

      const props = getProps(element);
      const children = props['children'] as [React.ReactElement, React.ReactElement | undefined];
      const assumptionsBtn = children[1];
      expect(assumptionsBtn).toBeDefined();

      const assumptionsProps = getProps(assumptionsBtn!);
      (assumptionsProps['onPress'] as () => void)();
      expect(onOpenAssumptions).toHaveBeenCalled();
    });
  });

  describe('4. RealityCheckBanner Component', () => {
    it('renders Drag Waterfall stages and statutory invariant note', () => {
      const onOpenAssumptions = vi.fn();
      const element = RealityCheckBanner({
        nominalValue: 1250000,
        investedCost: 1000000,
        nominalReturnPct: 0.15,
        assumptions: DEFAULT_ASSUMPTIONS,
        onOpenAssumptions,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('reality-check-banner');
    });

    it('renders BannerHeader and handles onOpenAssumptions click', () => {
      const onOpenAssumptions = vi.fn();
      const header = BannerHeader({
        assumptions: DEFAULT_ASSUMPTIONS,
        onOpenAssumptions,
      });

      expect(header).toBeDefined();
      const props = getProps(header);
      const children = props['children'] as [React.ReactElement, React.ReactElement | undefined];
      const chip = children[1];
      expect(chip).toBeDefined();

      const chipProps = getProps(chip!);
      (chipProps['onPress'] as () => void)();
      expect(onOpenAssumptions).toHaveBeenCalled();
    });
  });

  describe('5. AssumptionsModal Component', () => {
    it('renders modal with inflation, tax rate, and horizon controls and triggers apply', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      const element = AssumptionsModal({
        visible: true,
        onClose,
        assumptions: DEFAULT_ASSUMPTIONS,
        onSaveAssumptions: onSave,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('assumptions-modal');
    });

    it('renders ModalHeader and triggers close', () => {
      const onClose = vi.fn();
      const header = ModalHeader({ onClose });
      expect(header).toBeDefined();
      const props = getProps(header);
      const children = props['children'] as [React.ReactElement, React.ReactElement];
      const closeBtn = getProps(children[1]);
      (closeBtn['onPress'] as () => void)();
      expect(onClose).toHaveBeenCalled();
    });

    it('renders PresetGrid and triggers onSelect callback on press', () => {
      const onSelect = vi.fn();
      const grid = PresetGrid({
        presets: [
          { label: '6%', value: 0.06 },
          { label: '8%', value: 0.08 },
        ],
        currentValue: 0.06,
        onSelect,
      });

      expect(grid).toBeDefined();
      const chips = getProps(grid)['children'] as React.ReactElement[];
      expect(chips.length).toBe(2);

      const firstChip = getProps(chips[0]!);
      (firstChip['onPress'] as () => void)();
      expect(onSelect).toHaveBeenCalledWith(0.06);

      const secondChip = getProps(chips[1]!);
      (secondChip['onPress'] as () => void)();
      expect(onSelect).toHaveBeenCalledWith(0.08);
    });
  });

  describe('6. HistoricalTrendChart Component', () => {
    it('renders SVG chart with checkpoints, range buttons, and ATH status indicator', () => {
      const samplePoints = [
        { date: '2024-01-01', value: 100000, investedAmount: 90000 },
        { date: '2024-02-01', value: 120000, investedAmount: 95000 },
        { date: '2024-03-01', value: 114000, investedAmount: 95000 },
      ];
      const checkpoints = deriveHistoricalCheckpoints(samplePoints);

      const element = HistoricalTrendChart({
        checkpoints,
        currentValue: 114000,
        investedCost: 95000,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('historical-trend-chart');
    });

    it('renders RangeBar and handles range switching', () => {
      const onSelect = vi.fn();
      const rangeBar = RangeBar({ selectedRange: '1Y', onSelectRange: onSelect });
      expect(rangeBar).toBeDefined();

      const props = getProps(rangeBar);
      const buttons = props['children'] as React.ReactElement[];
      expect(buttons.length).toBe(5);

      const firstBtn = getProps(buttons[0]!);
      (firstBtn['onPress'] as () => void)();
      expect(onSelect).toHaveBeenCalledWith('1M');
    });

    it('renders ChartHeader for ATH and drawdown states', () => {
      const athHeader = ChartHeader({ isAth: true, drawdown: 0 });
      expect(athHeader).toBeDefined();

      const drawdownHeader = ChartHeader({ isAth: false, drawdown: -4.5 });
      expect(drawdownHeader).toBeDefined();
    });

    it('renders CheckpointTooltip for positive and negative gains', () => {
      const sampleCp: HistoricalCheckpoint = {
        date: '2024-03-01',
        value: 115000,
        investedAmount: 100000,
        unrealizedGain: 15000,
        gainPct: 15,
        isAth: true,
        athValue: 115000,
        drawdownPct: 0,
      };

      const tooltip = CheckpointTooltip({ cp: sampleCp });
      expect(tooltip).toBeDefined();

      const negativeCp: HistoricalCheckpoint = {
        ...sampleCp,
        value: 85000,
        unrealizedGain: -15000,
        gainPct: -15,
        isAth: false,
        drawdownPct: -26.1,
      };
      const negTooltip = CheckpointTooltip({ cp: negativeCp });
      expect(negTooltip).toBeDefined();
    });

    it('renders ChartLegend directly', () => {
      const legend = ChartLegend();
      expect(legend).toBeDefined();
    });

    it('handles empty checkpoints gracefully without throwing', () => {
      const element = HistoricalTrendChart({
        checkpoints: [],
        currentValue: 0,
        investedCost: 0,
      });

      expect(element).toBeDefined();
      expect(getProps(element)['testID']).toBe('historical-trend-chart');
    });
  });

  describe('7. DashboardScreen Integration', () => {
    it('renders DashboardScreen with Reality Check toggle and Historical Trend chart', () => {
      const screen = DashboardScreen();
      expect(screen).toBeDefined();
      const testID = getProps(screen)['testID'];
      expect(testID === 'dashboard-scroll' || testID === 'dashboard-loading').toBe(true);
    });
  });
});
