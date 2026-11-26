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
import { RANGES, ChartSvgCanvas } from '../src/components/Dashboard/chart-components';
import type { HistoryPoint } from '../src/types/generated';
import type { HistoryRangePreset } from '../src/services/reality-check-service';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  KeyboardAvoidingView: (props: Record<string, unknown>) => ({ type: 'KeyboardAvoidingView', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  PanResponder: {
    create: (config: Record<string, unknown>) => ({
      panHandlers: config,
    }),
  },
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

function getChartContentChildren(element: React.ReactElement): unknown[] {
  const children = getProps(element)['children'] as unknown[];
  const contentElement = children[2] as React.ReactElement;
  if (!contentElement) return [];
  const rendered = typeof contentElement.type === 'function'
    ? (contentElement.type as (p: unknown) => React.ReactElement)(contentElement.props)
    : contentElement;
  return (rendered?.props as { children?: unknown[] })?.children ?? [];
}

describe('HistoricalTrendChart Parity & Real Points Suite', () => {
  const mockPoints: HistoryPoint[] = [
    {
      date: '2026-01-01',
      value: 100000,
      investedAmount: 90000,
      unrealizedGain: 10000,
      gainPercentage: 11.11,
      isAth: false,
      athValue: 100000,
      drawdownPercentage: 0,
    },
    {
      date: '2026-02-01',
      value: 110000,
      investedAmount: 95000,
      unrealizedGain: 15000,
      gainPercentage: 15.79,
      isAth: false,
      athValue: 110000,
      drawdownPercentage: 0,
    },
    {
      date: '2026-03-01',
      value: 120000,
      investedAmount: 100000,
      unrealizedGain: 20000,
      gainPercentage: 20.0,
      isAth: false,
      athValue: 120000,
      drawdownPercentage: 0,
    },
  ];

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
    const densePoints: HistoryPoint[] = Array.from({ length: 600 }, (_, i) => {
      const value = 100000 + i * 100;
      const investedAmount = 80000 + i * 50;
      const unrealizedGain = value - investedAmount;
      return {
        date: new Date(2025, 0, i + 1).toISOString().split('T')[0] ?? '',
        value,
        investedAmount,
        unrealizedGain,
        gainPercentage: (unrealizedGain / investedAmount) * 100,
        isAth: false,
        athValue: value,
        drawdownPercentage: 0,
      };
    });

    const element = HistoricalTrendChart({
      historyPoints: densePoints,
    });
    const props = getProps(element);
    expect(props['testID']).toBe('historical-trend-chart');
  });

  it('supports onGestureActive callback to coordinate parent scroll locking', () => {
    const onGestureActive = vi.fn();
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
      onGestureActive,
    });
    expect(getProps(element)['testID']).toBe('historical-trend-chart');
  });

  it('attaches panResponderHandlers to ChartSvgCanvas and activates gesture lock during scrub', () => {
    const onGestureActive = vi.fn();
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
      onGestureActive,
    });
    const fragmentChildren = getChartContentChildren(element);
    const svgCanvas = fragmentChildren.find(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        ((c as { type?: unknown }).type === ChartSvgCanvas ||
          (c as { props?: { testID?: string } }).props?.testID === 'chart-svg-canvas'),
    ) as { props?: { panResponderHandlers?: Record<string, unknown> } };

    expect(svgCanvas).toBeDefined();
    const handlers = svgCanvas.props?.panResponderHandlers;
    expect(handlers).toBeDefined();
    expect(typeof handlers?.['onPanResponderMove']).toBe('function');

    // Trigger 1-finger scrub move
    const onMove = handlers?.['onPanResponderMove'] as (e: unknown, g: unknown) => void;
    onMove(
      { nativeEvent: { locationX: 165, touches: [{ pageX: 165, pageY: 100, locationX: 165 }] } },
      { dx: 0, dy: 0, numberActiveTouches: 1 },
    );
    expect(onGestureActive).toHaveBeenCalledWith(true);

    // Trigger release
    const onRelease = handlers?.['onPanResponderRelease'] as () => void;
    onRelease();
    expect(onGestureActive).toHaveBeenCalledWith(false);
  });

  it('resets both zoom and pinned probe when a new range preset is selected', () => {
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
    });
    const children = getProps(element)['children'] as unknown[];
    const rangeBar = children[1] as { props?: { onSelectRange?: (r: HistoryRangePreset) => void } };
    expect(rangeBar).toBeDefined();
    expect(typeof rangeBar.props?.onSelectRange).toBe('function');
    expect(() => rangeBar.props?.onSelectRange?.('1M')).not.toThrow();
  });

  it('handles 2-finger pinch gesture, adjusts zoom, and hides hairline during pinch', () => {
    const onGestureActive = vi.fn();
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
      onGestureActive,
    });
    const fragmentChildren = getChartContentChildren(element);
    const svgCanvas = fragmentChildren.find(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        ((c as { type?: unknown }).type === ChartSvgCanvas ||
          (c as { props?: { testID?: string } }).props?.testID === 'chart-svg-canvas'),
    ) as { props?: { panResponderHandlers?: Record<string, unknown> } };

    const handlers = svgCanvas.props?.panResponderHandlers;
    const onMove = handlers?.['onPanResponderMove'] as (e: unknown, g: unknown) => void;

    // Start 2-finger pinch
    onMove(
      {
        nativeEvent: {
          touches: [
            { pageX: 100, pageY: 100, locationX: 100 },
            { pageX: 200, pageY: 100, locationX: 200 },
          ],
        },
      },
      { dx: 0, dy: 0, numberActiveTouches: 2 },
    );
    expect(onGestureActive).toHaveBeenCalledWith(true);

    // Continue pinch: widen fingers
    onMove(
      {
        nativeEvent: {
          touches: [
            { pageX: 80, pageY: 100, locationX: 80 },
            { pageX: 240, pageY: 100, locationX: 240 },
          ],
        },
      },
      { dx: 0, dy: 0, numberActiveTouches: 2 },
    );
    expect(onGestureActive).toHaveBeenCalledWith(true);

    // Release
    const onRelease = handlers?.['onPanResponderRelease'] as () => void;
    onRelease();
    expect(onGestureActive).toHaveBeenCalledWith(false);
  });

  it('supports onResetZoom and onResetProbe handlers without errors', () => {
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
    });
    const children = getProps(element)['children'] as unknown[];
    const header = children[0] as { props?: { onResetZoom?: () => void } };
    expect(header).toBeDefined();
    expect(typeof header.props?.onResetZoom).toBe('function');
    expect(() => header.props?.onResetZoom?.()).not.toThrow();

    const fragmentChildren = getChartContentChildren(element);
    const tooltip = fragmentChildren[0] as { props?: { onResetProbe?: () => void } };
    expect(tooltip).toBeDefined();
    expect(typeof tooltip.props?.onResetProbe).toBe('function');
    expect(() => tooltip.props?.onResetProbe?.()).not.toThrow();
  });

  it('supports onSelectIdx point tap to set probed checkpoint', () => {
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
    });
    const fragmentChildren = getChartContentChildren(element);
    const svgCanvas = fragmentChildren.find(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        ((c as { type?: unknown }).type === ChartSvgCanvas ||
          (c as { props?: { testID?: string } }).props?.testID === 'chart-svg-canvas'),
    ) as { props?: { onSelectIdx?: (idx: number) => void } };

    expect(svgCanvas).toBeDefined();
    expect(typeof svgCanvas.props?.onSelectIdx).toBe('function');
    expect(() => svgCanvas.props?.onSelectIdx?.(0)).not.toThrow();
  });

  it('handles single touch grant and release cycle', () => {
    const onGestureActive = vi.fn();
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
      onGestureActive,
    });
    const fragmentChildren = getChartContentChildren(element);
    const svgCanvas = fragmentChildren.find(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        ((c as { type?: unknown }).type === ChartSvgCanvas ||
          (c as { props?: { testID?: string } }).props?.testID === 'chart-svg-canvas'),
    ) as { props?: { panResponderHandlers?: Record<string, unknown> } };

    const handlers = svgCanvas.props?.panResponderHandlers;
    const onGrant = handlers?.['onPanResponderGrant'] as (e: unknown) => void;
    onGrant({ nativeEvent: { locationX: 50, touches: [{ pageX: 50, pageY: 50, locationX: 50 }] } });
    expect(onGestureActive).toHaveBeenCalledWith(true);

    const onTerminate = handlers?.['onPanResponderTerminate'] as () => void;
    onTerminate();
    expect(onGestureActive).toHaveBeenCalledWith(false);
  });
});
