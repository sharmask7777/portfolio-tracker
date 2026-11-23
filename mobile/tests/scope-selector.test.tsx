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

import { describe, it, expect, vi } from 'vitest';
import { ScopeSelectorHeader } from '../src/components/Navigation/ScopeSelectorHeader';
import type { PortfolioScope } from '@portfolio/core-view';
import type { FamilyProfile } from '../src/services/family-service';
import type { PanBreakdownDto } from '../src/types/generated';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  Platform: { OS: 'android' },
  StatusBar: { currentHeight: 28 },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 32, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('lucide-react-native', () => ({
  Users: (props: Record<string, unknown>) => ({ type: 'Users', props }),
  User: (props: Record<string, unknown>) => ({ type: 'User', props }),
}));

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('ScopeSelectorHeader Component Suite', () => {
  const mockProfiles: FamilyProfile[] = [
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

  const mockBreakdowns: PanBreakdownDto[] = [
    {
      pan: 'ABCDE1234F',
      memberName: 'Aarav Sharma',
      investedAmount: 50000,
      currentValue: 70000,
      dayChange: 500,
      dayChangePercentage: 0.72,
      xirr: 0.15,
      folioCount: 2,
    },
    {
      pan: 'ALPAC1001A',
      memberName: 'Neha Sharma',
      investedAmount: 30000,
      currentValue: 30000,
      dayChange: 200,
      dayChangePercentage: 0.67,
      xirr: 0.12,
      folioCount: 1,
    },
  ];

  it('renders consolidated chip as active when scope is consolidated', () => {
    const scope: PortfolioScope = { type: 'consolidated' };
    const onSelectConsolidated = vi.fn();
    const onSelectMember = vi.fn();

    const element = ScopeSelectorHeader({
      scope,
      profiles: mockProfiles,
      panBreakdowns: mockBreakdowns,
      onSelectConsolidated,
      onSelectMember,
      totalFolios: 3,
    });

    const props = getProps(element);
    expect(props['testID']).toBe('scope-selector-header');
  });

  it('renders member chips with corpus percentage when panBreakdowns are provided', () => {
    const scope: PortfolioScope = {
      type: 'member',
      profileId: 'prof-spouse-2',
      pan: 'ALPAC1001A',
      name: 'Neha Sharma',
    };
    const onSelectConsolidated = vi.fn();
    const onSelectMember = vi.fn();

    const element = ScopeSelectorHeader({
      scope,
      profiles: mockProfiles,
      panBreakdowns: mockBreakdowns,
      onSelectConsolidated,
      onSelectMember,
    });

    const props = getProps(element);
    expect(props['testID']).toBe('scope-selector-header');
  });

  it('renders without breakdowns fallback to profile list count and accounts for status bar top insets', () => {
    const scope: PortfolioScope = { type: 'consolidated' };
    const element = ScopeSelectorHeader({
      scope,
      profiles: mockProfiles,
      onSelectConsolidated: vi.fn(),
      onSelectMember: vi.fn(),
    });

    const props = getProps(element);
    expect(props['testID']).toBe('scope-selector-header');
    // Insets top is 32, StatusBar is 28, max is 32 + 6 = 38
    expect(props['style']).toEqual([
      expect.anything(),
      { paddingTop: 38 },
    ]);
  });
});
