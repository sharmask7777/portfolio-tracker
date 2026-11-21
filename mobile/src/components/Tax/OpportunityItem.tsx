import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { HarvestOpportunity } from '../../services/tax-harvesting';
import { formatInr } from '../../services/portfolio-service';

/**
 * Props for {@link OpportunityItem}.
 */
export interface OpportunityItemProps {
  /** Individual harvest opportunity record */
  opportunity: HarvestOpportunity;
  /** Callback to simulate redemption */
  onSimulate?: ((op: HarvestOpportunity) => void) | undefined;
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  schemeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
    flex: 1,
    marginRight: 8,
  },
  folioText: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  gainBadge: {
    alignItems: 'flex-end',
  },
  gainLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    textTransform: 'uppercase',
  },
  gainValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3f3f46',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 11,
    color: '#71717a',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e4e4e7',
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});

interface MetricsGridProps {
  unitsToHarvest: number;
  currentNav: number;
  currentValue: number;
}

function MetricsGrid({ unitsToHarvest, currentNav, currentValue }: MetricsGridProps): React.ReactElement {
  return (
    <View style={styles.metricsGrid}>
      <View>
        <Text style={styles.metricLabel}>Units to Harvest</Text>
        <Text style={styles.metricVal}>{unitsToHarvest.toFixed(3)}</Text>
      </View>
      <View>
        <Text style={styles.metricLabel}>Current NAV</Text>
        <Text style={styles.metricVal}>{formatInr(currentNav)}</Text>
      </View>
      <View>
        <Text style={styles.metricLabel}>Approx Value</Text>
        <Text style={styles.metricVal}>{formatInr(currentValue)}</Text>
      </View>
    </View>
  );
}

/**
 * Individual opportunity card displaying potential tax-free LTCG and simulate redemption button.
 *
 * @param props - Component properties {@link OpportunityItemProps}
 * @returns React Native component
 */
export function OpportunityItem({
  opportunity,
  onSimulate,
}: OpportunityItemProps): React.ReactElement {
  return (
    <View
      style={styles.itemCard}
      testID={`harvest-item-${opportunity.folioId}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Harvest Opportunity for ${opportunity.schemeName}. Tax-free gain: ${formatInr(opportunity.unrealizedGain)}`}
    >
      <View style={styles.itemHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.schemeName} numberOfLines={2}>{opportunity.schemeName}</Text>
          <Text style={styles.folioText}>Folio: {opportunity.folioId}</Text>
        </View>
        <View style={styles.gainBadge}>
          <Text style={styles.gainLabel}>Tax-Free Gain</Text>
          <Text style={styles.gainValue}>{formatInr(opportunity.unrealizedGain)}</Text>
        </View>
      </View>

      <MetricsGrid
        unitsToHarvest={opportunity.unitsToHarvest}
        currentNav={opportunity.currentNav}
        currentValue={opportunity.currentValue}
      />

      <TouchableOpacity
        style={styles.actionBtn}
        testID={`simulate-harvest-btn-${opportunity.folioId}`}
        onPress={() => onSimulate?.(opportunity)}
        accessibilityRole="button"
        accessibilityLabel={`Simulate redemption for ${opportunity.schemeName}`}
      >
        <Text style={styles.actionBtnText}>Simulate Sell</Text>
        <ChevronRight size={14} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
