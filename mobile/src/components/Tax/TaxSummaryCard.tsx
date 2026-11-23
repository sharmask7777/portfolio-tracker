import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TaxCalculationsResult } from '../../services/tax-harvesting';
import { formatInr } from '../../services/portfolio-service';
import {
  SummaryHeader,
  HeroTaxBlock,
  ExemptionTracker,
  BreakdownSection,
} from './tax-summary-subcomponents';

/**
 * Props for {@link TaxSummaryCard}.
 */
export interface TaxSummaryCardProps {
  /** Currently selected Financial Year (e.g. '2024-25') */
  selectedFY: string;
  /** Calculated capital gains and statutory tax breakdown result */
  taxResult: TaxCalculationsResult;
  /** Remaining Section 112A statutory tax-free exemption amount in INR */
  remainingExemption: number;
  /** Callback when user changes the active financial year */
  onFYChange?: ((fy: string) => void) | undefined;
  /** Available FY choices for quick selection */
  availableFYs?: string[] | undefined;
  /** Optional callback to export Schedule CG CSV */
  onExportScheduleCg?: (() => void) | undefined;
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
});

/**
 * Renders the Realized Capital Gains breakdown card with statutory exemption tracker and tax rates.
 *
 * @param props - Component properties {@link TaxSummaryCardProps}
 * @returns React Native component
 */
export function TaxSummaryCard({
  selectedFY,
  taxResult,
  remainingExemption,
  onFYChange,
  availableFYs = ['2024-25', '2023-24'],
  onExportScheduleCg,
}: TaxSummaryCardProps): React.ReactElement {
  return (
    <View
      style={styles.card}
      testID="tax-summary-card"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Tax Summary for FY ${selectedFY}. Net Tax Liability: ${formatInr(taxResult.grandTotalTax)}`}
    >
      <SummaryHeader selectedFY={selectedFY} availableFYs={availableFYs} onFYChange={onFYChange} />
      <HeroTaxBlock
        grandTotalTax={taxResult.grandTotalTax}
        baseTaxTotal={taxResult.baseTaxTotal}
        cessTotal={taxResult.cessTotal}
      />
      <ExemptionTracker
        ltcgExemptClaimed={taxResult.ltcgExemptClaimed}
        ltcgLimit={taxResult.ltcgLimit}
        remainingExemption={remainingExemption}
        ltcgPercent={taxResult.ltcgPercent}
      />
      <BreakdownSection taxResult={taxResult} onExportScheduleCg={onExportScheduleCg} />
    </View>
  );
}
