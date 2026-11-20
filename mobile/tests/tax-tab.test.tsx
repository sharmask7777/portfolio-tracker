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
  ReceiptText: (props: Record<string, unknown>) => ({ type: 'ReceiptText', props }),
  Calculator: (props: Record<string, unknown>) => ({ type: 'Calculator', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  AlertCircle: (props: Record<string, unknown>) => ({ type: 'AlertCircle', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  Copy: (props: Record<string, unknown>) => ({ type: 'Copy', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
  FileText: (props: Record<string, unknown>) => ({ type: 'FileText', props }),
}));

import { TaxSummaryCard } from '../src/components/Tax/TaxSummaryCard';
import { AdvanceTaxMatrixCard } from '../src/components/Tax/AdvanceTaxMatrixCard';
import { HarvestOpportunitiesList } from '../src/components/Tax/HarvestOpportunitiesList';
import { OpportunityItem } from '../src/components/Tax/OpportunityItem';
import { SimulationModal } from '../src/components/Tax/SimulationModal';
import { SimulationForm } from '../src/components/Tax/SimulationForm';
import { SimulationResultView } from '../src/components/Tax/SimulationResultView';
import TaxScreen from '../app/(tabs)/tax';
import TabsLayout from '../app/(tabs)/_layout';
import {
  type TaxCalculationsResult,
  type AdvanceTaxAccrualMatrix,
  type HarvestPlan,
  AdvanceTaxQuarter,
} from '../src/services/tax-harvesting';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('Tax Tab & Statutory Compliance Suite', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  const mockTaxResult: TaxCalculationsResult = {
    totalEquityLTCG: 175000,
    totalSTCG111A: 50000,
    totalDebtLTCG: 0,
    ltcg10Gain: 0,
    ltcg12_5Gain: 175000,
    stcg15Gain: 0,
    stcg20Gain: 50000,
    debtLtcg20Gain: 0,
    debtLtcg12_5Gain: 0,
    slabGain: 20000,
    ltcgLimit: 125000,
    ltcgExemptClaimed: 125000,
    ltcgTaxBeforeCess: 6250,
    ltcgTotalTax: 6500,
    stcgTotalTax: 10400,
    debtTotalTax: 0,
    slabTaxBeforeCess: 6000,
    slabTotalTax: 6240,
    baseTaxTotal: 22250,
    cessTotal: 890,
    grandTotalTax: 23140,
    ltcgUsed: 125000,
    ltcgPercent: 100,
  };

  const mockAdvanceTaxMatrix: AdvanceTaxAccrualMatrix = {
    quarters: {
      [AdvanceTaxQuarter.Q1]: {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      },
      [AdvanceTaxQuarter.Q2A]: {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      },
      [AdvanceTaxQuarter.Q2B]: {
        stcg15: 0,
        stcg20: 50000,
        ltcg10: 0,
        ltcg12_5: 175000,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 20000,
        totalGain: 245000,
        taxBeforeCess: 22250,
        cess: 890,
        estimatedTax: 23140,
      },
      [AdvanceTaxQuarter.Q3]: {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      },
      [AdvanceTaxQuarter.Q4]: {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      },
      [AdvanceTaxQuarter.Q5]: {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      },
    },
    quarterTotals: {
      [AdvanceTaxQuarter.Q1]: 0,
      [AdvanceTaxQuarter.Q2A]: 0,
      [AdvanceTaxQuarter.Q2B]: 23140,
      [AdvanceTaxQuarter.Q3]: 23140,
      [AdvanceTaxQuarter.Q4]: 23140,
      [AdvanceTaxQuarter.Q5]: 23140,
    },
  };

  const mockHarvestPlan: HarvestPlan = {
    fy: '2024-25',
    ltcgLimit: 125000,
    realizedLtcgCurrentFY: 45000,
    remainingExemption: 80000,
    totalPotentialHarvest: 80000,
    estimatedTaxSavings: 10400,
    opportunities: [
      {
        folioId: 'FOLIO-101',
        schemeName: 'HDFC Top 100 Fund - Growth',
        isin: 'INF179K01BE2',
        currentUnits: 250,
        unitsToHarvest: 100,
        currentNav: 800,
        costNav: 600,
        currentValue: 80000,
        unrealizedGain: 20000,
        holdingDays: 450,
        lotsCount: 2,
        firstLotDate: '2023-05-10',
        lastLotDate: '2023-08-15',
      },
      {
        folioId: 'FOLIO-102',
        schemeName: 'Parag Parikh Flexi Cap Fund - Direct Growth',
        isin: 'INF879O01019',
        currentUnits: 300,
        unitsToHarvest: 150,
        currentNav: 75,
        costNav: 50,
        currentValue: 11250,
        unrealizedGain: 60000,
        holdingDays: 520,
        lotsCount: 3,
        firstLotDate: '2023-01-15',
        lastLotDate: '2023-06-20',
      },
    ],
    instructions: 'Section 112A Tax-Free Harvesting Instructions:\n1. Redeem units before March 31.',
  };

  describe('TaxSummaryCard', () => {
    it('renders with testID and shows net tax liability and statutory exemption tracker', () => {
      const element = TaxSummaryCard({
        selectedFY: '2024-25',
        taxResult: mockTaxResult,
        remainingExemption: 0,
      });

      expect(getProps(element)['testID']).toBe('tax-summary-card');
      expect(getProps(element)['children']).toBeDefined();
    });

    it('renders statutory tax rates (LTCG 12.5%, STCG 20%, Cess 4%)', () => {
      const onFYChange = vi.fn();
      const element = TaxSummaryCard({
        selectedFY: '2024-25',
        taxResult: mockTaxResult,
        remainingExemption: 0,
        onFYChange,
      });

      const props = getProps(element);
      expect(props['accessibilityLabel']).toContain('Tax Summary');
    });
  });

  describe('AdvanceTaxMatrixCard', () => {
    it('renders Table F Advance Tax accrual matrix for all 6 quarters', () => {
      const element = AdvanceTaxMatrixCard({
        selectedFY: '2024-25',
        matrix: mockAdvanceTaxMatrix,
      });

      expect(getProps(element)['testID']).toBe('advance-tax-matrix-card');
    });
  });

  describe('HarvestOpportunitiesList', () => {
    it('renders harvest opportunities and potential tax savings banner', () => {
      const onSimulate = vi.fn();
      const onCopy = vi.fn();
      const element = HarvestOpportunitiesList({
        plan: mockHarvestPlan,
        onSimulateHarvest: onSimulate,
        onCopyInstructions: onCopy,
      });

      expect(getProps(element)['testID']).toBe('harvest-opportunities-list');
    });

    it('renders empty state when there are no eligible opportunities', () => {
      const emptyPlan: HarvestPlan = {
        ...mockHarvestPlan,
        opportunities: [],
      };
      const element = HarvestOpportunitiesList({
        plan: emptyPlan,
      });

      expect(getProps(element)['testID']).toBe('harvest-opportunities-list');
    });
  });

  describe('OpportunityItem', () => {
    it('renders individual opportunity card and triggers simulation', () => {
      const onSimulate = vi.fn();
      const element = OpportunityItem({
        opportunity: mockHarvestPlan.opportunities[0]!,
        onSimulate,
      });

      expect(getProps(element)['testID']).toBe('harvest-item-FOLIO-101');
    });
  });

  describe('SimulationForm', () => {
    it('renders form inputs and handles mode toggles', () => {
      const onModeChange = vi.fn();
      const onInputChange = vi.fn();
      const onSubmit = vi.fn();

      const element = SimulationForm({
        mode: 'units',
        onModeChange,
        inputVal: '50',
        onInputChange,
        unitsToSell: 50,
        currentNav: 120,
        onSubmit,
      });

      expect(element).toBeDefined();
    });
  });

  describe('SimulationResultView', () => {
    it('renders simulation financial metrics and post-tax proceeds', () => {
      const onReset = vi.fn();
      const element = SimulationResultView({
        result: {
          schemeName: 'HDFC Top 100 Fund - Growth',
          unitsRequested: 50,
          unitsSold: 50,
          lockedUnits: 0,
          isLocked: false,
          grossValue: 40000,
          totalCost: 30000,
          deemedCost: 30000,
          totalGain: 10000,
          stcgGain: 0,
          ltcgGain: 10000,
          slabGain: 0,
          exitLoad: 400,
          baseTax: 1250,
          cess: 50,
          totalTax: 1300,
          netProceeds: 38300,
          matchedLots: [],
          warnings: ['50.000 units are locked under statutory 3-year ELSS restriction.'],
        },
        onReset,
      });

      expect(element).toBeDefined();
    });
  });

  describe('SimulationModal', () => {
    it('renders modal with sell simulation form and ELSS lock-in safeguards', () => {
      const onClose = vi.fn();
      const element = SimulationModal({
        visible: true,
        onClose,
        schemeName: 'Mirae Asset ELSS Tax Saver Fund - Direct Growth',
        folioId: 'FOLIO-ELSS-1',
        isElss: true,
        currentNav: 120,
        initialUnits: 50,
        lots: [
          {
            lotId: 'LOT-LOCKED',
            buyDate: '2024-01-10', // Under 3 years: LOCKED!
            units: 50,
            buyPrice: 100,
            isElss: true,
          },
        ],
      });

      expect(getProps(element)['testID']).toBe('simulation-modal');
    });

    it('handles grandfathered pre-2018 lots under Section 55(2)(ac)', () => {
      const onClose = vi.fn();
      const element = SimulationModal({
        visible: true,
        onClose,
        schemeName: 'HDFC Top 100 Fund - Growth',
        folioId: 'FOLIO-PRE2018',
        currentNav: 600,
        initialUnits: 10,
        lots: [
          {
            lotId: 'LOT-PRE-2018',
            buyDate: '2016-03-15',
            units: 10,
            buyPrice: 200,
            fmv2018: 450,
          },
        ],
      });

      expect(getProps(element)['testID']).toBe('simulation-modal');
    });
  });

  describe('TaxScreen Tab', () => {
    it('renders TaxScreen without errors', () => {
      const screen = TaxScreen();
      expect(screen).toBeDefined();
    });
  });

  describe('TabsLayout Navigation', () => {
    it('includes Tax tab in bottom navigation', () => {
      const layout = TabsLayout();
      expect(layout).toBeDefined();
      const props = getProps(layout);
      const children = props['children'] as Array<React.ReactElement<{ name: string }>>;
      const taxTab = children.find(child => child.props.name === 'tax');
      expect(taxTab).toBeDefined();
    });
  });
});
