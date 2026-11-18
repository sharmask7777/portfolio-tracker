import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatInr, type AssetAllocationItem } from '../services/portfolio-service';

export interface AssetAllocationCardProps {
  allocation: AssetAllocationItem[];
  totalValue: number;
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
  header: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 14,
  },
  barContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#27272a',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  barSegment: {
    height: '100%',
  },
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  className: {
    fontSize: 13,
    color: '#d4d4d8',
  },
  percentBadge: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  classAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
    fontStyle: 'italic',
  },
});

function renderAllocationRow(item: AssetAllocationItem): React.ReactElement {
  return (
    <View key={item.name} style={styles.legendRow}>
      <View style={styles.legendLabelGroup}>
        <View style={[styles.dot, { backgroundColor: item.color }]} />
        <Text style={styles.className}>{item.name}</Text>
        <Text style={styles.percentBadge}>{item.percentage}%</Text>
      </View>
      <Text style={styles.classAmount}>{formatInr(item.amount)}</Text>
    </View>
  );
}

export function AssetAllocationCard({
  allocation,
  totalValue: _totalValue,
}: AssetAllocationCardProps): React.ReactElement {
  return (
    <View style={styles.card} testID="asset-allocation-card">
      <Text style={styles.header}>Asset Allocation</Text>

      {allocation.length === 0 ? (
        <Text style={styles.emptyText}>No asset allocation data available</Text>
      ) : (
        <>
          <View style={styles.barContainer}>
            {allocation.map((item) => (
              <View
                key={item.name}
                style={[
                  styles.barSegment,
                  {
                    backgroundColor: item.color,
                    flex: item.percentage > 0 ? item.percentage : 1,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.legend}>
            {allocation.map((item) => renderAllocationRow(item))}
          </View>
        </>
      )}
    </View>
  );
}
