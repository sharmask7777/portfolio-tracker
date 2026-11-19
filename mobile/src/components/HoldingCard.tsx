import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatInr,
  formatPct,
  type EnrichedHolding,
} from '../services/portfolio-service';

/**
 * Props for {@link HoldingCard}.
 */
export interface HoldingCardProps {
  /** Enriched holding entity with latest NAV, current value, and day change */
  holding: EnrichedHolding;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  schemeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    flex: 1,
    marginRight: 12,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  folio: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  unitsNav: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  dayGain: {
    fontSize: 12,
    fontWeight: '600',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

/**
 * Card displaying a single mutual fund scheme holding with current value, units, NAV, and day change.
 *
 * @param props - Component properties {@link HoldingCardProps}
 * @returns React Native element
 */
export function HoldingCard({ holding }: HoldingCardProps): React.ReactElement {
  const isDayPositive = holding.dayChange >= 0;
  const dayStyle = isDayPositive ? styles.positive : styles.negative;
  const dayFormatted = `${formatInr(holding.dayChange)} (${formatPct(holding.dayChangePct)})`;
  const unitsFormatted = `${holding.units.toFixed(3)} units @ ₹${holding.current_nav.toFixed(2)}`;

  return (
    <View style={styles.card} testID={`holding-card-${holding.id}`}>
      <View style={styles.topRow}>
        <Text style={styles.schemeName} numberOfLines={2}>
          {holding.scheme_name}
        </Text>
        <Text style={styles.currentValue}>{formatInr(holding.current_value)}</Text>
      </View>

      <Text style={styles.folio}>Folio: {holding.folio_number}</Text>

      <View style={styles.bottomRow}>
        <Text style={styles.unitsNav}>{unitsFormatted}</Text>
        <Text style={[styles.dayGain, dayStyle]}>{dayFormatted}</Text>
      </View>
    </View>
  );
}
