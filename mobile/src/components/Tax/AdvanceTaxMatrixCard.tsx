import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calculator } from 'lucide-react-native';
import {
  AdvanceTaxQuarter,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
} from '../../services/tax-harvesting';
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

const QUARTER_KEYS = [
  AdvanceTaxQuarter.Q1,
  AdvanceTaxQuarter.Q2A,
  AdvanceTaxQuarter.Q2B,
  AdvanceTaxQuarter.Q3,
  AdvanceTaxQuarter.Q4,
  AdvanceTaxQuarter.Q5,
] as const;

interface QuarterRowItemProps {
  quarterKey: AdvanceTaxQuarter;
  dueDate: string;
  data: TableFQuarterData;
  cumulativeTax: number;
}

function QuarterRowItem({
  quarterKey,
  dueDate,
  data,
  cumulativeTax,
}: QuarterRowItemProps): React.ReactElement {
  const parts = quarterKey.split(' ');
  const code = parts[0] ?? quarterKey;
  const period = parts.slice(1).join(' ');

  return (
    <View
      style={styles.quarterRow}
      testID={`advance-tax-quarter-${code}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${code}, due ${dueDate}: Gain ${formatInr(data.totalGain)}, Tax ${formatInr(data.estimatedTax)}, Cumulative ${formatInr(cumulativeTax)}`}
    >
      <View style={styles.quarterInfo}>
        <Text style={styles.quarterName}>{code} · Due {dueDate}</Text>
        <Text style={styles.quarterDates}>{period}</Text>
      </View>
      <View style={styles.quarterMetrics}>
        <Text style={styles.gainText}>Gain: {formatInr(data.totalGain)}</Text>
        <Text style={styles.taxText}>
          {data.estimatedTax > 0 ? `Tax: ${formatInr(data.estimatedTax)}` : 'Nil'}
        </Text>
        {cumulativeTax > 0 && (
          <Text style={styles.quarterDates}>Cumul: {formatInr(cumulativeTax)}</Text>
        )}
      </View>
    </View>
  );
}

function resolveQuarterDueDates(selectedFY: string): Record<AdvanceTaxQuarter, string> {
  const yearMatch = selectedFY.match(/(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1] ?? '', 10) : NaN;
  const hasValidYear = Number.isFinite(startYear);
  const endYear = hasValidYear ? startYear + 1 : NaN;

  return {
    [AdvanceTaxQuarter.Q1]: hasValidYear ? `15/06/${startYear}` : '15/06',
    [AdvanceTaxQuarter.Q2A]: hasValidYear ? `15/09/${startYear}` : '15/09',
    [AdvanceTaxQuarter.Q2B]: hasValidYear ? `15/09/${startYear}` : '15/09',
    [AdvanceTaxQuarter.Q3]: hasValidYear ? `15/12/${startYear}` : '15/12',
    [AdvanceTaxQuarter.Q4]: hasValidYear ? `15/03/${endYear}` : '15/03',
    [AdvanceTaxQuarter.Q5]: hasValidYear ? `31/03/${endYear}` : '31/03',
  };
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
  const dueDates = resolveQuarterDueDates(selectedFY);
  let runningCumulativeTax = 0;
  const rows = QUARTER_KEYS.map((quarterKey) => {
    const qData = matrix.quarters[quarterKey];
    const tax = Number.isFinite(qData?.estimatedTax) ? qData.estimatedTax : 0;
    runningCumulativeTax += tax;
    return {
      quarterKey,
      dueDate: dueDates[quarterKey],
      qData,
      cumul: runningCumulativeTax,
    };
  });

  return (
    <View
      style={styles.card}
      testID="advance-tax-matrix-card"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Advance Tax Matrix for FY ${selectedFY}`}
    >
      <View style={styles.headerRow}>
        <Calculator size={18} color="#f59e0b" />
        <Text style={styles.title}>Advance Tax Table F</Text>
      </View>
      <Text style={styles.subtitle}>
        Quarterly Schedule CG Accruals · FY {selectedFY}
      </Text>

      <View style={styles.quarterList}>
        {rows.map((row) => (
          <QuarterRowItem
            key={row.quarterKey}
            quarterKey={row.quarterKey}
            dueDate={row.dueDate}
            data={row.qData}
            cumulativeTax={row.cumul}
          />
        ))}
      </View>

      <View style={styles.totalFooter}>
        <Text style={styles.totalLabel}>Total Advance Tax Payable</Text>
        <Text style={styles.totalTax}>{formatInr(runningCumulativeTax)}</Text>
      </View>
    </View>
  );
}
