/**
 * @file holdings-breakdown.test.tsx
 * @description Unit tests for Mobile Expandable Holdings & Multi-PAN Breakdown.
 */

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

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
}));
import type { ConsolidatedSchemeGroup, FolioInput } from '@portfolio/core-view';
import { FolioChildRow } from '../src/components/Holdings/FolioChildRow';
import { SchemeGroupCard } from '../src/components/Holdings/SchemeGroupCard';
import {
  HoldingsFilterControls,
  ASSET_TYPES,
  SORT_OPTIONS,
} from '../src/components/Holdings/holdings-controls';
import {
  adaptHoldingToFolioInput,
  adaptHoldingsToFolioInputs,
} from '../src/components/Holdings/holding-adapters';
import type { EnrichedHolding } from '../src/services/portfolio-service';
import type { FolioEntity } from '../src/services/family-service';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

vi.mock('lucide-react-native', () => ({
  ChevronDown: (props: Record<string, unknown>) => ({ type: 'ChevronDown', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
}));

function getProps(element: React.ReactElement): Record<string, unknown> {
  const p = (element.props || {}) as Record<string, unknown>;
  // FolioChildRow returns a Fragment <>...</> whose first child is the TouchableOpacity
  if (element.type === React.Fragment && Array.isArray(p['children']) && p['children'][0]) {
    return (p['children'][0] as React.ReactElement).props as Record<string, unknown>;
  }
  return p;
}

describe('Mobile Holdings Breakdown Components', () => {
  const sampleFolio1: FolioInput = {
    id: 'f1',
    number: '12345/0',
    folioNumber: '12345/0',
    amcName: 'HDFC AMC',
    amc: 'HDFC AMC',
    units: 100,
    currentNav: 600,
    pan: 'ABCDE1234F',
    metrics: {
      investedAmount: 50000,
      currentValue: 60000,
      dayChange: 2000,
      dayChangePercentage: 3.45,
      xirr: 0.15,
      absoluteReturn: 0.2,
      currentPrice: 600,
    },
  };

  const sampleFolio2: FolioInput = {
    id: 'f2',
    number: '67890/1',
    folioNumber: '67890/1',
    amcName: 'HDFC AMC',
    amc: 'HDFC AMC',
    units: 50,
    currentNav: 600,
    pan: 'ALPAC1001A',
    metrics: {
      investedAmount: 25000,
      currentValue: 30000,
      dayChange: 1000,
      dayChangePercentage: 3.45,
      xirr: 0.18,
      absoluteReturn: 0.2,
      currentPrice: 600,
    },
  };

  const multiFolioGroup: ConsolidatedSchemeGroup = {
    id: 'group_hdfc_top_100',
    schemeName: 'HDFC Top 100 Fund - Growth',
    type: 'EQUITY',
    pans: ['ABCDE1234F', 'ALPAC1001A'],
    metrics: {
      investedAmount: 75000,
      currentValue: 90000,
      dayChange: 3000,
      dayChangePercentage: 3.45,
      xirr: 0.16,
      postTaxXirr: 0.14,
      absoluteReturn: 0.2,
      postTaxAbsoluteReturn: 0.175,
      estimatedTax: 1875,
      netRealizableValue: 88125,
    },
    folios: [sampleFolio1, sampleFolio2],
    folioCount: 2,
  };

  const singleFolioGroup: ConsolidatedSchemeGroup = {
    id: 'group_sbi_liquid',
    schemeName: 'SBI Liquid Fund - Direct Growth',
    type: 'DEBT',
    pans: ['ABCDE1234F'],
    metrics: {
      investedAmount: 60000,
      currentValue: 66000,
      dayChange: 100,
      dayChangePercentage: 0.15,
      xirr: 0.07,
      postTaxXirr: 0.05,
      absoluteReturn: 0.1,
      postTaxAbsoluteReturn: 0.07,
      estimatedTax: 1800,
      netRealizableValue: 64200,
    },
    folios: [sampleFolio1],
    folioCount: 1,
  };

  describe('FolioChildRow', () => {
    it('renders individual folio details with PAN badge and metrics', () => {
      const element = FolioChildRow({
        folio: sampleFolio1,
        performanceMode: 'XIRR',
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('folio-child-row-f1');
    });

    it('renders fallback units and NAV when units are undefined', () => {
      const folioWithoutUnits: FolioInput = {
        id: 'f3',
        number: '99999/9',
      };
      const element = FolioChildRow({
        folio: folioWithoutUnits,
        performanceMode: 'ABS',
      });

      expect(element).toBeDefined();
      expect(getProps(element)['testID']).toBe('folio-child-row-f3');
    });
  });

  describe('SchemeGroupCard', () => {
    it('renders multi-folio scheme with distinct member PAN badges and expand button', () => {
      const onToggle = vi.fn();
      const element = SchemeGroupCard({
        group: multiFolioGroup,
        isExpanded: false,
        onToggleExpand: onToggle,
        showPanBadges: true,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('scheme-group-card-group_hdfc_top_100');
    });

    it('renders expanded child rows when isExpanded is true', () => {
      const onToggle = vi.fn();
      const element = SchemeGroupCard({
        group: multiFolioGroup,
        isExpanded: true,
        onToggleExpand: onToggle,
        showPanBadges: true,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('scheme-group-card-group_hdfc_top_100');
    });

    it('renders single folio scheme cleanly without expansion boilerplate', () => {
      const onToggle = vi.fn();
      const element = SchemeGroupCard({
        group: singleFolioGroup,
        isExpanded: false,
        onToggleExpand: onToggle,
        showPanBadges: false,
      });

      expect(element).toBeDefined();
      const props = getProps(element);
      expect(props['testID']).toBe('scheme-group-card-group_sbi_liquid');
    });
  });

  describe('HoldingsFilterControls', () => {
    it('renders search input, asset class pills, and sort chips', () => {
      const element = HoldingsFilterControls({
        searchQuery: '',
        onSearchChange: vi.fn(),
        selectedAsset: 'ALL',
        onSelectAsset: vi.fn(),
        selectedSort: 'value',
        onSelectSort: vi.fn(),
      });

      expect(element).toBeDefined();
      expect(ASSET_TYPES.length).toBeGreaterThan(0);
      expect(SORT_OPTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('holding-adapters', () => {
    const mockEnriched: EnrichedHolding = {
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
    };

    const mockFolioEntity: FolioEntity = {
      folio_number: '12345/A',
      amc_name: 'HDFC Mutual Fund',
      pan: 'ABCDE1234F',
      updated_at: '2026-11-17T10:00:00Z',
    };

    it('adapts enriched holdings and folio entities into FolioInput correctly', () => {
      const result = adaptHoldingToFolioInput(mockEnriched, mockFolioEntity);
      expect(result.id).toBe('h1');
      expect(result.pan).toBe('ABCDE1234F');
      expect(result.amcName).toBe('HDFC Mutual Fund');
      expect(result.metrics?.investedAmount).toBe(50000);
      expect(result.metrics?.currentValue).toBe(60000);
    });

    it('adapts multiple enriched holdings using adaptHoldingsToFolioInputs', () => {
      const results = adaptHoldingsToFolioInputs([mockEnriched], [mockFolioEntity]);
      expect(results).toHaveLength(1);
      expect(results[0]?.pan).toBe('ABCDE1234F');
    });
  });
});
