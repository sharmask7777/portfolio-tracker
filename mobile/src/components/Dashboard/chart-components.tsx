import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
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

/**
 * Style definitions for historical trend chart components.
 */
export const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  athBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  athBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  athBadgeDrawdown: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  athBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  athBadgeTextActive: {
    color: '#10b981',
  },
  athBadgeTextDrawdown: {
    color: '#ef4444',
  },
  rangeBar: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  rangeBtnActive: {
    backgroundColor: '#27272a',
  },
  rangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717a',
  },
  rangeTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  tooltipCard: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 12,
    marginBottom: 14,
  },
  tooltipDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    paddingBottom: 6,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  tooltipMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tooltipMetric: {
    flex: 1,
  },
  tooltipMetricLabel: {
    fontSize: 10,
    color: '#71717a',
    marginBottom: 2,
  },
  tooltipMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLineVal: {
    width: 14,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 6,
  },
  legendLineCost: {
    width: 14,
    height: 2,
    backgroundColor: '#71717a',
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
  },
});

/**
 * Historical range preset buttons.
 */
export const RANGES: HistoryRangePreset[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];

/**
 * Renders the chart header with title and ATH badge.
 *
 * @param props Header props
 * @returns React Native element
 */
export function ChartHeader({
  isAth,
  drawdown,
}: {
  isAth: boolean;
  drawdown: number;
}): React.ReactElement {
  return (
    <View style={chartStyles.header}>
      <Text style={chartStyles.title}>Valuation Trend & Checkpoints</Text>
      <View
        style={[chartStyles.athBadge, isAth ? chartStyles.athBadgeActive : chartStyles.athBadgeDrawdown]}
        testID="ath-badge"
      >
        <Text style={[chartStyles.athBadgeText, isAth ? chartStyles.athBadgeTextActive : chartStyles.athBadgeTextDrawdown]}>
          {isAth ? 'All-Time High' : `${drawdown.toFixed(1)}% Drawdown`}
        </Text>
      </View>
    </View>
  );
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
}: {
  selectedRange: HistoryRangePreset;
  onSelectRange: (r: HistoryRangePreset) => void;
}): React.ReactElement {
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
 * Renders the inspection tooltip card for the selected checkpoint point.
 *
 * @param props Selected checkpoint
 * @returns React Native element
 */
export function CheckpointTooltip({ cp }: { cp: HistoricalCheckpoint }): React.ReactElement {
  const isGainPositive = cp.unrealizedGain >= 0;
  return (
    <View style={chartStyles.tooltipCard} testID="checkpoint-tooltip-card">
      <View style={chartStyles.tooltipDateRow}>
        <Text style={chartStyles.tooltipDate}>{formatDate(cp.date)}</Text>
        {cp.isAth ? <TrendingUp size={14} color="#10b981" /> : <TrendingDown size={14} color="#ef4444" />}
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
 * Renders the SVG curves and interactive checkpoint circles.
 *
 * @param props SVG dimensions, geometry, selected index, and select callback
 * @returns React Native element
 */
export function ChartSvgCanvas({
  width,
  height,
  geometry,
  selectedIdx,
  onSelectIdx,
}: {
  width: number;
  height: number;
  geometry: Coordinates;
  selectedIdx: number | null;
  onSelectIdx: (idx: number) => void;
}): React.ReactElement {
  return (
    <View style={chartStyles.chartContainer}>
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
        {geometry.valPoints.map((p, idx) => (
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
        ))}
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
