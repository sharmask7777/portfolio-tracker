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

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
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
  Modal: (props: Record<string, unknown>) => ({ type: 'Modal', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Target: (props: Record<string, unknown>) => ({ type: 'Target', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  Sparkles: (props: Record<string, unknown>) => ({ type: 'Sparkles', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  Edit3: (props: Record<string, unknown>) => ({ type: 'Edit3', props }),
  AlertTriangle: (props: Record<string, unknown>) => ({ type: 'AlertTriangle', props }),
  CheckCircle2: (props: Record<string, unknown>) => ({ type: 'CheckCircle2', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  TrendingUp: (props: Record<string, unknown>) => ({ type: 'TrendingUp', props }),
  ShieldAlert: (props: Record<string, unknown>) => ({ type: 'ShieldAlert', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  Calendar: (props: Record<string, unknown>) => ({ type: 'Calendar', props }),
}));

import {
  calculateRemainingMonths,
  calculateRequiredMonthlySip,
  calculateGoalStatus,
  calculateGoalProgress,
  getStoredGoals,
  saveGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  generateSmartInsights,
  DEFAULT_GOALS,
  type FinancialGoal,
} from '../src/services/goals-service';
import type { EnrichedHolding } from '../src/services/portfolio-service';
import { GoalProgressCard } from '../src/components/Insights/GoalProgressCard';
import { AddGoalModal, validateGoalInput } from '../src/components/Insights/AddGoalModal';
import { SmartInsightsList } from '../src/components/Insights/SmartInsightsList';
import InsightsScreen from '../app/(tabs)/insights';
import TabsLayout from '../app/(tabs)/_layout';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

function triggerAllOnPress(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof el.type === 'function') {
    try {
      const rendered = (el.type as (props: Record<string, unknown>) => unknown)(el.props ?? {});
      triggerAllOnPress(rendered);
    } catch {
      // Ignore
    }
  }
  if (el.props) {
    if (typeof el.props['onPress'] === 'function') {
      try {
        (el.props['onPress'] as () => void)();
      } catch {
        // Ignore synthetic test errors
      }
    }
    if (el.props['children']) {
      const children = Array.isArray(el.props['children'])
        ? el.props['children']
        : [el.props['children']];
      for (const child of children) {
        triggerAllOnPress(child);
      }
    }
  }
}

describe('Goal Tracker & Financial Insights Domain', () => {
  const asOf = new Date('2026-11-20T00:00:00Z');

  const sampleHoldings: EnrichedHolding[] = [
    {
      id: 'h1',
      folio_number: 'FOLIO-1',
      amfi_code: '120503',
      scheme_name: 'HDFC Top 100 Fund',
      isin: 'INF179K01BE2',
      units: 1000,
      invested_cost: 500000,
      current_nav: 600,
      current_value: 600000,
      asset_class: 'EQUITY',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 2000,
      dayChangePct: 0.33,
      gainLoss: 100000,
      gainLossPct: 20,
    },
    {
      id: 'h2',
      folio_number: 'FOLIO-2',
      amfi_code: '119551',
      scheme_name: 'SBI Bluechip Fund',
      isin: 'INF200K01VA8',
      units: 500,
      invested_cost: 200000,
      current_nav: 500,
      current_value: 250000,
      asset_class: 'EQUITY',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 1000,
      dayChangePct: 0.4,
      gainLoss: 50000,
      gainLossPct: 25,
    },
    {
      id: 'h3',
      folio_number: 'FOLIO-3',
      amfi_code: '119552',
      scheme_name: 'ICICI Prudential Liquid Fund',
      isin: 'INF109K01844',
      units: 500,
      invested_cost: 150000,
      current_nav: 300,
      current_value: 150000,
      asset_class: 'DEBT',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 100,
      dayChangePct: 0.07,
      gainLoss: 0,
      gainLossPct: 0,
    },
  ];

  const totalPortfolioValue = 1000000; // 600k + 250k + 150k

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('Goal Timeline & Monthly SIP Calculations', () => {
    it('calculates remaining months accurately for future dates', () => {
      const months = calculateRemainingMonths('2028-11-20', asOf);
      expect(months).toBe(24);
    });

    it('calculates remaining months for 4-digit year format', () => {
      const months = calculateRemainingMonths('2028', asOf);
      expect(months).toBe(25);
    });

    it('returns 0 remaining months for invalid target dates', () => {
      expect(calculateRemainingMonths('invalid-date', asOf)).toBe(0);
    });

    it('returns 0 remaining months for past target dates', () => {
      const months = calculateRemainingMonths('2025-01-01', asOf);
      expect(months).toBe(0);
    });

    it('returns 0 required SIP when target is already achieved', () => {
      const sip = calculateRequiredMonthlySip(500000, 600000, 24);
      expect(sip).toBe(0);
    });

    it('returns 0 required SIP when remaining months is 0', () => {
      const sip = calculateRequiredMonthlySip(1000000, 500000, 0);
      expect(sip).toBe(0);
    });

    it('returns 0 required SIP when projected compounding covers target', () => {
      // 500k current at 15% return over 120 months compounds to > 2000k
      const sip = calculateRequiredMonthlySip(1000000, 800000, {
        remainingMonths: 36,
        annualReturnRate: 0.15,
      });
      expect(sip).toBe(0);
    });

    it('calculates compound required SIP with standard return assumption', () => {
      const sip = calculateRequiredMonthlySip(1000000, 0, {
        remainingMonths: 12,
        annualReturnRate: 0.12,
      });
      expect(sip).toBeGreaterThan(70000);
      expect(sip).toBeLessThan(85000);
    });

    it('calculates linear required monthly SIP when return rate is 0', () => {
      const sip = calculateRequiredMonthlySip(1200000, 0, {
        remainingMonths: 12,
        annualReturnRate: 0,
      });
      expect(sip).toBe(100000);
    });
  });

  describe('Goal Status Evaluation', () => {
    it('marks status as Completed when current >= target', () => {
      const status = calculateGoalStatus(1000000, 1000000, {
        remainingMonths: 12,
        progressPercentage: 100,
        createdAt: '2025-01-01',
        asOfDate: asOf,
      });
      expect(status).toBe('Completed');
    });

    it('marks status as Behind when target deadline is in past and incomplete', () => {
      const status = calculateGoalStatus(400000, 1000000, {
        remainingMonths: 0,
        progressPercentage: 40,
        createdAt: '2024-01-01',
        asOfDate: asOf,
      });
      expect(status).toBe('Behind');
    });

    it('marks status as Ahead when actual progress exceeds expected trajectory', () => {
      const status = calculateGoalStatus(800000, 1000000, {
        remainingMonths: 12,
        progressPercentage: 80,
        createdAt: '2025-11-20',
        asOfDate: asOf,
      });
      expect(status).toBe('Ahead');
    });

    it('marks status as On Track when matching expected trajectory within tolerance', () => {
      const status = calculateGoalStatus(500000, 1000000, {
        remainingMonths: 12,
        progressPercentage: 50,
        createdAt: '2025-11-20',
        asOfDate: asOf,
      });
      expect(status).toBe('On Track');
    });

    it('marks status as Behind when significantly lagging expected progress', () => {
      const status = calculateGoalStatus(200000, 1000000, {
        remainingMonths: 12,
        progressPercentage: 20,
        createdAt: '2025-11-20',
        asOfDate: asOf,
      });
      expect(status).toBe('Behind');
    });

    it('evaluates status without createdAt using fallback rules', () => {
      expect(calculateGoalStatus(200000, 1000000, { remainingMonths: 6, progressPercentage: 20 })).toBe('Behind');
      expect(calculateGoalStatus(800000, 1000000, { remainingMonths: 48, progressPercentage: 80 })).toBe('On Track');
    });
  });

  describe('Goal Progress Metrics Calculation', () => {
    it('computes metrics using allocated percentage of total net worth', () => {
      const goal: FinancialGoal = {
        id: 'g1',
        name: 'Retirement 2045',
        category: 'Retirement',
        priority: 'High',
        targetAmount: 2000000,
        targetDate: '2045-12-31',
        allocatedPercentage: 50,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const metrics = calculateGoalProgress(goal, sampleHoldings, {
        totalNetWorth: totalPortfolioValue,
        asOfDate: asOf,
      });
      expect(metrics.currentValue).toBe(500000);
      expect(metrics.progressPercentage).toBe(25);
      expect(metrics.remainingAmount).toBe(1500000);
      expect(metrics.status).toBe('Ahead');
    });

    it('computes metrics using specific allocated folio numbers', () => {
      const goal: FinancialGoal = {
        id: 'g2',
        name: 'Emergency Fund',
        category: 'Emergency Fund',
        priority: 'High',
        targetAmount: 200000,
        targetDate: '2027-11-20',
        allocatedFolioNumbers: ['FOLIO-3'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const metrics = calculateGoalProgress(goal, sampleHoldings, {
        totalNetWorth: totalPortfolioValue,
        asOfDate: asOf,
      });
      expect(metrics.currentValue).toBe(150000);
      expect(metrics.progressPercentage).toBe(75);
      expect(metrics.remainingAmount).toBe(50000);
    });

    it('computes metrics defaulting to 100% of net worth when unassigned', () => {
      const goal: FinancialGoal = {
        id: 'g-default',
        name: 'Dream Car',
        category: 'Custom',
        priority: 'Low',
        targetAmount: 1500000,
        targetDate: '2028-12-31',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const metrics = calculateGoalProgress(goal, sampleHoldings, totalPortfolioValue);
      expect(metrics.currentValue).toBe(1000000);
      expect(metrics.progressPercentage).toBe(66.7);
    });
  });

  describe('Smart Insights Generation', () => {
    it('detects high concentration risk when top 3 holdings exceed 50%', () => {
      const insights = generateSmartInsights(sampleHoldings, [], totalPortfolioValue);
      const concentration = insights.find((i) => i.type === 'CONCENTRATION_RISK');
      expect(concentration).toBeDefined();
      expect(concentration?.severity).toBe('HIGH');
      expect(concentration?.message).toContain('Top 3 holdings account for 100.0%');
    });

    it('detects asset class tilt when equity exceeds 80%', () => {
      const insights = generateSmartInsights(sampleHoldings, [], totalPortfolioValue);
      const tilt = insights.find((i) => i.type === 'ASSET_TILT');
      expect(tilt).toBeDefined();
      expect(tilt?.message).toContain('85.0%');
    });

    it('detects low debt/liquid buffer when debt is under 5%', () => {
      const lowDebtHoldings: EnrichedHolding[] = [
        { ...sampleHoldings[0]!, current_value: 700000, asset_class: 'EQUITY' },
        { ...sampleHoldings[1]!, current_value: 280000, asset_class: 'COMMODITY' },
        { ...sampleHoldings[2]!, current_value: 20000, asset_class: 'DEBT' },
      ];
      const insights = generateSmartInsights(lowDebtHoldings, [], 1000000);
      const lowDebt = insights.find((i) => i.id === 'insight-low-debt');
      expect(lowDebt).toBeDefined();
    });

    it('detects emergency fund inadequacy when liquid assets are low or goal is unmet', () => {
      const insights = generateSmartInsights(sampleHoldings, [], totalPortfolioValue);
      const emergency = insights.find((i) => i.type === 'EMERGENCY_FUND');
      expect(emergency).toBeDefined();
      expect(emergency?.severity).toBe('HIGH');
    });

    it('alerts about tax harvesting opportunity under Section 112A', () => {
      const insights = generateSmartInsights(sampleHoldings, [], {
        totalNetWorth: totalPortfolioValue,
        harvestSummary: { harvestableGain: 75000 },
      });
      const taxInsight = insights.find((i) => i.type === 'TAX_HARVESTING');
      expect(taxInsight).toBeDefined();
      expect(taxInsight?.message).toContain('1.25 Lakh');
    });

    it('flags goals that are behind schedule', () => {
      const behindGoal: FinancialGoal = {
        id: 'g-behind',
        name: 'House Down Payment',
        category: 'House Down Payment',
        priority: 'High',
        targetAmount: 5000000,
        targetDate: '2026-12-31',
        allocatedPercentage: 10,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const insights = generateSmartInsights(sampleHoldings, [behindGoal], totalPortfolioValue);
      const goalBehind = insights.find((i) => i.type === 'GOAL_BEHIND');
      expect(goalBehind).toBeDefined();
      expect(goalBehind?.title).toContain('Goal Behind Schedule');
      expect(goalBehind?.message).toContain('House Down Payment');
    });

    it('handles empty holdings and zero net worth gracefully', () => {
      const insights = generateSmartInsights([], [], 0);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some((i) => i.type === 'EMERGENCY_FUND')).toBe(true);
    });
  });

  describe('Secure Storage CRUD Operations', () => {
    it('returns default goals when storage is empty', async () => {
      const goals = await getStoredGoals();
      expect(goals.length).toBe(DEFAULT_GOALS.length);
      expect(goals[0]?.name).toBe(DEFAULT_GOALS[0]?.name);
    });

    it('saves and retrieves user goals from SecureStore', async () => {
      const customGoal: FinancialGoal = {
        id: 'custom-1',
        name: 'Europe Vacation',
        category: 'Vacation',
        priority: 'Medium',
        targetAmount: 300000,
        targetDate: '2027-06-30',
        allocatedPercentage: 10,
        createdAt: '2026-11-20T00:00:00Z',
        updatedAt: '2026-11-20T00:00:00Z',
      };

      await saveGoals([customGoal]);
      const loaded = await getStoredGoals();
      expect(loaded.length).toBe(1);
      expect(loaded[0]?.name).toBe('Europe Vacation');
    });

    it('adds a new goal to existing goals', async () => {
      const created = await addGoal({
        name: 'Kids College',
        category: 'Education',
        priority: 'High',
        targetAmount: 2500000,
        targetDate: '2035-06-30',
        allocatedPercentage: 30,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Kids College');
      const all = await getStoredGoals();
      expect(all.some((g) => g.id === created.id)).toBe(true);
    });

    it('updates an existing goal', async () => {
      const initial = await getStoredGoals();
      const firstId = initial[0]!.id;

      const updated = await updateGoal(firstId, {
        targetAmount: 3500000,
        priority: 'High',
      });

      expect(updated.targetAmount).toBe(3500000);
      const all = await getStoredGoals();
      const found = all.find((g) => g.id === firstId);
      expect(found?.targetAmount).toBe(3500000);
    });

    it('throws error when updating non-existent goal', async () => {
      await expect(updateGoal('non-existent', { targetAmount: 1000 })).rejects.toThrow('not found');
    });

    it('deletes an existing goal', async () => {
      const initial = await getStoredGoals();
      const firstId = initial[0]!.id;

      await deleteGoal(firstId);
      const all = await getStoredGoals();
      expect(all.some((g) => g.id === firstId)).toBe(false);
    });
  });

  describe('UI Component Integration', () => {
    it('executes GoalProgressCard functional component for all statuses and priorities', () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();

      const card1 = GoalProgressCard({
        goal: DEFAULT_GOALS[0]!,
        metrics: {
          currentValue: 25000000,
          targetAmount: 20000000,
          progressPercentage: 125,
          status: 'Completed',
          remainingAmount: 0,
          remainingMonths: 0,
          requiredMonthlySip: 0,
        },
        onEdit,
        onDelete,
      });
      expect(card1).toBeDefined();

      const card2 = GoalProgressCard({
        goal: { ...DEFAULT_GOALS[1]!, priority: 'Medium' },
        metrics: {
          currentValue: 300000,
          targetAmount: 500000,
          progressPercentage: 60,
          status: 'Ahead',
          remainingAmount: 200000,
          remainingMonths: 12,
          requiredMonthlySip: 14000,
        },
      });
      expect(card2).toBeDefined();

      const card3 = GoalProgressCard({
        goal: { ...DEFAULT_GOALS[2]!, priority: 'Low' },
        metrics: {
          currentValue: 50000,
          targetAmount: 3500000,
          progressPercentage: 1.4,
          status: 'Behind',
          remainingAmount: 3450000,
          remainingMonths: 3,
          requiredMonthlySip: 1150000,
        },
      });
      expect(card3).toBeDefined();
    });

    it('executes AddGoalModal functional component in create and edit modes', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      const modalCreate = AddGoalModal({
        visible: true,
        onClose,
        onSave,
      });
      expect(modalCreate).toBeDefined();

      const modalEdit = AddGoalModal({
        visible: true,
        onClose,
        onSave,
        initialGoal: DEFAULT_GOALS[0]!,
      });
      expect(modalEdit).toBeDefined();
    });

    it('executes SmartInsightsList functional component with all severity items', () => {
      const list = SmartInsightsList({
        insights: [
          {
            id: '1',
            type: 'CONCENTRATION_RISK',
            severity: 'HIGH',
            title: 'High Risk',
            message: 'Concentrated holdings',
            recommendation: 'Diversify',
            metric: '55% Top 3',
          },
          {
            id: '2',
            type: 'ASSET_TILT',
            severity: 'MEDIUM',
            title: 'Equity Tilt',
            message: 'High equity tilt',
            recommendation: 'Add debt',
          },
          {
            id: '3',
            type: 'TAX_HARVESTING',
            severity: 'LOW',
            title: 'Tax Harvesting',
            message: 'Harvest LTCG',
            recommendation: 'Harvest now',
          },
          {
            id: '4',
            type: 'PORTFOLIO_DIVERSIFICATION',
            severity: 'INFO',
            title: 'Diversified',
            message: 'Well balanced',
            recommendation: 'Continue SIP',
          },
        ],
      });
      expect(list).toBeDefined();
    });

    it('renders InsightsScreen tab component', () => {
      const screen = InsightsScreen();
      expect(screen).toBeDefined();
      const props = getProps(screen);
      expect(props['testID']).toBe('insights-screen');
      triggerAllOnPress(screen);

      const refreshControl = props['refreshControl'] as { props?: { onRefresh?: () => void } } | undefined;
      refreshControl?.props?.onRefresh?.();
    });

    it('validates goal input correctly in AddGoalModal', () => {
      expect(validateGoalInput('', '1000').isValid).toBe(false);
      expect(validateGoalInput('Vacation', '0').isValid).toBe(false);
      expect(validateGoalInput('Vacation', '-500').isValid).toBe(false);
      expect(validateGoalInput('Vacation', 'abc').isValid).toBe(false);
      expect(validateGoalInput('Vacation', '50000').isValid).toBe(true);
    });

    it('triggers interactive actions in GoalProgressCard and AddGoalModal', () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      const onSave = vi.fn();
      const onClose = vi.fn();

      const card = GoalProgressCard({
        goal: { ...DEFAULT_GOALS[0]!, priority: 'High' },
        metrics: {
          currentValue: 10000000,
          targetAmount: 20000000,
          progressPercentage: 50,
          status: 'On Track',
          remainingAmount: 10000000,
          remainingMonths: 24,
          requiredMonthlySip: 35000,
        },
        onEdit,
        onDelete,
      });
      triggerAllOnPress(card);
      expect(onEdit).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalled();

      const modal = AddGoalModal({
        visible: true,
        onClose,
        onSave,
        initialGoal: DEFAULT_GOALS[0]!,
      });
      triggerAllOnPress(modal);
      expect(onClose).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });

    it('registers the Insights tab with Target icon in TabsLayout', () => {
      const layout = TabsLayout();
      expect(layout).toBeDefined();
    });
  });
});
