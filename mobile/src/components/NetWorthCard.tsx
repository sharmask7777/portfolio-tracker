import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatInr, formatPct } from '../services/portfolio-service';

export interface NetWorthCardProps {
  totalCurrentValue: number;
  totalInvestedCost: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
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
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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

export function NetWorthCard({
  totalCurrentValue,
  totalInvestedCost,
  unrealizedGain,
  unrealizedGainPct,
}: NetWorthCardProps): React.ReactElement {
  const isGainPositive = unrealizedGain >= 0;
  const gainStyle = isGainPositive ? styles.positive : styles.negative;
  const gainFormatted = `${formatInr(unrealizedGain)} (${formatPct(unrealizedGainPct)})`;

  return (
    <View style={styles.card} testID="net-worth-card">
      <Text style={styles.label}>Total Net Worth</Text>
      <Text style={styles.value}>{formatInr(totalCurrentValue)}</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>Invested Cost</Text>
          <Text style={styles.metricValue}>{formatInr(totalInvestedCost)}</Text>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>Total Gain / Loss</Text>
          <Text style={[styles.metricValue, gainStyle]}>{gainFormatted}</Text>
        </View>
      </View>
    </View>
  );
}
