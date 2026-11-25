import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calculator } from 'lucide-react-native';
import {
  type AdvanceTaxAccrualMatrix,
} from '../../services/tax-harvesting';
import {
  buildMobileAdvanceTaxDisplayModel,
  type MobileAdvanceTaxDisplayRow,
} from '../../services/advance-tax-service';
import { formatInr } from '../../services/portfolio-service';

/**
 * Props for {@link AdvanceTaxMatrixCard}.
 */
export interface AdvanceTaxMatrixCardProps {
  /** Currently selected Financial Year */
  selectedFY: string;
  /** Quarterly Table F Advance Tax accrual matrix */
  matrix: AdvanceTaxAccrualMatrix;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  subtitle: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 14,
  },
  quarterList: {
    gap: 8,
  },
  quarterRow: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quarterInfo: {
    flex: 1,
  },
  quarterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  quarterDates: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  quarterMetrics: {
    alignItems: 'flex-end',
  },
  gainText: {
    fontSize: 12,
    color: '#e4e4e7',
  },
  taxText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f87171',
    marginTop: 2,
  },
  totalFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3f3f46',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  totalTax: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ef4444',
  },
});

/**
 * Props for {@link QuarterRowItem}.
 */
interface QuarterRowItemProps {
  /** Pre-normalized display row for a single Advance Tax quarter */
  row: MobileAdvanceTaxDisplayRow;
}

/**
 * Pure presentation row rendering a single Table F quarter, due date, gain, and tax accrual.
 *
 * @param props - Component properties {@link QuarterRowItemProps}
 * @returns React Native row element
 */
function QuarterRowItem({ row }: QuarterRowItemProps): React.ReactElement {
  return (
    <View
      style={styles.quarterRow}
      testID={`advance-tax-quarter-${row.code}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${row.code}, due ${row.dueDate}: Gain ${formatInr(row.totalGain)}, Tax ${formatInr(row.estimatedTax)}, Cumulative ${formatInr(row.cumulativeTax)}`}
    >
      <View style={styles.quarterInfo}>
        <Text style={styles.quarterName}>{row.code} · Due {row.dueDate}</Text>
        <Text style={styles.quarterDates}>{row.period}</Text>
      </View>
      <View style={styles.quarterMetrics}>
        <Text style={styles.gainText}>Gain: {formatInr(row.totalGain)}</Text>
        <Text style={styles.taxText}>
          {row.estimatedTax > 0 ? `Tax: ${formatInr(row.estimatedTax)}` : 'Nil'}
        </Text>
        {row.cumulativeTax > 0 && (
          <Text style={styles.quarterDates}>Cumul: {formatInr(row.cumulativeTax)}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * Card rendering the statutory Advance Tax Table F quarterly accrual matrix.
 *
 * @param props - Component properties {@link AdvanceTaxMatrixCardProps}
 * @returns React Native component
 */
export function AdvanceTaxMatrixCard({
  selectedFY,
  matrix,
}: AdvanceTaxMatrixCardProps): React.ReactElement {
  const { fyLabel, rows, totalTaxAllQuarters } = buildMobileAdvanceTaxDisplayModel(matrix, selectedFY);

  return (
    <View
      style={styles.card}
      testID="advance-tax-matrix-card"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Advance Tax Matrix for ${fyLabel}`}
    >
      <View style={styles.headerRow}>
        <Calculator size={18} color="#f59e0b" />
        <Text style={styles.title}>Advance Tax Table F</Text>
      </View>
      <Text style={styles.subtitle}>
        Gross Pre-Exemption Schedule CG Accruals · {fyLabel}
      </Text>

      <View style={styles.quarterList}>
        {rows.map((row) => (
          <QuarterRowItem key={row.quarterKey} row={row} />
        ))}
      </View>

      <View style={styles.totalFooter}>
        <Text style={styles.totalLabel}>Total Gross Advance Tax (Pre-Exemption)</Text>
        <Text style={styles.totalTax}>{formatInr(totalTaxAllQuarters)}</Text>
      </View>
    </View>
  );
}
