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
  /** Whether Reality Check mode is active */
  realityCheckMode?: boolean | undefined;
  /** Backend-computed Net Realizable Wealth (post-tax & exit load) */
  netRealizableValue?: number | undefined;
  /** Backend-computed estimated unrealized tax */
  estimatedTax?: number | undefined;
  /** Backend-computed Real Post-Tax XIRR (decimal) */
  realPostTaxXirr?: number | null | undefined;
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
  subValueRow: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: -10,
    marginBottom: 14,
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

function resolveDisplayedNetWorth(
  realityCheckMode: boolean | undefined,
  totalCurrentValue: number,
  netRealizableValue: number | undefined,
): { title: string; value: number } {
  if (realityCheckMode) {
    return {
      title: 'Net Realizable Wealth',
      value: netRealizableValue ?? totalCurrentValue,
    };
  }
  return { title: 'Total Net Worth', value: totalCurrentValue };
}

function resolveDisplayedReturn(props: NetWorthCardProps): { label: string; formatted: string } {
  if (props.realityCheckMode && props.realPostTaxXirr !== undefined && props.realPostTaxXirr !== null) {
    return {
      label: 'Real Post-Tax XIRR',
      formatted: `${formatPct(props.realPostTaxXirr * 100)}`,
    };
  }
  const returnPct = resolveReturnPct(props.performanceMode, props.overallXirr, props.unrealizedGainPct);
  const label = resolveReturnLabel(props.performanceMode, props.overallXirr);
  return { label, formatted: `${formatInr(props.unrealizedGain)} (${formatPct(returnPct)})` };
}

/**
 * Overview card showing total portfolio net worth, invested principal, and unrealized returns.
 *
 * @param props - Component properties {@link NetWorthCardProps}
 * @returns React Native element
 */
export function NetWorthCard(props: NetWorthCardProps): React.ReactElement {
  const { totalCurrentValue, totalInvestedCost, unrealizedGain, performanceMode, onTogglePerformanceMode } = props;
  const gainStyle = unrealizedGain >= 0 ? styles.positive : styles.negative;
  const { title, value } = resolveDisplayedNetWorth(props.realityCheckMode, totalCurrentValue, props.netRealizableValue);
  const { label: returnLabel, formatted: gainFormatted } = resolveDisplayedReturn(props);

  return (
    <View style={styles.card} testID="net-worth-card">
      <View style={styles.headerRow}>
        <Text style={styles.label}>{title}</Text>
        {performanceMode && onTogglePerformanceMode ? (
          <PerformanceModeToggle mode={performanceMode} onToggle={onTogglePerformanceMode} />
        ) : null}
      </View>
      <View>
        <Text style={styles.value}>{formatInr(value)}</Text>
        {props.realityCheckMode && props.estimatedTax !== undefined ? (
          <Text style={styles.subValueRow}>
            Gross: {formatInr(totalCurrentValue)} · Est. Tax: -{formatInr(props.estimatedTax)}
          </Text>
        ) : null}
      </View>

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
