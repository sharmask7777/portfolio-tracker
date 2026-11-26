import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Zap, SlidersHorizontal } from 'lucide-react-native';
import type { DragWaterfallStage, RealityCheckAssumptions } from '../../services/reality-check-service';

const styles = StyleSheet.create({
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
  waterfallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39, 39, 42, 0.5)',
  },
  waterfallLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterfallStep: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    width: 18,
  },
  waterfallLabel: {
    fontSize: 13,
    color: '#d4d4d8',
  },
  waterfallRate: {
    fontSize: 13,
    fontWeight: '600',
  },
  waterfallRateDrag: {
    color: '#ef4444',
  },
  waterfallRateReal: {
    color: '#10b981',
    fontWeight: '700',
  },
  waterfallRateNominal: {
    color: '#60a5fa',
    fontWeight: '700',
  },
});

function formatPct(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${(rate * 100).toFixed(2)}%`;
}

/**
 * Renders an individual waterfall step row.
 *
 * @param props Waterfall item props
 * @returns React Native element
 */
export function WaterfallRow({ item }: { item: DragWaterfallStage }): React.ReactElement {
  const isDrag = item.drag < 0;
  const isReal = item.step === 6;
  const isNominal = item.step === 1;

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
