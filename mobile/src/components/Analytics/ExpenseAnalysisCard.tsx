/**
 * @file ExpenseAnalysisCard.tsx
 * @description Renders portfolio fee drag analysis, weighted average TER, and category-level cost breakdown.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { formatIndianRupee } from '../../services/hierarchy-formatters';
import { type CategoryExpenseBreakdown } from '../../services/expense-calculation-service';

/**
 * Props for {@link ExpenseAnalysisCard}.
 */
export interface ExpenseAnalysisCardProps {
  /** Total estimated annualized fees paid in INR */
  totalAnnualFees: number;
  /** Portfolio-wide weighted average total expense ratio (%) */
  weightedAvgTer: number;
  /** Categorical fee and expense ratio breakdown */
  categoryBreakdown: CategoryExpenseBreakdown[];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  terValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
  },
  categoryName: {
    fontSize: 12,
    color: '#e4e4e7',
    flex: 2,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f4f4f5',
    flex: 1,
    textAlign: 'right',
  },
  terText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    flex: 1,
    textAlign: 'right',
  },
});

function SummaryMetrics({
  totalAnnualFees,
  weightedAvgTer,
}: {
  totalAnnualFees: number;
  weightedAvgTer: number;
}): React.ReactElement {
  return (
    <View style={styles.summaryGrid}>
      <View style={styles.metricBox}>
        <Text style={styles.metricLabel}>Annual Fee Drag</Text>
        <Text style={styles.metricValue}>{formatIndianRupee(totalAnnualFees)}</Text>
      </View>
      <View style={styles.metricBox}>
        <Text style={styles.metricLabel}>Weighted Avg TER</Text>
        <Text style={styles.terValue}>{weightedAvgTer.toFixed(2)}%</Text>
      </View>
    </View>
  );
}

function CategoryRow({ cat }: { cat: CategoryExpenseBreakdown }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.categoryName} numberOfLines={1}>
        {cat.category}
      </Text>
      <Text style={styles.feeText}>{formatIndianRupee(cat.totalFees)}</Text>
      <Text style={styles.terText}>{cat.avgTer.toFixed(2)}%</Text>
    </View>
  );
}

/**
 * Renders the expense analysis and TER fee drag breakdown component.
 *
 * @param props - Component props {@link ExpenseAnalysisCardProps}.
 * @returns React element.
 */
export function ExpenseAnalysisCard(props: ExpenseAnalysisCardProps): React.ReactElement {
  const { totalAnnualFees, weightedAvgTer, categoryBreakdown } = props;

  return (
    <View style={styles.card} testID="expense-analysis-card">
      <View style={styles.header}>
        <Receipt size={18} color="#38bdf8" />
        <Text style={styles.title}>Expense & TER Analysis</Text>
      </View>
      <SummaryMetrics totalAnnualFees={totalAnnualFees} weightedAvgTer={weightedAvgTer} />
      {categoryBreakdown.length > 0 ? (
        <>
          <Text style={styles.sectionSubtitle}>Category Cost Breakdown</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Category</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Annual Fees</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Avg TER</Text>
          </View>
          {categoryBreakdown.map((cat) => (
            <CategoryRow key={cat.category} cat={cat} />
          ))}
        </>
      ) : null}
    </View>
  );
}
