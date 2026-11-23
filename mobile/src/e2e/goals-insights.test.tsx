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
import type { EnrichedHolding } from '../services/portfolio-service';
import {
  saveGoals,
  calculateRequiredMonthlySip,
  calculateGoalProgress,
  type FinancialGoal,
} from '../services/goals-service';

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
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Target: (props: Record<string, unknown>) => ({ type: 'Target', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  Edit3: (props: Record<string, unknown>) => ({ type: 'Edit3', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  Calendar: (props: Record<string, unknown>) => ({ type: 'Calendar', props }),
  AlertTriangle: (props: Record<string, unknown>) => ({ type: 'AlertTriangle', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  CheckCircle2: (props: Record<string, unknown>) => ({ type: 'CheckCircle2', props }),
  Sparkles: (props: Record<string, unknown>) => ({ type: 'Sparkles', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
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
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

const mockSyntheticHoldings: EnrichedHolding[] = [
  {
    id: 'h-goal-1',
    folio_number: '12345/A',
    amfi_code: '120503',
    scheme_name: 'HDFC Top 100 Fund - Growth',
    isin: 'INF179K01BE2',
    units: 1000,
    invested_cost: 400000,
    current_nav: 600,
    current_value: 600000,
    asset_class: 'EQUITY',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 5000,
    dayChangePct: 0.84,
    gainLoss: 200000,
    gainLossPct: 50,
  },
];

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getEnrichedHoldings: vi.fn(async () => mockSyntheticHoldings),
  };
});

import InsightsScreen from '../../app/(tabs)/insights';

describe('Maestro Flow 08: Goals Tracking & Financial Insights Simulation', () => {
  const initialGoals: FinancialGoal[] = [
    {
      id: 'goal-ret-1',
      name: 'Retirement Nest Egg',
      category: 'Retirement',
      priority: 'High',
      targetAmount: 20000000,
      targetDate: '2045-12-31',
      allocatedPercentage: 50,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();

    // Pre-populate initial goal
    await saveGoals(initialGoals);
  });

  it('validates financial goals loading, summary stats, and smart portfolio insights', async () => {
    render(() => <InsightsScreen />);

    // 1. Verify Header and Screen Title
    await waitFor(() => {
      expect(screen.getByText('Goals & Insights')).toBeDefined();
      expect(screen.getByText('Financial Planning')).toBeDefined();
      expect(screen.getByText('Total Goals Target')).toBeDefined();
      expect(screen.getByText('Smart Portfolio Insights')).toBeDefined();
      expect(screen.getByText('Retirement Nest Egg')).toBeDefined();
      expect(screen.getByText('Required Monthly SIP')).toBeDefined();
    });

    // 3. Verify Add Goal Modal flow
    const addGoalBtn = screen.getByText('Add Goal');
    fireEvent.press(addGoalBtn);

    await waitFor(() => {
      expect(screen.getByText('Create New Goal')).toBeDefined();
    });

    const nameInput = screen.getByText('e.g. Retirement 2045');
    fireEvent.changeText(nameInput, 'Child Higher Education');

    const amountInput = screen.getByText('e.g. 2500000');
    fireEvent.changeText(amountInput, '3500000');

    const saveBtn = screen.getByText('Save Goal');
    fireEvent.press(saveBtn);

    // 4. Verify new goal appears in list
    await waitFor(() => {
      expect(screen.getByText('Child Higher Education')).toBeDefined();
    });
  });

  it('validates editing and deleting an existing goal', async () => {
    render(() => <InsightsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Retirement Nest Egg')).toBeDefined();
    });

    // 1. Trigger Edit on goal
    const editBtn = screen.getByText('Edit Goal');
    fireEvent.press(editBtn);

    await waitFor(() => {
      expect(screen.getByText('Edit Financial Goal')).toBeDefined();
    });

    // Update target amount
    const amountInput = screen.getByText('e.g. 2500000');
    fireEvent.changeText(amountInput, '25000000');

    const updateBtn = screen.getByText('Update Goal');
    fireEvent.press(updateBtn);

    // 2. Delete goal
    await waitFor(() => {
      expect(screen.getByText('Delete Goal')).toBeDefined();
    });

    const deleteBtn = screen.getByText('Delete Goal');
    fireEvent.press(deleteBtn);

    // Verify goal deletion
    await waitFor(() => {
      expect(screen.queryByText('Retirement Nest Egg')).toBeNull();
    });
  });

  it('validates SIP compounding shortfall calculation invariant', () => {
    // Zero target or already achieved requires ₹0 SIP
    const zeroSip = calculateRequiredMonthlySip(100000, 100000, { remainingMonths: 12, annualReturnRate: 0.12 });
    expect(zeroSip).toBe(0);

    // 10 years, ₹50L target with ₹10L current value at 12% expected return
    const sip = calculateRequiredMonthlySip(5000000, 1000000, { remainingMonths: 120, annualReturnRate: 0.12 });
    expect(sip).toBeGreaterThan(0);
    expect(sip).toBeLessThan(50000);

    // Progress invariant
    const goal: FinancialGoal = {
      id: 'g-inv',
      name: 'Emergency Fund',
      category: 'Emergency Fund',
      priority: 'High',
      targetAmount: 500000,
      targetDate: '2028-12-31',
      allocatedPercentage: 100,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const progress = calculateGoalProgress(goal, mockSyntheticHoldings, 600000);
    expect(progress.currentValue).toBe(600000);
    expect(progress.progressPercentage).toBe(120);
    expect(progress.status).toBe('Completed');
  });
});
