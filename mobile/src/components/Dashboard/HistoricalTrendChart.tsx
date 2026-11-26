import React, { useState, useMemo, useCallback } from 'react';
import { View, type PanResponderInstance } from 'react-native';
import {
  deriveHistoricalCheckpoints,
  filterCheckpointsByRange,
  type HistoricalCheckpoint,
  type HistoryRangePreset,
} from '../../services/reality-check-service';
import type { HistoryPoint } from '../../types/generated';
import { computeChartGeometry, type Coordinates } from './chart-geometry';
import {
  chartStyles,
  ChartHeader,
  RangeBar,
  CheckpointTooltip,
  ChartSvgCanvas,
  ChartLegend,
  ChartEmptyState,
} from './chart-components';
import {
  useChartPanResponder,
  sliceForZoomAndPan,
} from './chart-gesture';

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
  const [panOffset, setPanOffset] = useState<number>(1);

  const all = useMemo(() => resolveCheckpoints(props.checkpoints, props.historyPoints), [props.checkpoints, props.historyPoints]);
  const rangePoints = useMemo(() => filterCheckpointsByRange(all, selectedRange), [all, selectedRange]);
  const filtered = useMemo(() => sliceForZoomAndPan(rangePoints, zoomLevel, panOffset), [rangePoints, zoomLevel, panOffset]);
  const activeCheckpoint = resolveActiveCheckpoint(filtered, probedDate, selectedIdx);
  const geometry = useMemo(() => computeChartGeometry(filtered, width, height), [filtered, width, height]);

  const scrubCallbacks = useMemo(
    () => ({ setProbedDate, setSelectedIdx, setScrubX, setZoomLevel, setPanOffset, onGestureActive: props.onGestureActive }),
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
    resetZoom: useCallback(() => { setZoomLevel(1); setPanOffset(1); }, []),
    resetProbe: useCallback(() => { setProbedDate(null); setScrubX(null); setSelectedIdx(null); }, []),
    selectRange: useCallback((r: HistoryRangePreset) => {
      setSelectedRange(r); setSelectedIdx(null); setZoomLevel(1); setPanOffset(1); setProbedDate(null); setScrubX(null);
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
}: {
  state: HistoricalChartState;
  width: number;
  height: number;
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
        <ChartContent state={state} width={width} height={height} />
      ) : (
        <ChartEmptyState />
      )}
    </View>
  );
}
