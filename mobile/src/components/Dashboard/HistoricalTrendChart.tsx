import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import {
  deriveHistoricalCheckpoints,
  filterCheckpointsByRange,
  type HistoricalCheckpoint,
  type HistoryRangePreset,
} from '../../services/reality-check-service';
import type { HistoryPoint } from '../../types/generated';
import { computeChartGeometry } from './chart-geometry';
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
}

/**
 * Downsamples dense history points so SVG chart performance remains smooth.
 *
 * @param data Array of checkpoints
 * @param maxPoints Maximum target points
 * @returns Sampled checkpoints
 */
function sampleCheckpoints(
  data: HistoricalCheckpoint[],
  maxPoints: number = 300,
): HistoricalCheckpoint[] {
  if (data.length <= maxPoints) return data;
  const interval = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % interval === 0 || idx === data.length - 1);
}

/**
 * Resolves source checkpoints from provided checkpoints or history points.
 *
 * @param checkpoints Checkpoint array if already converted
 * @param historyPoints History points from API / SQLite cache
 * @returns Array of historical checkpoints
 */
function resolveCheckpoints(
  checkpoints: HistoricalCheckpoint[] | undefined,
  historyPoints: HistoryPoint[] | undefined,
): HistoricalCheckpoint[] {
  if (checkpoints && checkpoints.length > 0) {
    return checkpoints;
  }
  if (historyPoints && historyPoints.length > 0) {
    return deriveHistoricalCheckpoints(historyPoints);
  }
  return [];
}

/**
 * Resolves the currently selected or latest active checkpoint.
 *
 * @param items List of checkpoints
 * @param idx Selected point index
 * @returns Active checkpoint
 */
function resolveActiveCheckpoint(
  items: HistoricalCheckpoint[],
  idx: number | null,
): HistoricalCheckpoint | undefined {
  if (idx !== null) {
    const selected = items[idx];
    if (selected) return selected;
  }
  return items[items.length - 1];
}

/**
 * Extracts ATH and drawdown metrics from active checkpoint.
 *
 * @param cp Active checkpoint
 * @returns ATH boolean and drawdown percentage
 */
function getAthMetrics(cp: HistoricalCheckpoint | undefined): { isAth: boolean; drawdown: number } {
  if (!cp) return { isAth: false, drawdown: 0 };
  return { isAth: cp.isAth, drawdown: cp.drawdownPct };
}

/**
 * Historical valuation trend chart with SVG curves, mark-to-market checkpoint dots,
 * and All-Time High / drawdown indicators.
 *
 * @param props Chart checkpoints, history points, dimensions, and overrides
 * @returns React Native SVG historical trend chart
 */
export function HistoricalTrendChart(props: HistoricalTrendChartProps): React.ReactElement {
  const height = props.height ?? 200;
  const width = props.width ?? 330;

  const [selectedRange, setSelectedRange] = useState<HistoryRangePreset>('ALL');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const allCheckpoints = useMemo(
    () => resolveCheckpoints(props.checkpoints, props.historyPoints),
    [props.checkpoints, props.historyPoints],
  );

  const filtered = useMemo(
    () => sampleCheckpoints(filterCheckpointsByRange(allCheckpoints, selectedRange)),
    [allCheckpoints, selectedRange],
  );

  const activeCheckpoint = resolveActiveCheckpoint(filtered, selectedIdx);
  const geometry = useMemo(
    () => computeChartGeometry(filtered, width, height),
    [filtered, width, height],
  );
  const { isAth, drawdown } = getAthMetrics(activeCheckpoint);
  const hasData = filtered.length > 0;

  return (
    <View style={chartStyles.card} testID="historical-trend-chart">
      <ChartHeader isAth={isAth} drawdown={drawdown} />
      <RangeBar
        selectedRange={selectedRange}
        onSelectRange={(r) => {
          setSelectedRange(r);
          setSelectedIdx(null);
        }}
      />
      {hasData ? (
        <>
          {activeCheckpoint && <CheckpointTooltip cp={activeCheckpoint} />}
          <ChartSvgCanvas
            width={width}
            height={height}
            geometry={geometry}
            selectedIdx={selectedIdx}
            onSelectIdx={setSelectedIdx}
          />
          <ChartLegend />
        </>
      ) : (
        <ChartEmptyState />
      )}
    </View>
  );
}
