/**
 * @file NetWorthCard.tsx
 * @description Overview card showing total portfolio net worth, invested principal, and returns with XIRR/ABS mode toggle.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PerformanceMode } from '@portfolio/core-view';
import { formatInr, formatPct } from '../services/portfolio-service';
import { PerformanceModeToggle } from './Common/PerformanceModeToggle';

/**
 * Props for {@link NetWorthCard}.
 */
export interface NetWorthCardProps {
  /** Total portfolio current market valuation amount in INR */
  totalCurrentValue: number;
  /** Total invested principal cost amount in INR */
  totalInvestedCost: number;
  /** Unrealized profit or loss in INR */
  unrealizedGain: number;
  /** Unrealized return percentage */
  unrealizedGainPct: number;
  /** Optional performance mode toggle state: 'XIRR' or 'ABS' */
  performanceMode?: PerformanceMode | undefined;
  /** Optional overall annualized XIRR rate (decimal or percentage) */
  overallXirr?: number | undefined;
  /** Optional callback invoked when performance mode toggle is switched */
  onTogglePerformanceMode?: ((mode: PerformanceMode) => void) | undefined;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

function resolveReturnPct(
  performanceMode: PerformanceMode | undefined,
  overallXirr: number | undefined,
  unrealizedGainPct: number
): number {
  if (performanceMode === 'XIRR' && overallXirr !== undefined) {
    return overallXirr * 100;
  }
  return unrealizedGainPct;
}

function resolveReturnLabel(
  performanceMode: PerformanceMode | undefined,
  overallXirr: number | undefined
): string {
  if (!performanceMode) return 'Total Gain / Loss';
  if (performanceMode === 'XIRR') {
    return overallXirr !== undefined ? 'Total Gain (XIRR)' : 'Total Gain (ABS)';
  }
  return 'Total Gain (ABS)';
}

/**
 * Overview card showing total portfolio net worth, invested principal, and unrealized returns.
 *
 * @param props - Component properties {@link NetWorthCardProps}
 * @returns React Native element
 */
export function NetWorthCard({
  totalCurrentValue,
  totalInvestedCost,
  unrealizedGain,
  unrealizedGainPct,
  performanceMode,
  overallXirr,
  onTogglePerformanceMode,
}: NetWorthCardProps): React.ReactElement {
  const isGainPositive = unrealizedGain >= 0;
  const gainStyle = isGainPositive ? styles.positive : styles.negative;
  const returnPct = resolveReturnPct(performanceMode, overallXirr, unrealizedGainPct);
  const returnLabel = resolveReturnLabel(performanceMode, overallXirr);
  const gainFormatted = `${formatInr(unrealizedGain)} (${formatPct(returnPct)})`;

  return (
    <View style={styles.card} testID="net-worth-card">
      <View style={styles.headerRow}>
        <Text style={styles.label}>Total Net Worth</Text>
        {performanceMode && onTogglePerformanceMode ? (
          <PerformanceModeToggle mode={performanceMode} onToggle={onTogglePerformanceMode} />
        ) : null}
      </View>
      <Text style={styles.value}>{formatInr(totalCurrentValue)}</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>Invested Cost</Text>
          <Text style={styles.metricValue}>{formatInr(totalInvestedCost)}</Text>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>{returnLabel}</Text>
          <Text style={[styles.metricValue, gainStyle]}>{gainFormatted}</Text>
        </View>
      </View>
    </View>
  );
}
