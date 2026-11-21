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
  saveFamilyProfiles,
  getStoredFamilyProfiles,
  deleteFamilyProfile,
  type FamilyProfile,
} from '../services/family-service';

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
  UserPlus: (props: Record<string, unknown>) => ({ type: 'UserPlus', props }),
  Trash2: (props: Record<string, unknown>) => ({ type: 'Trash2', props }),
  Check: (props: Record<string, unknown>) => ({ type: 'Check', props }),
  Plus: (props: Record<string, unknown>) => ({ type: 'Plus', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
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

const mockSyntheticFamilyHoldings: EnrichedHolding[] = [
  {
    id: 'h-fam-1',
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
];

vi.mock('../../src/services/portfolio-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/portfolio-service')>();
  return {
    ...actual,
    getEnrichedHoldings: vi.fn(async () => mockSyntheticFamilyHoldings),
  };
});

vi.mock('../services/family-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/family-service')>();
  return {
    ...actual,
    getStoredFolios: vi.fn(async () => []),
  };
});

import SettingsScreen from '../../app/(tabs)/settings';
import DashboardScreen from '../../app/(tabs)/index';

describe('Maestro Flow 06: Family Profiles Management & Global Scope Simulation', () => {
  const initialProfiles: FamilyProfile[] = [
    {
      id: 'prof-primary-1',
      name: 'Aarav Sharma',
      pan: 'ABCDE1234F',
      relationship: 'Self',
      isPrimary: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'prof-spouse-2',
      name: 'Neha Sharma',
      pan: 'ALPAC1001A',
      relationship: 'Spouse',
      isPrimary: false,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetHookState();
    setupReactHookDispatcher();

    // Seed mock initial family profiles
    await saveFamilyProfiles(initialProfiles);
  });

  it('validates global top-level scope selector switching on dashboard', async () => {
    render(() => <DashboardScreen />);

    // 1. Verify ScopeSelectorHeader chips
    await waitFor(() => {
      expect(screen.getByTestId('scope-selector-header')).toBeDefined();
      expect(screen.getByText('Consolidated')).toBeDefined();
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
      expect(screen.getByText('Neha Sharma')).toBeDefined();
    });

    // 2. Select Neha Sharma chip to switch to individual profile
    const nehaChip = screen.getByText('Neha Sharma');
    fireEvent.press(nehaChip);

    // 3. Switch back to consolidated view
    const consolidatedChip = screen.getByText('Consolidated');
    fireEvent.press(consolidatedChip);
  });

  it('validates family profile management in Settings with synthetic PAN validation', async () => {
    render(() => <SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-family-profiles-card')).toBeDefined();
      expect(screen.getByText('Family Profiles (2)')).toBeDefined();
      expect(screen.getByTestId('family-member-list')).toBeDefined();
      expect(screen.getByText('Aarav Sharma')).toBeDefined();
      expect(screen.getByText('Neha Sharma')).toBeDefined();
    });

    // 1. Open Add Member Modal from Settings
    const addMemberBtn = screen.getByTestId('settings-add-member-btn');
    fireEvent.press(addMemberBtn);

    await waitFor(() => {
      expect(screen.getByTestId('add-member-modal')).toBeDefined();
      expect(screen.getByText('Full Name')).toBeDefined();
      expect(screen.getByText('Permanent Account Number (PAN)')).toBeDefined();
    });

    // 2. Validate synthetic PAN failure with invalid pattern
    const nameInput = screen.getByTestId('add-member-name-input');
    fireEvent.changeText(nameInput, 'Rohan Sharma');

    const panInput = screen.getByTestId('add-member-pan-input');
    fireEvent.changeText(panInput, 'INVALID999');

    const submitBtn = screen.getByTestId('submit-add-member-btn');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid PAN format. Must be 5 letters, 4 numbers, and 1 letter')).toBeDefined();
    });

    // 3. Enter valid synthetic PAN format and submit
    const validPanInput = screen.getByTestId('add-member-pan-input');
    fireEvent.changeText(validPanInput, 'BLPAC2002B');
    const validSubmitBtn = screen.getByTestId('submit-add-member-btn');
    fireEvent.press(validSubmitBtn);

    // 4. Verify modal closes
    await waitFor(() => {
      expect(screen.getByTestId('add-member-modal').props['visible']).toBe(false);
    });
  });

  it('validates deletion safeguards for primary vs secondary family members', async () => {
    // 1. Primary member cannot be deleted
    const canDeletePrimary = await deleteFamilyProfile('prof-primary-1');
    expect(canDeletePrimary).toBe(false);

    // 2. Secondary member can be safely deleted
    const canDeleteSpouse = await deleteFamilyProfile('prof-spouse-2');
    expect(canDeleteSpouse).toBe(true);

    const remaining = await getStoredFamilyProfiles();
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.id).toBe('prof-primary-1');

    // 3. Cannot delete the last remaining profile
    const canDeleteLast = await deleteFamilyProfile('prof-primary-1');
    expect(canDeleteLast).toBe(false);
  });
});
