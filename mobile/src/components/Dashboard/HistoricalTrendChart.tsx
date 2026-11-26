import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import {
  deriveHistoricalCheckpoints,
  filterCheckpointsByRange,
  type HistoricalCheckpoint,
  type HistoryRangePreset,
} from '../../services/reality-check-service';
import type { HistoryPoint } from '../../types/generated';
import {
  computeChartGeometry,
  findNearestCheckpointIndex,
  sliceCheckpointsByTimeRange,
  type Coordinates,
} from './chart-geometry';
import {
  chartStyles,
  ChartHeader,
  RangeBar,
  CheckpointTooltip,
  ChartSvgCanvas,
  ChartLegend,
  ChartEmptyState,
} from './chart-components';

/**
 * Properties for {@link HistoricalTrendChart}.
 */
export interface HistoricalTrendChartProps {
  checkpoints?: HistoricalCheckpoint[] | undefined;
  historyPoints?: HistoryPoint[] | undefined;
  currentValue?: number | undefined;
  investedCost?: number | undefined;
  height?: number | undefined;
  width?: number | undefined;
  onGestureActive?: ((active: boolean) => void) | undefined;
}

interface ScrubContext {
  geometry: Coordinates;
  filtered: HistoricalCheckpoint[];
  width: number;
}

interface ScrubCallbacks {
  setProbedDate: (d: string) => void;
  setSelectedIdx: (i: number) => void;
  setScrubX: (x: number) => void;
  onGestureActive?: ((active: boolean) => void) | undefined;
}

interface GestureRefs {
  state: React.MutableRefObject<'IDLE' | 'SCRUBBING' | 'PINCHING' | 'COOLDOWN'>;
  dist: React.MutableRefObject<number | null>;
  baseZoom: React.MutableRefObject<number>;
  cooldown: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

function sampleCheckpoints(data: HistoricalCheckpoint[], maxPoints: number = 300): HistoricalCheckpoint[] {
  if (data.length <= maxPoints) return data;
  const interval = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % interval === 0 || idx === data.length - 1);
}

function resolveCheckpoints(
  checkpoints: HistoricalCheckpoint[] | undefined,
  historyPoints: HistoryPoint[] | undefined,
): HistoricalCheckpoint[] {
  if (checkpoints && checkpoints.length > 0) return checkpoints;
  if (historyPoints && historyPoints.length > 0) return deriveHistoricalCheckpoints(historyPoints);
  return [];
}

function resolveActiveCheckpoint(
  items: HistoricalCheckpoint[],
  probedDate: string | null,
  idx: number | null,
): HistoricalCheckpoint | undefined {
  if (probedDate !== null) {
    const probed = items.find((cp) => cp.date === probedDate);
    if (probed) return probed;
  }
  if (idx !== null) {
    const selected = items[idx];
    if (selected) return selected;
  }
  return items[items.length - 1];
}

function sliceForZoom(items: HistoricalCheckpoint[], zoomLevel: number): HistoricalCheckpoint[] {
  if (zoomLevel <= 1 || items.length < 2) return sampleCheckpoints(items);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return sampleCheckpoints(items);

  const startMs = new Date(first.date).getTime();
  const endMs = new Date(last.date).getTime();
  const duration = endMs - startMs;
  if (duration <= 0) return sampleCheckpoints(items);

  const visibleDuration = duration / zoomLevel;
  const visibleStart = endMs - visibleDuration;
  return sliceCheckpointsByTimeRange(items, visibleStart, endMs);
}

function handleSingleTouch(event: GestureResponderEvent, ctx: ScrubContext, callbacks: ScrubCallbacks): void {
  const touches = event.nativeEvent.touches;
  const touchX = touches[0]?.locationX ?? event.nativeEvent.locationX;
  const nearestIdx = findNearestCheckpointIndex(touchX, ctx.geometry.valPoints, 16, ctx.width);
  const targetCp = ctx.filtered[nearestIdx];
  if (targetCp) {
    callbacks.setProbedDate(targetCp.date);
    callbacks.setSelectedIdx(nearestIdx);
  }
  const snappedX = ctx.geometry.valPoints[nearestIdx]?.x ?? touchX;
  callbacks.setScrubX(snappedX);
  callbacks.onGestureActive?.(true);
}

function computeTouchDistance(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  const t0 = touches[0];
  const t1 = touches[1];
  if (!t0 || !t1) return 0;
  return Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
}

function handlePinchMove(
  event: GestureResponderEvent,
  refs: GestureRefs,
  callbacks: { setZoomLevel: React.Dispatch<React.SetStateAction<number>>; setScrubX: (x: number) => void; onGestureActive?: ((a: boolean) => void) | undefined },
): void {
  if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
  refs.state.current = 'PINCHING';
  const dist = computeTouchDistance(event);
  if (refs.dist.current === null) {
    refs.dist.current = dist;
  } else if (refs.dist.current > 0) {
    const scale = dist / refs.dist.current;
    callbacks.setZoomLevel(Math.max(1, Math.min(5, refs.baseZoom.current * scale)));
  }
  callbacks.setScrubX(Number.NaN);
  callbacks.onGestureActive?.(true);
}

function handleTouchRelease(refs: GestureRefs, onGestureActive?: ((a: boolean) => void) | undefined): void {
  onGestureActive?.(false);
  refs.dist.current = null;
  if (refs.state.current === 'PINCHING') {
    refs.state.current = 'COOLDOWN';
    if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
    refs.cooldown.current = setTimeout(() => {
      refs.state.current = 'IDLE';
      refs.cooldown.current = null;
    }, 150);
  } else if (refs.state.current !== 'COOLDOWN') {
    refs.state.current = 'IDLE';
  }
}

function useChartPanResponder(
  ctx: ScrubContext,
  callbacks: ScrubCallbacks & { setZoomLevel: React.Dispatch<React.SetStateAction<number>> },
  zoomLevel: number,
): PanResponderInstance {
  const refs: GestureRefs = {
    state: useRef<'IDLE' | 'SCRUBBING' | 'PINCHING' | 'COOLDOWN'>('IDLE'),
    dist: useRef<number | null>(null),
    baseZoom: useRef<number>(1),
    cooldown: useRef<ReturnType<typeof setTimeout> | null>(null),
  };
  refs.baseZoom.current = zoomLevel;

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length <= 1 && refs.state.current !== 'COOLDOWN') {
            refs.state.current = 'SCRUBBING';
            handleSingleTouch(evt, ctx, callbacks);
          }
        },
        onPanResponderMove: (evt) => {
          if (evt.nativeEvent.touches.length >= 2) {
            handlePinchMove(evt, refs, callbacks);
            return;
          }
          if (evt.nativeEvent.touches.length === 1 && refs.state.current !== 'COOLDOWN') {
            refs.state.current = 'SCRUBBING';
            handleSingleTouch(evt, ctx, callbacks);
          }
        },
        onPanResponderRelease: () => handleTouchRelease(refs, callbacks.onGestureActive),
        onPanResponderTerminate: () => handleTouchRelease(refs, callbacks.onGestureActive),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, callbacks, zoomLevel],
  );
}

function getAthMetrics(cp: HistoricalCheckpoint | undefined): { isAth: boolean; drawdown: number } {
  if (!cp) return { isAth: false, drawdown: 0 };
  return { isAth: cp.isAth, drawdown: cp.drawdownPct };
}

interface HistoricalChartState {
  selectedRange: HistoryRangePreset;
  zoomLevel: number;
  filtered: HistoricalCheckpoint[];
  activeCheckpoint: HistoricalCheckpoint | undefined;
  geometry: Coordinates;
  panResponder: PanResponderInstance;
  canvasSelectedIdx: number | null;
  canvasScrubX: number | null;
  isPinned: boolean;
  hasData: boolean;
  resetZoom: () => void;
  resetProbe: () => void;
  selectRange: (r: HistoryRangePreset) => void;
  selectPoint: (idx: number) => void;
}

function useHistoricalChartState(
  props: HistoricalTrendChartProps,
  width: number,
  height: number,
): HistoricalChartState {
  const [selectedRange, setSelectedRange] = useState<HistoryRangePreset>('ALL');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [probedDate, setProbedDate] = useState<string | null>(null);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const all = useMemo(() => resolveCheckpoints(props.checkpoints, props.historyPoints), [props.checkpoints, props.historyPoints]);
  const rangePoints = useMemo(() => filterCheckpointsByRange(all, selectedRange), [all, selectedRange]);
  const filtered = useMemo(() => sliceForZoom(rangePoints, zoomLevel), [rangePoints, zoomLevel]);
  const activeCheckpoint = resolveActiveCheckpoint(filtered, probedDate, selectedIdx);
  const geometry = useMemo(() => computeChartGeometry(filtered, width, height), [filtered, width, height]);

  const scrubCallbacks = useMemo(
    () => ({ setProbedDate, setSelectedIdx, setScrubX, setZoomLevel, onGestureActive: props.onGestureActive }),
    [props.onGestureActive],
  );
  const scrubCtx = useMemo(() => ({ geometry, filtered, width }), [geometry, filtered, width]);
  const panResponder = useChartPanResponder(scrubCtx, scrubCallbacks, zoomLevel);

  const activeIdx = activeCheckpoint ? filtered.findIndex((cp) => cp.date === activeCheckpoint.date) : -1;
  const canvasSelectedIdx = activeIdx >= 0 ? activeIdx : selectedIdx;
  const canvasScrubX = scrubX !== null && Number.isFinite(scrubX) ? scrubX : null;

  return {
    selectedRange, zoomLevel, filtered, activeCheckpoint, geometry, panResponder,
    canvasSelectedIdx, canvasScrubX, isPinned: probedDate !== null, hasData: filtered.length > 0,
    resetZoom: useCallback(() => setZoomLevel(1), []),
    resetProbe: useCallback(() => { setProbedDate(null); setScrubX(null); setSelectedIdx(null); }, []),
    selectRange: useCallback((r: HistoryRangePreset) => {
      setSelectedRange(r); setSelectedIdx(null); setZoomLevel(1); setProbedDate(null); setScrubX(null);
    }, []),
    selectPoint: useCallback((idx: number) => {
      const target = filtered[idx];
      if (target) { setProbedDate(target.date); setSelectedIdx(idx); setScrubX(geometry.valPoints[idx]?.x ?? null); }
    }, [filtered, geometry.valPoints]),
  };
}

function ChartContent({
  state,
  width,
  height,
  onGestureActive,
}: {
  state: HistoricalChartState;
  width: number;
  height: number;
  onGestureActive?: ((a: boolean) => void) | undefined;
}): React.ReactElement {
  return (
    <>
      {state.activeCheckpoint ? (
        <CheckpointTooltip cp={state.activeCheckpoint} isPinned={state.isPinned} onResetProbe={state.resetProbe} />
      ) : null}
      <ChartSvgCanvas
        width={width}
        height={height}
        geometry={state.geometry}
        selectedIdx={state.canvasSelectedIdx}
        scrubX={state.canvasScrubX}
        onSelectIdx={state.selectPoint}
        panResponderHandlers={state.panResponder.panHandlers}
        onGestureActive={onGestureActive}
      />
      <ChartLegend />
    </>
  );
}

/**
 * Historical valuation trend chart with SVG curves, interactive scrubbing,
 * pinch-to-zoom inspection, and All-Time High / drawdown indicators.
 *
 * @param props Chart checkpoints, history points, dimensions, and overrides
 * @returns React Native SVG historical trend chart
 */
export function HistoricalTrendChart(props: HistoricalTrendChartProps): React.ReactElement {
  const width = props.width ?? 330;
  const height = props.height ?? 200;
  const state = useHistoricalChartState(props, width, height);
  const { isAth, drawdown } = getAthMetrics(state.activeCheckpoint);

  return (
    <View style={chartStyles.card} testID="historical-trend-chart">
      <ChartHeader
        isAth={isAth}
        drawdown={drawdown}
        isZoomed={state.zoomLevel > 1}
        onResetZoom={state.resetZoom}
      />
      <RangeBar selectedRange={state.selectedRange} onSelectRange={state.selectRange} />
      {state.hasData ? (
        <ChartContent state={state} width={width} height={height} onGestureActive={props.onGestureActive} />
      ) : (
        <ChartEmptyState />
      )}
    </View>
  );
}
