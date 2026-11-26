import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import type { DragDecompositionDto } from '../../types/generated';
import {
  calculateRealityCheckMetrics,
  type RealityCheckAssumptions,
} from '../../services/reality-check-service';
import { WaterfallRow, BannerHeader } from './RealityCheckRow';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    marginBottom: 20,
  },
  purchasingPowerRow: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  ppLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ppValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  ppValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  ppErosion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  waterfallSection: {
    marginBottom: 14,
  },
  waterfallTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  invariantBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 10,
    marginBottom: 10,
  },
  invariantText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
  benchmarkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 10,
  },
  benchmarkText: {
    fontSize: 11,
    color: '#a1a1aa',
    marginLeft: 8,
    flex: 1,
  },
  benchmarkSpread: {
    fontSize: 12,
    fontWeight: '700',
  },
});

function formatInr(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

function formatPct(val: number): string {
  const sign = val > 0 ? '+' : '';
  return sign + (val * 100).toFixed(2) + '%';
}

/**
 * Properties for {@link RealityCheckBanner}.
 */
export interface RealityCheckBannerProps {
  nominalValue: number;
  investedCost: number;
  nominalReturnPct?: number | undefined;
  drags?: DragDecompositionDto | null | undefined;
  assumptions: RealityCheckAssumptions;
  onOpenAssumptions?: (() => void) | undefined;
}

/**
 * Reality Check banner displaying sequential return drag decomposition,
 * real purchasing power adjusted net worth, and statutory invariants.
 *
 * @param props Banner data and settings
 * @returns React Native reality check banner element
 */
export function RealityCheckBanner({
  nominalValue,
  investedCost,
  nominalReturnPct,
  drags,
  assumptions,
  onOpenAssumptions,
}: RealityCheckBannerProps): React.ReactElement {
  const result = calculateRealityCheckMetrics({
    currentValue: nominalValue,
    investedCost,
    nominalReturn: nominalReturnPct,
    drags,
    assumptions,
  });

  const spreadColor = result.benchmarkSpread >= 0 ? '#10b981' : '#ef4444';

  return (
    <View style={styles.card} testID="reality-check-banner">
      <BannerHeader assumptions={assumptions} onOpenAssumptions={onOpenAssumptions} />

      <View style={styles.purchasingPowerRow}>
        <Text style={styles.ppLabel}>Real Post-Tax Purchasing Power ({assumptions.horizonYears}Y Horizon)</Text>
        <View style={styles.ppValueRow}>
          <Text style={styles.ppValue}>{formatInr(result.purchasingPowerValue)}</Text>
          <Text style={styles.ppErosion}>-{formatInr(result.purchasingPowerLoss)} Drag</Text>
        </View>
      </View>

      <View style={styles.waterfallSection}>
        <Text style={styles.waterfallTitle}>Drag Waterfall</Text>
        {result.dragWaterfall.map((item) => (
          <WaterfallRow key={item.step} item={item} />
        ))}
      </View>

      <View style={styles.invariantBox}>
        <Text style={styles.invariantText}>
          Statutory Invariant Holds: Real ({(result.realPostTaxReturn * 100).toFixed(2)}%)
          {' \u2264 '}Post-Tax ({(result.postTaxReturn * 100).toFixed(2)}%)
          {' \u2264 '}Nominal ({(result.nominalReturn * 100).toFixed(2)}%)
        </Text>
      </View>

      <View style={styles.benchmarkBox}>
        <ShieldAlert size={14} color="#3b82f6" />
        <Text style={styles.benchmarkText}>Safe-Asset Spread (vs 6.5% FD minus tax & CPI):</Text>
        <Text style={[styles.benchmarkSpread, { color: spreadColor }]}>{formatPct(result.benchmarkSpread)}</Text>
      </View>
    </View>
  );
}
