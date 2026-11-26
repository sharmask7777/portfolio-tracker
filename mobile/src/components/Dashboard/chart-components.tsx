import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import type {
  HistoricalCheckpoint,
  HistoryRangePreset,
} from '../../services/reality-check-service';
import {
  formatInr,
  formatDate,
  type Coordinates,
} from './chart-geometry';
import { chartStyles } from './chart-styles';

export { chartStyles } from './chart-styles';

/**
 * Historical range preset buttons.
 */
export const RANGES: HistoryRangePreset[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];

/**
 * Properties for {@link ChartHeader}.
 */
export interface ChartHeaderProps {
  isAth: boolean;
  drawdown: number;
  isZoomed?: boolean | undefined;
  onResetZoom?: (() => void) | undefined;
}

/**
 * Renders the chart header with title, optional Reset Zoom button, and ATH badge.
 *
 * @param props Header props
 * @returns React Native element
 */
export function ChartHeader({
  isAth,
  drawdown,
  isZoomed,
  onResetZoom,
}: ChartHeaderProps): React.ReactElement {
  return (
    <View style={chartStyles.header}>
      <Text style={chartStyles.title}>Valuation Trend & Checkpoints</Text>
      <View style={chartStyles.headerActions}>
        {isZoomed ? (
          <TouchableOpacity
            style={chartStyles.resetZoomBtn}
            onPress={onResetZoom}
            accessibilityRole="button"
            testID="reset-zoom-button"
          >
            <Text style={chartStyles.resetZoomText}>Reset Zoom</Text>
          </TouchableOpacity>
        ) : null}
        <View
          style={[chartStyles.athBadge, isAth ? chartStyles.athBadgeActive : chartStyles.athBadgeDrawdown]}
          testID="ath-badge"
        >
          <Text style={[chartStyles.athBadgeText, isAth ? chartStyles.athBadgeTextActive : chartStyles.athBadgeTextDrawdown]}>
            {isAth ? 'All-Time High' : `${drawdown.toFixed(1)}% Drawdown`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Properties for {@link RangeBar}.
 */
export interface RangeBarProps {
  selectedRange: HistoryRangePreset;
  onSelectRange: (r: HistoryRangePreset) => void;
}

/**
 * Renders the range filter buttons bar.
 *
 * @param props Active range and select callback
 * @returns React Native element
 */
export function RangeBar({
  selectedRange,
  onSelectRange,
}: RangeBarProps): React.ReactElement {
  return (
    <View style={chartStyles.rangeBar} testID="history-range-bar">
      {RANGES.map((r) => (
        <TouchableOpacity
          key={r}
          style={[chartStyles.rangeBtn, selectedRange === r && chartStyles.rangeBtnActive]}
          onPress={() => onSelectRange(r)}
          accessibilityRole="button"
          testID={`range-button-${r}`}
        >
          <Text style={[chartStyles.rangeText, selectedRange === r && chartStyles.rangeTextActive]}>
            {r}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Renders an empty placeholder when no historical data points are available.
 *
 * @returns React Native element
 */
export function ChartEmptyState(): React.ReactElement {
  return (
    <View style={chartStyles.emptyContainer} testID="chart-empty-state">
      <Text style={chartStyles.emptyText}>No historical data available</Text>
    </View>
  );
}

/**
 * Properties for {@link CheckpointTooltip}.
 */
export interface CheckpointTooltipProps {
  cp: HistoricalCheckpoint;
  isPinned?: boolean | undefined;
  onResetProbe?: (() => void) | undefined;
}

/**
 * Renders the inspection tooltip card for the selected checkpoint point.
 *
 * @param props Checkpoint and optional pinned probe handlers
 * @returns React Native element
 */
export function CheckpointTooltip({
  cp,
  isPinned,
  onResetProbe,
}: CheckpointTooltipProps): React.ReactElement {
  const isGainPositive = cp.unrealizedGain >= 0;
  return (
    <View style={chartStyles.tooltipCard} testID="checkpoint-tooltip-card">
      <View style={chartStyles.tooltipDateRow}>
        <View style={chartStyles.tooltipDateLeft}>
          <Text style={chartStyles.tooltipDate}>{formatDate(cp.date)}</Text>
          {cp.isAth ? <TrendingUp size={14} color="#10b981" /> : <TrendingDown size={14} color="#ef4444" />}
        </View>
        {isPinned ? (
          <TouchableOpacity
            style={chartStyles.resetProbeBtn}
            onPress={onResetProbe}
            accessibilityRole="button"
            testID="reset-probe-button"
          >
            <Text style={chartStyles.resetProbeText}>Reset to Latest</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={chartStyles.tooltipMetricsGrid}>
        <View style={chartStyles.tooltipMetric}>
          <Text style={chartStyles.tooltipMetricLabel}>Valuation</Text>
          <Text style={chartStyles.tooltipMetricValue}>{formatInr(cp.value)}</Text>
        </View>
        <View style={chartStyles.tooltipMetric}>
          <Text style={chartStyles.tooltipMetricLabel}>Invested</Text>
          <Text style={chartStyles.tooltipMetricValue}>{formatInr(cp.investedAmount)}</Text>
        </View>
        <View style={chartStyles.tooltipMetric}>
          <Text style={chartStyles.tooltipMetricLabel}>Gain / ATH</Text>
          <Text style={[chartStyles.tooltipMetricValue, { color: isGainPositive ? '#10b981' : '#ef4444' }]}>
            {cp.gainPct >= 0 ? '+' : ''}{cp.gainPct.toFixed(1)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Properties for {@link ChartSvgCanvas}.
 */
export interface ChartSvgCanvasProps {
  width: number;
  height: number;
  geometry: Coordinates;
  selectedIdx: number | null;
  scrubX?: number | null | undefined;
  onSelectIdx: (idx: number) => void;
  panResponderHandlers?: Record<string, unknown> | undefined;
  onGestureActive?: ((active: boolean) => void) | undefined;
}

/**
 * Renders the checkpoint circle data points on the SVG canvas.
 */
function renderDataPoints(
  points: Coordinates['valPoints'],
  selectedIdx: number | null,
  onSelectIdx: (idx: number) => void,
): React.ReactElement[] {
  return points.map((p, idx) => (
    <Circle
      key={p.cp.date}
      cx={p.x}
      cy={p.y}
      r={selectedIdx === idx ? 6 : 4}
      fill={selectedIdx === idx ? '#f59e0b' : p.cp.isAth ? '#10b981' : '#3b82f6'}
      stroke="#18181b"
      strokeWidth={1.5}
      onPress={() => onSelectIdx(idx)}
    />
  ));
}

/**
 * Renders the SVG curves, vertical scrub hairline, and interactive checkpoint circles.
 *
 * @param props SVG dimensions, geometry, scrub hairline position, and handlers
 * @returns React Native element
 */
export function ChartSvgCanvas({
  width,
  height,
  geometry,
  selectedIdx,
  scrubX,
  onSelectIdx,
  panResponderHandlers,
}: ChartSvgCanvasProps): React.ReactElement {
  const hasScrub = scrubX !== null && scrubX !== undefined && Number.isFinite(scrubX);
  return (
    <View
      style={chartStyles.chartContainer}
      testID="chart-svg-canvas"
      {...(panResponderHandlers ?? {})}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        {geometry.areaPath ? <Path d={geometry.areaPath} fill="url(#valGrad)" /> : null}
        {geometry.costPath ? <Path d={geometry.costPath} stroke="#71717a" strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
        {geometry.valPath ? <Path d={geometry.valPath} stroke="#3b82f6" strokeWidth={2.5} fill="none" /> : null}
        {hasScrub ? (
          <Line
            x1={scrubX}
            y1={0}
            x2={scrubX}
            y2={height}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            testID="scrub-hairline"
          />
        ) : null}
        {renderDataPoints(geometry.valPoints, selectedIdx, onSelectIdx)}
      </Svg>
    </View>
  );
}

/**
 * Renders chart legend for valuation and invested capital lines.
 *
 * @returns React Native element
 */
export function ChartLegend(): React.ReactElement {
  return (
    <View style={chartStyles.legend}>
      <View style={chartStyles.legendItem}>
        <View style={chartStyles.legendLineVal} />
        <Text style={chartStyles.legendText}>Valuation</Text>
      </View>
      <View style={chartStyles.legendItem}>
        <View style={chartStyles.legendLineCost} />
        <Text style={chartStyles.legendText}>Invested Capital</Text>
      </View>
    </View>
  );
}
