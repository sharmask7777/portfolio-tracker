import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import {
  deriveHistoricalCheckpoints,
  filterCheckpointsByRange,
  type HistoricalCheckpoint,
  type HistoryRangePreset,
} from '../../services/reality-check-service';
import {
  computeChartGeometry,
  createSyntheticPoints,
} from './chart-geometry';
import {
  chartStyles,
  ChartHeader,
  RangeBar,
  CheckpointTooltip,
  ChartSvgCanvas,
  ChartLegend,
} from './chart-components';

/**
 * Properties for {@link HistoricalTrendChart}.
 */
export interface HistoricalTrendChartProps {
  checkpoints?: HistoricalCheckpoint[] | undefined;
  currentValue?: number | undefined;
  investedCost?: number | undefined;
  height?: number | undefined;
  width?: number | undefined;
}

/**
 * Resolves source checkpoints from provided list or generates synthetic baseline.
 *
 * @param provided Checkpoint array if already loaded
 * @param val Current valuation
 * @param cost Invested capital cost
 * @returns Array of historical checkpoints
 */
function resolveCheckpoints(
  provided: HistoricalCheckpoint[] | undefined,
  val: number,
  cost: number,
): HistoricalCheckpoint[] {
  if (provided && provided.length > 0) {
    return provided;
  }
  const raw = createSyntheticPoints(val, cost);
  return deriveHistoricalCheckpoints(raw);
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
 * @param props Chart checkpoints, dimensions, and overrides
 * @returns React Native SVG historical trend chart
 */
export function HistoricalTrendChart(props: HistoricalTrendChartProps): React.ReactElement {
  const currentValue = props.currentValue ?? 0;
  const investedCost = props.investedCost ?? 0;
  const height = props.height ?? 200;
  const width = props.width ?? 330;

  const [selectedRange, setSelectedRange] = useState<HistoryRangePreset>('ALL');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const allCheckpoints = useMemo(
    () => resolveCheckpoints(props.checkpoints, currentValue, investedCost),
    [props.checkpoints, currentValue, investedCost],
  );

  const filtered = useMemo(
    () => filterCheckpointsByRange(allCheckpoints, selectedRange),
    [allCheckpoints, selectedRange],
  );

  const activeCheckpoint = resolveActiveCheckpoint(filtered, selectedIdx);
  const geometry = useMemo(
    () => computeChartGeometry(filtered, width, height),
    [filtered, width, height],
  );
  const { isAth, drawdown } = getAthMetrics(activeCheckpoint);

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
      {activeCheckpoint && <CheckpointTooltip cp={activeCheckpoint} />}
      <ChartSvgCanvas
        width={width}
        height={height}
        geometry={geometry}
        selectedIdx={selectedIdx}
        onSelectIdx={setSelectedIdx}
      />
      <ChartLegend />
    </View>
  );
}
