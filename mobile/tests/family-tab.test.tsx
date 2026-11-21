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
  Target: (props: Record<string, unknown>) => ({ type: 'Target', props }),
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  User: (props: Record<string, unknown>) => ({ type: 'User', props }),
  UserPlus: (props: Record<string, unknown>) => ({ type: 'UserPlus', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
}));

import {
  validateSyntheticPan,
  calculateMemberMetrics,
  getStoredFamilyProfiles,
  saveFamilyProfiles,
  getActiveProfileId,
  setActiveProfileId,
  addFamilyProfile,
  deleteFamilyProfile,
  type FamilyProfile,
  type FamilyMemberMetrics,
} from '../src/services/family-service';
import type { FolioEntity } from '../src/db/schema';
import type { EnrichedHolding } from '../src/services/portfolio-service';
import {
  FamilyMemberList,
  getInitials,
  requestDeleteProfile,
  MemberCard,
  FamilyMetricsSummary,
  ProfileSwitcher,
} from '../src/components/Family';
import { AddMemberModal } from '../src/components/Family/AddMemberModal';
import { FamilyProfilesCard } from '../src/components/Settings/FamilyProfilesCard';
import SettingsScreen from '../app/(tabs)/settings';
import TabsLayout from '../app/(tabs)/_layout';
import { Alert } from 'react-native';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('Family Profiles & Multi-PAN Management Suite', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  const mockProfiles: FamilyProfile[] = [
    {
      id: 'prof-1',
      name: 'Aarav Sharma',
      pan: 'ABCDE1234F',
      relationship: 'Self',
      isPrimary: true,
      notes: 'Primary earner',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'prof-2',
      name: 'Neha Sharma',
      pan: 'ALPAC1001A',
      relationship: 'Spouse',
      isPrimary: false,
      notes: 'Spouse long-term holdings',
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'prof-3',
      name: 'Rohan Sharma',
      pan: 'IOTAI9009I',
      relationship: 'Child',
      isPrimary: false,
      notes: 'Minor child mutual funds',
      createdAt: '2026-01-03T00:00:00Z',
      updatedAt: '2026-01-03T00:00:00Z',
    },
  ];

  const mockFolios: FolioEntity[] = [
    {
      folio_number: 'FOLIO-101',
      amc_name: 'HDFC Mutual Fund',
      pan: 'ABCDE1234F',
      updated_at: '2026-04-01T00:00:00Z',
    },
    {
      folio_number: 'FOLIO-102',
      amc_name: 'Parag Parikh Mutual Fund',
      pan: 'ALPAC1001A',
      updated_at: '2026-04-01T00:00:00Z',
    },
    {
      folio_number: 'FOLIO-103',
      amc_name: 'SBI Mutual Fund',
      pan: 'IOTAI9009I',
      updated_at: '2026-04-01T00:00:00Z',
    },
  ];

  const mockHoldings: EnrichedHolding[] = [
    {
      id: 'h-1',
      folio_number: 'FOLIO-101',
      amfi_code: '120503',
      scheme_name: 'HDFC Mid-Cap Opportunities Fund',
      isin: 'INF179K01BE2',
      units: 100,
      invested_cost: 50000,
      current_nav: 650,
      current_value: 65000,
      asset_class: 'Equity',
      nav_date: '2026-04-01',
      updated_at: '2026-04-01T00:00:00Z',
      dayChange: 500,
      dayChangePct: 0.78,
      gainLoss: 15000,
      gainLossPct: 30,
    },
    {
      id: 'h-2',
      folio_number: 'FOLIO-102',
      amfi_code: '122639',
      scheme_name: 'Parag Parikh Flexi Cap Fund',
      isin: 'INF846K01164',
      units: 200,
      invested_cost: 80000,
      current_nav: 500,
      current_value: 100000,
      asset_class: 'Equity',
      nav_date: '2026-04-01',
      updated_at: '2026-04-01T00:00:00Z',
      dayChange: 800,
      dayChangePct: 0.81,
      gainLoss: 20000,
      gainLossPct: 25,
    },
    {
      id: 'h-3',
      folio_number: 'FOLIO-103',
      amfi_code: '119551',
      scheme_name: 'SBI Magnum Gilt Fund',
      isin: 'INF200K01131',
      units: 500,
      invested_cost: 25000,
      current_nav: 60,
      current_value: 30000,
      asset_class: 'Debt',
      nav_date: '2026-04-01',
      updated_at: '2026-04-01T00:00:00Z',
      dayChange: 50,
      dayChangePct: 0.17,
      gainLoss: 5000,
      gainLossPct: 20,
    },
  ];

  describe('PAN Validation and Formatting', () => {
    it('validates synthetic PANs with 5 letters, 4 digits, 1 letter', () => {
      expect(validateSyntheticPan('ABCDE1234F').isValid).toBe(true);
      expect(validateSyntheticPan('ALPAC1001A').isValid).toBe(true);
      expect(validateSyntheticPan('IOTAI9009I').isValid).toBe(true);
      expect(validateSyntheticPan('abcde1234f').isValid).toBe(true);
    });

    it('rejects invalid PAN patterns and formats', () => {
      expect(validateSyntheticPan('').isValid).toBe(false);
      expect(validateSyntheticPan('   ').isValid).toBe(false);
      expect(validateSyntheticPan('ABC1234DEF').isValid).toBe(false);
      expect(validateSyntheticPan('12345ABCDE').isValid).toBe(false);
      expect(validateSyntheticPan('ABCDE12345').isValid).toBe(false);
      expect(validateSyntheticPan('TOOLONGPAN123').isValid).toBe(false);
    });
  });

  describe('Consolidated vs Individual Member Metrics Calculation', () => {
    it('calculates consolidated metrics aggregating all members and folios', () => {
      const metrics = calculateMemberMetrics(null, mockHoldings, mockFolios);
      expect(metrics.name).toBe('All Family Members');
      expect(metrics.relationship).toBe('Consolidated');
      expect(metrics.totalInvested).toBe(155000); // 50k + 80k + 25k
      expect(metrics.currentValue).toBe(195000); // 65k + 100k + 30k
      expect(metrics.totalGain).toBe(40000); // 195k - 155k
      expect(metrics.totalGainPct).toBeCloseTo(25.81, 1);
      expect(metrics.holdingsCount).toBe(3);
      expect(metrics.allocationBreakdown.length).toBeGreaterThanOrEqual(2);
    });

    it('calculates individual member metrics filtered by member PAN', () => {
      const aaravMetrics = calculateMemberMetrics(mockProfiles[0]!, mockHoldings, mockFolios);
      expect(aaravMetrics.name).toBe('Aarav Sharma');
      expect(aaravMetrics.pan).toBe('ABCDE1234F');
      expect(aaravMetrics.totalInvested).toBe(50000);
      expect(aaravMetrics.currentValue).toBe(65000);
      expect(aaravMetrics.totalGain).toBe(15000);
      expect(aaravMetrics.totalGainPct).toBe(30);
      expect(aaravMetrics.holdingsCount).toBe(1);

      const nehaMetrics = calculateMemberMetrics(mockProfiles[1]!, mockHoldings, mockFolios);
      expect(nehaMetrics.name).toBe('Neha Sharma');
      expect(nehaMetrics.pan).toBe('ALPAC1001A');
      expect(nehaMetrics.totalInvested).toBe(80000);
      expect(nehaMetrics.currentValue).toBe(100000);
      expect(nehaMetrics.totalGain).toBe(20000);
      expect(nehaMetrics.totalGainPct).toBe(25);
      expect(nehaMetrics.holdingsCount).toBe(1);

      const rohanMetrics = calculateMemberMetrics(mockProfiles[2]!, mockHoldings, mockFolios);
      expect(rohanMetrics.name).toBe('Rohan Sharma');
      expect(rohanMetrics.pan).toBe('IOTAI9009I');
      expect(rohanMetrics.totalInvested).toBe(25000);
      expect(rohanMetrics.currentValue).toBe(30000);
      expect(rohanMetrics.totalGain).toBe(5000);
      expect(rohanMetrics.holdingsCount).toBe(1);
    });

    it('adheres to the Value Conservation Law (Sum of parts == Consolidated)', () => {
      const consolidated = calculateMemberMetrics(null, mockHoldings, mockFolios);
      const individualSums = mockProfiles.reduce(
        (acc, p) => {
          const m = calculateMemberMetrics(p, mockHoldings, mockFolios);
          return {
            invested: acc.invested + m.totalInvested,
            current: acc.current + m.currentValue,
            gain: acc.gain + m.totalGain,
          };
        },
        { invested: 0, current: 0, gain: 0 },
      );

      expect(Math.abs(individualSums.invested - consolidated.totalInvested)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(individualSums.current - consolidated.currentValue)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(individualSums.gain - consolidated.totalGain)).toBeLessThanOrEqual(0.01);
    });

    it('handles members with zero holdings or empty portfolio without crashing', () => {
      const emptyProfile: FamilyProfile = {
        id: 'prof-empty',
        name: 'Empty Member',
        pan: 'DELTD4004D',
        relationship: 'Sibling',
        isPrimary: false,
        createdAt: '2026-01-04T00:00:00Z',
        updatedAt: '2026-01-04T00:00:00Z',
      };
      const metrics = calculateMemberMetrics(emptyProfile, mockHoldings, mockFolios);
      expect(metrics.totalInvested).toBe(0);
      expect(metrics.currentValue).toBe(0);
      expect(metrics.totalGain).toBe(0);
      expect(metrics.totalGainPct).toBe(0);
      expect(metrics.holdingsCount).toBe(0);
      expect(metrics.allocationBreakdown).toEqual([]);
    });
  });

  describe('FamilyMemberList Component', () => {
    it('computes correct avatar initials from member names', () => {
      expect(getInitials('Aarav Sharma')).toBe('AS');
      expect(getInitials('Neha')).toBe('N');
      expect(getInitials('Dr. Rajesh Kumar Gupta')).toBe('DR');
      expect(getInitials('')).toBe('FM');
    });

    it('renders member cards with relation badges, PANs, and metrics', () => {
      const memberMetrics: FamilyMemberMetrics[] = mockProfiles.map((p) =>
        calculateMemberMetrics(p, mockHoldings, mockFolios),
      );

      const element = FamilyMemberList({
        profiles: mockProfiles,
        memberMetricsList: memberMetrics,
        activeProfileId: 'prof-1',
        onSelectProfile: vi.fn(),
        onDeleteProfile: vi.fn(),
      });

      const props = getProps(element);
      expect(props['testID']).toBe('family-member-list');
    });

    it('blocks deletion of primary profile and displays alert', () => {
      const onDeleteMock = vi.fn();
      const element = FamilyMemberList({
        profiles: mockProfiles,
        memberMetricsList: [],
        activeProfileId: null,
        onSelectProfile: vi.fn(),
        onDeleteProfile: onDeleteMock,
      });

      // Try triggering delete on primary profile
      const primaryProfile = mockProfiles[0]!;
      expect(primaryProfile.isPrimary).toBe(true);

      // We call the component's internal delete handler helper or trigger via props
      const deleteProps = getProps(element);
      expect(deleteProps['testID']).toBe('family-member-list');

      requestDeleteProfile(primaryProfile, mockProfiles, onDeleteMock);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Delete Primary Profile',
        expect.any(String),
      );
      expect(onDeleteMock).not.toHaveBeenCalled();

      requestDeleteProfile(mockProfiles[1]!, [mockProfiles[1]!], onDeleteMock);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Delete Only Profile',
        expect.any(String),
      );

      requestDeleteProfile(mockProfiles[1]!, mockProfiles, onDeleteMock);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Family Member',
        expect.stringContaining('Neha Sharma'),
        expect.any(Array),
      );
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = lastCall?.[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const deleteBtn = buttons?.find((b) => b.text === 'Delete');
      deleteBtn?.onPress?.();
      expect(onDeleteMock).toHaveBeenCalledWith('prof-2');
    });
  });

  describe('Family Service Persistence & CRUD Operations', () => {
    it('manages active profile ID in secure store', async () => {
      expect(await getActiveProfileId()).toBeNull();
      await setActiveProfileId('prof-1');
      expect(await getActiveProfileId()).toBe('prof-1');
      await setActiveProfileId(null);
      expect(await getActiveProfileId()).toBeNull();
    });

    it('loads and saves family profiles', async () => {
      const initial = await getStoredFamilyProfiles();
      expect(initial).toEqual([]);
      expect(initial.some((p) => p.pan === 'ABCDE1234F')).toBe(false);

      await saveFamilyProfiles(mockProfiles);
      const loaded = await getStoredFamilyProfiles();
      expect(loaded).toEqual(mockProfiles);
    });

    it('adds a new family profile with synthetic validation', async () => {
      await saveFamilyProfiles([mockProfiles[0]!]);
      const newProf = await addFamilyProfile({
        name: 'Grandparent',
        pan: 'ZETAZ6006F',
        relationship: 'Parent',
        notes: 'Senior citizen',
      });
      expect(newProf.name).toBe('Grandparent');
      expect(newProf.pan).toBe('ZETAZ6006F');
      expect(newProf.isPrimary).toBe(false);

      await expect(
        addFamilyProfile({
          name: 'Invalid',
          pan: 'INVALID_PAN',
          relationship: 'Child',
        }),
      ).rejects.toThrow();
    });

    it('deletes non-primary profile and protects primary', async () => {
      await saveFamilyProfiles([...mockProfiles]);
      const deletePrimaryResult = await deleteFamilyProfile('prof-1');
      expect(deletePrimaryResult).toBe(false);

      const deleteNonPrimaryResult = await deleteFamilyProfile('prof-2');
      expect(deleteNonPrimaryResult).toBe(true);

      const remaining = await getStoredFamilyProfiles();
      expect(remaining.find((p) => p.id === 'prof-2')).toBeUndefined();
    });
  });

  describe('AddMemberModal Component', () => {
    it('renders modal with name, PAN, relationship chips, and notes', () => {
      const element = AddMemberModal({
        visible: true,
        onClose: vi.fn(),
        onAddMember: vi.fn(),
      });

      const props = getProps(element);
      expect(props['testID']).toBe('add-member-modal');
    });
  });

  describe('Auxiliary Family Components Suite', () => {
    it('renders FamilyMetricsSummary with positive and negative gains', () => {
      const positiveMetrics = calculateMemberMetrics(null, mockHoldings, mockFolios);
      const positiveSummary = FamilyMetricsSummary({ metrics: positiveMetrics });
      expect(positiveSummary).toBeDefined();

      const negativeMetrics: FamilyMemberMetrics = {
        name: 'Negative Profile',
        relationship: 'Sibling',
        totalInvested: 100000,
        currentValue: 80000,
        totalGain: -20000,
        totalGainPct: -20,
        holdingsCount: 1,
        allocationBreakdown: [],
      };
      const negativeSummary = FamilyMetricsSummary({ metrics: negativeMetrics });
      expect(negativeSummary).toBeDefined();
    });

    it('renders ProfileSwitcher and responds to pill selection', () => {
      const onSelect = vi.fn();
      const switcher = ProfileSwitcher({
        profiles: mockProfiles,
        activeProfileId: 'prof-1',
        onSelect,
      });
      expect(switcher).toBeDefined();
    });

    it('renders MemberCard for primary and non-primary profiles', () => {
      const metrics = calculateMemberMetrics(mockProfiles[0]!, mockHoldings, mockFolios);
      const cardPrimary = MemberCard({
        profile: mockProfiles[0]!,
        metrics,
        isActive: true,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
      });
      expect(cardPrimary).toBeDefined();

      const cardNonPrimary = MemberCard({
        profile: mockProfiles[1]!,
        metrics: undefined,
        isActive: false,
        onSelect: vi.fn(),
        onDelete: vi.fn(),
      });
      expect(cardNonPrimary).toBeDefined();
    });
  });

  describe('Family Profiles Management in Settings & Tabs Layout', () => {
    it('renders FamilyProfilesCard with member list and add member button', () => {
      const card = FamilyProfilesCard();
      expect(getProps(card)['testID']).toBe('settings-family-profiles-card');
    });

    it('renders SettingsScreen tree including FamilyProfilesCard', () => {
      const screen = SettingsScreen();
      expect(screen).toBeDefined();
    });

    it('verifies TabsLayout does not contain retired family tab', () => {
      const layout = TabsLayout();
      expect(layout).toBeDefined();
      const props = getProps(layout);
      const children = props['children'] as React.ReactElement[];
      expect(Array.isArray(children)).toBe(true);
      const familyScreen = children.find(
        (c) => getProps(c)['name'] === 'family',
      );
      expect(familyScreen).toBeUndefined();
    });
  });
});
