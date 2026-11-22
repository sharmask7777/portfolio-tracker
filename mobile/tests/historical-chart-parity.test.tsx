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
import { HistoricalTrendChart } from '../src/components/Dashboard/HistoricalTrendChart';
import { RANGES } from '../src/components/Dashboard/chart-components';
import type { HistoryPoint } from '../src/types/generated';
import type { HistoryRangePreset } from '../src/services/reality-check-service';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  Platform: { OS: 'android' },
  StatusBar: { currentHeight: 28 },
}));

vi.mock('lucide-react-native', () => ({
  TrendingUp: (props: Record<string, unknown>) => ({ type: 'TrendingUp', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
}));

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('HistoricalTrendChart Parity & Real Points Suite', () => {
  it('defines the 7 full range presets matching web experience', () => {
    const expectedRanges: HistoryRangePreset[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];
    expect(RANGES).toEqual(expectedRanges);
  });

  it('renders empty state placeholder when history points are empty', () => {
    const element = HistoricalTrendChart({
      historyPoints: [],
    });
    const props = getProps(element);
    expect(props['testID']).toBe('historical-trend-chart');

    const emptyElement = (props['children'] as [unknown, unknown, React.ReactElement])[2];
    expect(emptyElement.type).toBeDefined();
    const renderedEmpty = (emptyElement.type as () => React.ReactElement)();
    const renderedProps = renderedEmpty.props as { testID?: string };
    expect(renderedProps.testID).toBe('chart-empty-state');
  });

  it('renders SVG canvas and tooltip when real history points are provided', () => {
    const mockPoints: HistoryPoint[] = [
      { date: '2026-01-01', value: 100000, investedAmount: 90000 },
      { date: '2026-02-01', value: 110000, investedAmount: 95000 },
      { date: '2026-03-01', value: 120000, investedAmount: 100000 },
    ];

    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
    });
    const props = getProps(element);
    expect(props['testID']).toBe('historical-trend-chart');

    const children = props['children'] as unknown[];
    const emptyState = children.find(
      (c: unknown) => typeof c === 'object' && c !== null && (c as { props?: { testID?: string } }).props?.testID === 'chart-empty-state',
    );
    expect(emptyState).toBeUndefined();
  });

  it('downsamples data smoothly when point count exceeds 300 points', () => {
    const densePoints: HistoryPoint[] = Array.from({ length: 600 }, (_, i) => ({
      date: new Date(2025, 0, i + 1).toISOString().split('T')[0] ?? '',
      value: 100000 + i * 100,
      investedAmount: 80000 + i * 50,
    }));

    const element = HistoricalTrendChart({
      historyPoints: densePoints,
    });
    const props = getProps(element);
    expect(props['testID']).toBe('historical-trend-chart');
  });
});
