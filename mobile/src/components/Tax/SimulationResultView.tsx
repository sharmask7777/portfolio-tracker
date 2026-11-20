import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import type { SimulationSellResult } from '../../services/tax-harvesting';
import { formatInr } from '../../services/portfolio-service';

/**
 * Props for {@link SimulationResultView}.
 */
export interface SimulationResultViewProps {
  /** Calculation result returned from simulateSellRedemption */
  result: SimulationSellResult;
  /** Callback to clear results and simulate again */
  onReset: () => void;
}

const styles = StyleSheet.create({
  resultsCard: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  warningCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#fca5a5',
    flex: 1,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#3f3f46',
    marginVertical: 4,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  netValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22c55e',
  },
  resetBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#d4d4d8',
  },
});

interface MetricRowProps {
  label: string;
  value: string;
  color?: string | undefined;
}

function MetricRow({ label, value, color }: MetricRowProps): React.ReactElement {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, Boolean(color) && { color }]}>{value}</Text>
    </View>
  );
}

/**
 * Displays simulated redemption financial breakdown: proceeds, deemed cost, tax liability, exit load, and net in-hand.
 *
 * @param props - Component properties {@link SimulationResultViewProps}
 * @returns React Native component
 */
export function SimulationResultView({
  result,
  onReset,
}: SimulationResultViewProps): React.ReactElement {
  return (
    <View style={styles.resultsCard}>
      {result.warnings.length > 0 && (
        <View style={styles.warningCard} testID="elss-lock-warning">
          <AlertCircle size={16} color="#ef4444" />
          <Text style={styles.warningText}>{result.warnings.join(' ')}</Text>
        </View>
      )}

      <MetricRow label="Units Redeemed" value={result.unitsSold.toFixed(3)} />
      <MetricRow label="Gross Proceeds" value={formatInr(result.grossValue)} />
      <MetricRow label="Deemed Cost (Sec 55)" value={formatInr(result.deemedCost)} />
      <MetricRow label="Net Capital Gain" value={formatInr(result.totalGain)} color="#38bdf8" />
      <MetricRow label="Est. Total Tax (incl. Cess)" value={formatInr(result.totalTax)} color="#f87171" />

      {result.exitLoad > 0 && (
        <MetricRow label="Exit Load" value={formatInr(result.exitLoad)} color="#f87171" />
      )}

      <View style={styles.divider} />

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net In-Hand Proceeds</Text>
        <Text style={styles.netValue} testID="sim-net-proceeds">
          {formatInr(result.netProceeds)}
        </Text>
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
        <Text style={styles.resetBtnText}>Simulate Another Amount</Text>
      </TouchableOpacity>
    </View>
  );
}
