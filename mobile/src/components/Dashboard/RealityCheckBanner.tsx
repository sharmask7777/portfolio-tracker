import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Zap, ShieldAlert, SlidersHorizontal } from 'lucide-react-native';
import {
  calculateRealityCheckMetrics,
  type RealityCheckAssumptions,
  type DragWaterfallStage,
} from '../../services/reality-check-service';

const styles = StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 12,
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    marginLeft: 8,
  },
  assumptionsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  assumptionsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 4,
  },
  purchasingPowerRow: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    marginBottom: 14,
  },
  ppLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 4,
    fontWeight: '500',
  },
  ppValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  ppValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10b981',
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
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  waterfallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
  },
  waterfallLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterfallStep: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
    marginRight: 6,
    width: 14,
  },
  waterfallLabel: {
    fontSize: 13,
    color: '#f4f4f5',
    fontWeight: '500',
  },
  waterfallRate: {
    fontSize: 13,
    fontWeight: '700',
  },
  waterfallRateNominal: {
    color: '#3b82f6',
  },
  waterfallRateDrag: {
    color: '#ef4444',
  },
  waterfallRateReal: {
    color: '#10b981',
    fontWeight: '800',
  },
  invariantBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    padding: 10,
    marginBottom: 10,
  },
  invariantText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    lineHeight: 15,
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
  assumptions: RealityCheckAssumptions;
  onOpenAssumptions?: (() => void) | undefined;
}

/**
 * Renders a single stage row within the drag waterfall.
 *
 * @param item Stage details
 * @returns React Native waterfall item element
 */
function WaterfallRow({ item }: { item: DragWaterfallStage }): React.ReactElement {
  const isDrag = item.drag < 0;
  const isReal = item.step === 5;
  const isNominal = item.step === 1 || item.step === 3;

  return (
    <View key={item.step} style={styles.waterfallRow}>
      <View style={styles.waterfallLabelRow}>
        <Text style={styles.waterfallStep}>{item.step}.</Text>
        <Text style={styles.waterfallLabel}>{item.label}</Text>
      </View>
      <Text
        style={[
          styles.waterfallRate,
          isDrag && styles.waterfallRateDrag,
          isReal && styles.waterfallRateReal,
          isNominal && styles.waterfallRateNominal,
        ]}
      >
        {isDrag ? `-${(item.rate * 100).toFixed(2)}%` : formatPct(item.rate)}
      </Text>
    </View>
  );
}

/**
 * Renders banner header with Zap icon and assumptions chip.
 *
 * @param props Header props
 * @returns React Native element
 */
export function BannerHeader({
  assumptions,
  onOpenAssumptions,
}: {
  assumptions: RealityCheckAssumptions;
  onOpenAssumptions?: (() => void) | undefined;
}): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Zap size={16} color="#f59e0b" />
        <Text style={styles.title}>Reality Check Teardown</Text>
      </View>
      {onOpenAssumptions && (
        <TouchableOpacity
          style={styles.assumptionsChip}
          onPress={onOpenAssumptions}
          accessibilityRole="button"
          testID="banner-assumptions-chip"
        >
          <SlidersHorizontal size={12} color="#f59e0b" />
          <Text style={styles.assumptionsText}>
            CPI {(assumptions.inflationRate * 100).toFixed(0)}% · Tax {(assumptions.taxRate * 100).toFixed(0)}%
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
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
  assumptions,
  onOpenAssumptions,
}: RealityCheckBannerProps): React.ReactElement {
  const result = calculateRealityCheckMetrics({
    currentValue: nominalValue,
    investedCost,
    nominalReturn: nominalReturnPct,
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
