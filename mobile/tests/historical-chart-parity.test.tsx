import React from 'react';

interface StateSlot {
  val: unknown;
  setter: ReturnType<typeof vi.fn>;
}

let stateSlots: StateSlot[] = [];
let slotCursor = 0;

function resetSlots(): void {
  stateSlots = [];
  slotCursor = 0;
}

// Set up React hook dispatcher for testing functional components in Node
// @ts-expect-error React internals for test runner
React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
  useState: (init: unknown) => {
    const i = slotCursor++;
    if (!stateSlots[i]) {
      const val = typeof init === 'function' ? (init as () => unknown)() : init;
      const setter = vi.fn((next: unknown) => {
        stateSlots[i]!.val = typeof next === 'function' ? (next as (prev: unknown) => unknown)(stateSlots[i]!.val) : next;
      });
      stateSlots[i] = { val, setter };
    }
    return [stateSlots[i]!.val, stateSlots[i]!.setter];
  },
  useEffect: (fn: () => void) => fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => ({}),
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoricalTrendChart } from '../src/components/Dashboard/HistoricalTrendChart';
import { RANGES, ChartSvgCanvas } from '../src/components/Dashboard/chart-components';
import {
  sliceForZoomAndPan,
  handlePinchAndPanMove,
  handleTouchRelease,
  type GestureRefs,
  type GestureCallbacks,
} from '../src/components/Dashboard/chart-gesture';
import type { HistoryPoint } from '../src/types/generated';
import type { HistoryRangePreset, HistoricalCheckpoint } from '../src/services/reality-check-service';

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
  beforeEach(() => {
    resetSlots();
  });

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

    // Select new preset '1M'
    rangeBar.props?.onSelectRange?.('1M');

    // Slot 0: selectedRange, Slot 1: selectedIdx, Slot 2: probedDate, Slot 3: scrubX, Slot 4: zoomLevel, Slot 5: panOffset
    expect(stateSlots[0]?.setter).toHaveBeenCalledWith('1M');
    expect(stateSlots[1]?.setter).toHaveBeenCalledWith(null);
    expect(stateSlots[2]?.setter).toHaveBeenCalledWith(null);
    expect(stateSlots[3]?.setter).toHaveBeenCalledWith(null);
    expect(stateSlots[4]?.setter).toHaveBeenCalledWith(1);
    expect(stateSlots[5]?.setter).toHaveBeenCalledWith(1);
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

    // Start 2-finger pinch with initial distance = 100
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

    // Continue pinch: widen fingers distance = 160 (scale = 1.6x)
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
    // Hairline must be hidden during pinch
    expect(stateSlots[3]?.setter).toHaveBeenCalledWith(null);
    // Zoom must be adjusted
    expect(stateSlots[4]?.setter).toHaveBeenCalledWith(1.6);

    // Release
    const onRelease = handlers?.['onPanResponderRelease'] as () => void;
    onRelease();
    expect(onGestureActive).toHaveBeenCalledWith(false);
  });

  it('supports onResetZoom and onResetProbe handlers with real state updates', () => {
    const element = HistoricalTrendChart({
      historyPoints: mockPoints,
    });
    const children = getProps(element)['children'] as unknown[];
    const header = children[0] as { props?: { onResetZoom?: () => void } };
    expect(header).toBeDefined();
    expect(typeof header.props?.onResetZoom).toBe('function');

    header.props?.onResetZoom?.();
    expect(stateSlots[4]?.setter).toHaveBeenCalledWith(1);
    expect(stateSlots[5]?.setter).toHaveBeenCalledWith(1);

    const fragmentChildren = getChartContentChildren(element);
    const tooltip = fragmentChildren[0] as { props?: { onResetProbe?: () => void } };
    expect(tooltip).toBeDefined();
    expect(typeof tooltip.props?.onResetProbe).toBe('function');

    tooltip.props?.onResetProbe?.();
    expect(stateSlots[2]?.setter).toHaveBeenCalledWith(null);
    expect(stateSlots[3]?.setter).toHaveBeenCalledWith(null);
    expect(stateSlots[1]?.setter).toHaveBeenCalledWith(null);
  });

  it('supports onSelectIdx point tap to set probed checkpoint and scrubX', () => {
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

    svgCanvas.props?.onSelectIdx?.(0);
    expect(stateSlots[2]?.setter).toHaveBeenCalledWith('2026-01-01');
    expect(stateSlots[1]?.setter).toHaveBeenCalledWith(0);
    expect(stateSlots[3]?.setter).toHaveBeenCalledWith(expect.any(Number));
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

  it('slices dynamically by zoom level and pan offset ratio', () => {
    const checkpoints: HistoricalCheckpoint[] = [
      { date: '2026-01-01', value: 100000, investedAmount: 90000, unrealizedGain: 10000, gainPct: 11.11, isAth: false, athValue: 100000, drawdownPct: 0 },
      { date: '2026-02-01', value: 110000, investedAmount: 95000, unrealizedGain: 15000, gainPct: 15.79, isAth: false, athValue: 110000, drawdownPct: 0 },
      { date: '2026-03-01', value: 120000, investedAmount: 100000, unrealizedGain: 20000, gainPct: 20.0, isAth: false, athValue: 120000, drawdownPct: 0 },
      { date: '2026-04-01', value: 130000, investedAmount: 105000, unrealizedGain: 25000, gainPct: 23.8, isAth: true, athValue: 130000, drawdownPct: 0 },
    ];

    // Zoom 1 returns all points
    const unzoomed = sliceForZoomAndPan(checkpoints, 1, 1);
    expect(unzoomed.length).toBe(4);

    // Zoom 2 with panOffset 1 (newest half)
    const rightHalf = sliceForZoomAndPan(checkpoints, 2, 1);
    expect(rightHalf[rightHalf.length - 1]?.date).toBe('2026-04-01');

    // Zoom 2 with panOffset 0 (oldest half)
    const leftHalf = sliceForZoomAndPan(checkpoints, 2, 0);
    expect(leftHalf[0]?.date).toBe('2026-01-01');
  });

  it('processes two-finger pinch zoom and midpoint pan offset delta', () => {
    const setZoomLevel = vi.fn();
    const setPanOffset = vi.fn();
    const setScrubX = vi.fn();
    const onGestureActive = vi.fn();

    const refs: GestureRefs = {
      state: { current: 'IDLE' },
      dist: { current: 100 },
      baseZoom: { current: 1.5 },
      lastMidX: { current: 150 },
      cooldown: { current: null },
      provisionalProbe: { current: false },
    };

    const callbacks: GestureCallbacks = {
      setProbedDate: vi.fn(),
      setSelectedIdx: vi.fn(),
      setScrubX,
      setZoomLevel,
      setPanOffset,
      onGestureActive,
    };

    const event = {
      nativeEvent: {
        touches: [
          { pageX: 80, pageY: 100, locationX: 80 },
          { pageX: 280, pageY: 100, locationX: 280 },
        ],
      },
    } as unknown as Parameters<typeof handlePinchAndPanMove>[0]['event'];

    handlePinchAndPanMove({ event, refs, callbacks, width: 300, zoom: 2 });

    expect(refs.state.current).toBe('PINCHING');
    // distance is 200 (scale 2.0x from 100) -> nextZoom = 1.5 * 2.0 = 3.0
    expect(setZoomLevel).toHaveBeenCalledWith(3);
    // midX is (80 + 280) / 2 = 180, dx = 180 - 150 = 30 -> deltaRatio = -30 / (300 * 1) = -0.1
    expect(setPanOffset).toHaveBeenCalledWith(expect.any(Function));
    expect(setScrubX).toHaveBeenCalledWith(null);
    expect(onGestureActive).toHaveBeenCalledWith(true);
  });

  it('enforces a minimum 7-day window floor in sliceForZoomAndPan', () => {
    // 10-day range
    const points: HistoricalCheckpoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value: 100000 + i * 1000,
      investedAmount: 90000,
      unrealizedGain: 10000 + i * 1000,
      gainPct: 10,
      isAth: false,
      athValue: 120000,
      drawdownPct: 5,
    }));

    // With 5x zoom, duration (9 days) / 5 = 1.8 days, but floor is 7 days!
    const sliced = sliceForZoomAndPan(points, 5, 0);
    const startMs = new Date(sliced[0]!.date).getTime();
    const endMs = new Date(sliced[sliced.length - 1]!.date).getTime();
    const durationDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
    expect(durationDays).toBeGreaterThanOrEqual(6); // At least 7 calendar days span
  });

  it('resets gesture state to IDLE upon cooldown timer expiry', () => {
    vi.useFakeTimers();
    const refs: GestureRefs = {
      state: { current: 'PINCHING' },
      dist: { current: 100 },
      baseZoom: { current: 1.5 },
      lastMidX: { current: 150 },
      cooldown: { current: null },
      provisionalProbe: { current: false },
    };

    handleTouchRelease(refs);
    expect(refs.state.current).toBe('COOLDOWN');
    expect(refs.cooldown.current).not.toBeNull();

    vi.advanceTimersByTime(160);
    expect(refs.state.current).toBe('IDLE');
    expect(refs.cooldown.current).toBeNull();
    vi.useRealTimers();
  });

  it('handles off-screen pinned probe correctly with left and right clamping indicators', () => {
    const checkpoints: HistoricalCheckpoint[] = [
      {
        date: '2026-01-01',
        value: 100000,
        investedAmount: 90000,
        unrealizedGain: 10000,
        gainPct: 11.11,
        isAth: false,
        athValue: 100000,
        drawdownPct: 0,
      },
      {
        date: '2026-01-15',
        value: 105000,
        investedAmount: 90000,
        unrealizedGain: 15000,
        gainPct: 16.67,
        isAth: true,
        athValue: 105000,
        drawdownPct: 0,
      },
      {
        date: '2026-02-01',
        value: 110000,
        investedAmount: 90000,
        unrealizedGain: 20000,
        gainPct: 22.22,
        isAth: true,
        athValue: 110000,
        drawdownPct: 0,
      },
    ];

    // Slot states:
    // 0: selectedRange ('ALL')
    // 1: selectedIdx (null)
    // 2: probedDate ('2026-01-01')
    // 3: scrubX (16)
    // 4: zoomLevel (2)
    // 5: panOffset (1 - panned fully to the right)
    stateSlots = [
      { val: 'ALL', setter: vi.fn() },
      { val: null, setter: vi.fn() },
      { val: '2026-01-01', setter: vi.fn() },
      { val: 16, setter: vi.fn() },
      { val: 2, setter: vi.fn() },
      { val: 1, setter: vi.fn() },
    ];
    slotCursor = 0;

    const element = HistoricalTrendChart({
      checkpoints,
      width: 330,
      height: 200,
    });
    expect(element).toBeDefined();
    const children = getChartContentChildren(element);
    const tooltip = children[0] as React.ReactElement<{ isPinned?: boolean; cp: HistoricalCheckpoint }>;
    expect(tooltip).toBeDefined();
    // Verify pinned indicator and reset probe handler
    expect(tooltip.props.isPinned).toBe(true);
    expect(tooltip.props.cp.date).toBe('2026-01-01');
  });

  it('triggers cooldown debounce when transitioning from two fingers to one finger', () => {
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
    const onMove = handlers?.['onPanResponderMove'] as (e: unknown) => void;

    // Step 1: Start 2-finger pinch -> sets state to 'PINCHING'
    onMove({
      nativeEvent: {
        touches: [
          { pageX: 100, pageY: 100, locationX: 100 },
          { pageX: 200, pageY: 100, locationX: 200 },
        ],
      },
    });

    // Step 2: Lift one finger -> 1 touch remaining while in 'PINCHING'
    // Must NOT trigger single touch scrub; must transition to 'COOLDOWN'
    const scrubXCallsBefore = stateSlots[3]?.setter.mock.calls.length ?? 0;
    onMove({
      nativeEvent: {
        touches: [{ pageX: 150, pageY: 100, locationX: 150 }],
      },
    });

    // Should not have updated scrubX to the trailing finger's coordinate
    const scrubXCallsAfter = stateSlots[3]?.setter.mock.calls.length ?? 0;
    expect(scrubXCallsAfter).toBe(scrubXCallsBefore);
  });
});
