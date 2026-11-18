import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatInr, formatPct } from '../services/portfolio-service';

export interface DayReturnBannerProps {
  dayGain: number;
  dayGainPct: number;
  isOfflineFallback?: boolean;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leftCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '500',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

export function DayReturnBanner({
  dayGain,
  dayGainPct,
  isOfflineFallback,
}: DayReturnBannerProps): React.ReactElement {
  const isPositive = dayGain >= 0;
  const valueStyle = isPositive ? styles.positive : styles.negative;
  const formatted = `${formatInr(dayGain)} (${formatPct(dayGainPct)})`;

  return (
    <View style={styles.banner} testID="day-return-banner">
      <View style={styles.leftCol}>
        <Text style={styles.label}>Day's Change</Text>
        <Text style={[styles.value, valueStyle]}>{formatted}</Text>
      </View>
      {isOfflineFallback ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AMFI Feed</Text>
        </View>
      ) : null}
    </View>
  );
}
