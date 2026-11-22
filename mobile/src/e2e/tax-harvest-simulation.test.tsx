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
  simulateSellRedemption,
  calculateSection55DeemedCost,
} from '../services/tax-harvesting';

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
  User: (props: Record<string, unknown>) => ({ type: 'User', props }),
  ReceiptText: (props: Record<string, unknown>) => ({ type: 'ReceiptText', props }),
  Calculator: (props: Record<string, unknown>) => ({ type: 'Calculator', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  AlertCircle: (props: Record<string, unknown>) => ({ type: 'AlertCircle', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  Copy: (props: Record<string, unknown>) => ({ type: 'Copy', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  ChevronDown: (props: Record<string, unknown>) => ({ type: 'ChevronDown', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
  FileText: (props: Record<string, unknown>) => ({ type: 'FileText', props }),
  Share2: (props: Record<string, unknown>) => ({ type: 'Share2', props }),
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

const mockSyntheticHoldings: EnrichedHolding[] = [
  {
    id: 'h-tax-1',
    folio_number: '12345/A',
    amfi_code: '120503',
    scheme_name: 'HDFC Top 100 Fund - Growth',
    isin: 'INF179K01BE2',
    units: 100,
    invested_cost: 40000,
    current_nav: 600,
    current_value: 60000,
    asset_class: 'EQUITY',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 500,
    dayChangePct: 0.84,
    gainLoss: 20000,
    gainLossPct: 50,
  },
  {
    id: 'h-tax-2',
    folio_number: '54321/B',
    amfi_code: '119551',
    scheme_name: 'Mirae Asset ELSS Tax Saver Fund - Growth',
    isin: 'INF769K01AX4',
    units: 50,
    invested_cost: 10000,
    current_nav: 300,
    current_value: 15000,
    asset_class: 'EQUITY',
    nav_date: '2026-11-17',
    updated_at: '2026-11-17T10:00:00Z',
    dayChange: 200,
    dayChangePct: 1.35,
    gainLoss: 5000,
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

import TaxScreen from '../../app/(tabs)/tax';
import { SimulationModal } from '../../src/components/Tax/SimulationModal';

describe('Maestro Flow 04: Tax & Statutory Harvesting Simulation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();
  });

  it('validates tax summary loading, exemption tracker, advance tax, and harvest list', async () => {
    render(() => <TaxScreen />);

    // 1. Verify Tax Header and Statutory Compliance titles
    await waitFor(() => {
      expect(screen.getByText('Tax & ITR')).toBeDefined();
      expect(screen.getByText('Statutory Compliance')).toBeDefined();
    });

    // 2. Verify Tax Summary Card and Section 112A ₹1.25L Exemption progress bar
    expect(screen.getByTestId('tax-summary-card')).toBeDefined();
    expect(screen.getByText('Sec 112A ₹1.25L Exemption')).toBeDefined();
    expect(screen.getByText('Equity LTCG')).toBeDefined();
    expect(screen.getByText('Equity STCG')).toBeDefined();
    expect(screen.getByText('Section 50AA Slab Debt')).toBeDefined();

    // 3. Verify Table F Advance Tax Matrix Card and Statutory Accrual Quarters
    expect(screen.getByTestId('advance-tax-matrix-card')).toBeDefined();
    expect(screen.getByText('Advance Tax Table F')).toBeDefined();
    expect(screen.getByTestId('advance-tax-quarter-Q1')).toBeDefined();
    expect(screen.getByTestId('advance-tax-quarter-Q2a')).toBeDefined();
    expect(screen.getByTestId('advance-tax-quarter-Q3')).toBeDefined();
    expect(screen.getByTestId('advance-tax-quarter-Q4')).toBeDefined();

    // 4. Verify Tax Loss/Gain Harvesting Opportunities
    expect(screen.getByTestId('harvest-opportunities-list')).toBeDefined();
    expect(screen.getByText('Tax-Free Harvesting')).toBeDefined();
    expect(screen.getByTestId('toggle-instructions-btn')).toBeDefined();
    expect(screen.getByTestId('copy-instructions-btn')).toBeDefined();

    // 5. Open Sell Simulation Modal from screen header
    const simBtn = screen.getByTestId('open-sell-simulation-btn');
    fireEvent.press(simBtn);

    await waitFor(() => {
      expect(screen.getByTestId('simulation-modal')).toBeDefined();
      expect(screen.getByText('Simulate Redemption')).toBeDefined();
      expect(screen.getByTestId('sim-units-input')).toBeDefined();
    });

    // 6. Enter units to sell and submit simulation
    fireEvent.changeText(screen.getByTestId('sim-units-input'), '50');
    fireEvent.press(screen.getByTestId('simulate-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sim-net-proceeds')).toBeDefined();
      expect(screen.getByText('Net In-Hand Proceeds')).toBeDefined();
    });

    // 7. Close simulation modal
    fireEvent.press(screen.getByTestId('close-simulation-modal-btn'));
  });

  it('validates ELSS statutory lock-in restriction checks in sell simulation', async () => {
    // Render SimulationModal directly with locked ELSS lots (<3 years holding)
    render(() => (
      <SimulationModal
        visible={true}
        schemeName="Axis Long Term Equity ELSS Fund"
        folioId="ELSS-FOLIO-1"
        currentNav={150}
        initialUnits={100}
        isElss={true}
        onClose={vi.fn()}
        lots={[
          {
            lotId: 'LOT-ELSS-LOCKED',
            buyDate: '2025-01-15',
            units: 100,
            buyPrice: 100,
            isElss: true,
          },
        ]}
      />
    ));

    expect(screen.getByTestId('simulation-modal')).toBeDefined();
    fireEvent.press(screen.getByTestId('simulate-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('elss-lock-warning')).toBeDefined();
      expect(screen.getByText('locked under statutory 3-year ELSS restriction and cannot be redeemed.')).toBeDefined();
    });
  });

  it('validates Section 55(2)(ac) grandfathering deemed cost formulation', () => {
    // Oracle check for Section 55 deemed cost formula: max(cost, min(fmv2018, sellPrice))
    // Case A: Pre-2018 purchase, FMV is between cost and sell price -> deemed cost is FMV
    const deemedCostA = calculateSection55DeemedCost({
      cost: 100,
      fmv2018: 250,
      sellPrice: 300,
      isPre2018: true,
    });
    expect(deemedCostA).toBe(250);

    // Case B: Sell price dropped below FMV -> deemed cost capped at sell price (no artificial loss)
    const deemedCostB = calculateSection55DeemedCost({
      cost: 100,
      fmv2018: 250,
      sellPrice: 200,
      isPre2018: true,
    });
    expect(deemedCostB).toBe(200);

    // Complete lot simulation verifying grandfathered deemed cost reduction on LTCG
    const simResult = simulateSellRedemption({
      folioId: 'FOLIO-PRE-2018',
      schemeName: 'Synthetic Bluechip Equity Fund',
      isElss: false,
      assetClass: 'EQUITY',
      unitsToSell: 100,
      sellPrice: 300,
      sellDate: '2024-09-01',
      taxSlab: 0.30,
      lots: [
        {
          lotId: 'LOT-2017',
          buyDate: '2017-06-01',
          units: 100,
          buyPrice: 100,
          fmv2018: 250,
          isElss: false,
        },
      ],
    });

    expect(simResult.totalCost).toBe(10000);
    expect(simResult.deemedCost).toBe(25000);
    expect(simResult.grossValue).toBe(30000);
    expect(simResult.ltcgGain).toBe(5000);
    expect(simResult.totalGain).toBe(5000);
  });
});
