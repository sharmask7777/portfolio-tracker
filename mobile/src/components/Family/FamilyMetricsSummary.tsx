import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FamilyMemberMetrics } from '../../services/family-service';
import { formatInr, formatPct } from '../../services/portfolio-service';

/**
 * Props for {@link FamilyMetricsSummary}.
 */
export interface FamilyMetricsSummaryProps {
  /** Aggregated or member-specific metrics */
  metrics: FamilyMemberMetrics;
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  summaryBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  summaryBadgeText: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '600',
  },
  mainVal: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    marginBottom: 14,
  },
  metricLabel: {
    fontSize: 11,
    color: '#71717a',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  gainPositive: {
    color: '#22c55e',
  },
  gainNegative: {
    color: '#ef4444',
  },
  allocBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#27272a',
    marginTop: 6,
  },
});

/**
 * Renders the primary portfolio summary card for selected or consolidated view.
 *
 * @param props - Component props
 * @returns React Native element
 */
export function FamilyMetricsSummary({ metrics }: FamilyMetricsSummaryProps): React.ReactElement {
  const isPositive = metrics.totalGain >= 0;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>{metrics.name}</Text>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>{metrics.relationship}</Text>
        </View>
      </View>
      <Text style={styles.mainVal}>{formatInr(metrics.currentValue)}</Text>
      <View style={styles.metricsGrid}>
        <View>
          <Text style={styles.metricLabel}>Total Invested</Text>
          <Text style={styles.metricValue}>{formatInr(metrics.totalInvested)}</Text>
        </View>
        <View>
          <Text style={styles.metricLabel}>Holdings</Text>
          <Text style={styles.metricValue}>{metrics.holdingsCount}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.metricLabel}>Overall Return</Text>
          <Text style={[styles.metricValue, isPositive ? styles.gainPositive : styles.gainNegative]}>
            {formatInr(metrics.totalGain)} ({formatPct(metrics.totalGainPct)})
          </Text>
        </View>
      </View>
      {metrics.allocationBreakdown.length > 0 && (
        <View style={styles.allocBar}>
          {metrics.allocationBreakdown.map((item) => (
            <View
              key={item.name}
              style={{
                flex: item.percentage,
                backgroundColor: item.color,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
