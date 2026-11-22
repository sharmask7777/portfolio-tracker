import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import type { TaxCalculationsResult } from '../../services/tax-harvesting';
import { formatInr } from '../../services/portfolio-service';
import { FYDropdownPicker } from './FYDropdownPicker';

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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  heroBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ef4444',
  },
  heroSub: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 4,
  },
  exemptionBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exemptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  exemptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
  },
  exemptionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#0f172a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
  },
  exemptionFootnote: {
    fontSize: 11,
    color: '#94a3b8',
  },
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#d4d4d8',
  },
  breakdownSub: {
    fontSize: 11,
    color: '#71717a',
  },
  breakdownValueCol: {
    alignItems: 'flex-end',
  },
  gainVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  taxVal: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '500',
  },
});

interface GainRowProps {
  label: string;
  rateLabel: string;
  gain: number;
  tax: number;
}

function GainRow({ label, rateLabel, gain, tax }: GainRowProps): React.ReactElement {
  return (
    <View style={styles.breakdownRow}>
      <View>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text style={styles.breakdownSub}>{rateLabel}</Text>
      </View>
      <View style={styles.breakdownValueCol}>
        <Text style={styles.gainVal}>{formatInr(gain)}</Text>
        <Text style={styles.taxVal}>Tax: {formatInr(tax)}</Text>
      </View>
    </View>
  );
}

interface ExemptionTrackerProps {
  ltcgExemptClaimed: number;
  ltcgLimit: number;
  remainingExemption: number;
  ltcgPercent: number;
}

function ExemptionTracker({
  ltcgExemptClaimed,
  ltcgLimit,
  remainingExemption,
  ltcgPercent,
}: ExemptionTrackerProps): React.ReactElement {
  const clampedPct = Math.min(100, Math.max(0, ltcgPercent));
  return (
    <View style={styles.exemptionBox}>
      <View style={styles.exemptionHeader}>
        <Text style={styles.exemptionTitle}>Sec 112A ₹1.25L Exemption</Text>
        <Text style={styles.exemptionValue}>
          {formatInr(ltcgExemptClaimed)} / {formatInr(ltcgLimit)}
        </Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${clampedPct}%` }]} />
      </View>
      <Text style={styles.exemptionFootnote}>
        Remaining tax-free limit: {formatInr(remainingExemption)} ({clampedPct.toFixed(0)}% used)
      </Text>
    </View>
  );
}

interface SummaryHeaderProps {
  selectedFY: string;
  availableFYs: string[];
  onFYChange?: ((fy: string) => void) | undefined;
}

function SummaryHeader({ selectedFY, availableFYs, onFYChange }: SummaryHeaderProps): React.ReactElement {
  return (
    <View style={styles.headerRow}>
      <View style={styles.titleGroup}>
        <ShieldCheck size={20} color="#3b82f6" />
        <Text style={styles.title}>Tax & Capital Gains</Text>
      </View>
      <FYDropdownPicker
        selectedFY={selectedFY}
        availableFYs={availableFYs}
        onFYChange={onFYChange}
      />
    </View>
  );
}

interface HeroTaxBlockProps {
  grandTotalTax: number;
  baseTaxTotal: number;
  cessTotal: number;
}

function HeroTaxBlock({ grandTotalTax, baseTaxTotal, cessTotal }: HeroTaxBlockProps): React.ReactElement {
  return (
    <View style={styles.heroBlock}>
      <Text style={styles.heroLabel}>Net Tax Liability (incl. 4% Cess)</Text>
      <Text style={styles.heroAmount}>{formatInr(grandTotalTax)}</Text>
      <Text style={styles.heroSub}>
        Base: {formatInr(baseTaxTotal)} · Cess: {formatInr(cessTotal)}
      </Text>
    </View>
  );
}

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
      <View style={styles.breakdownList}>
        <GainRow
          label="Equity LTCG"
          rateLabel="12.5% statutory (post-July 23, 2024)"
          gain={taxResult.totalEquityLTCG}
          tax={taxResult.ltcgTotalTax}
        />
        <GainRow
          label="Equity STCG"
          rateLabel="20% statutory (post-July 23, 2024)"
          gain={taxResult.totalSTCG111A}
          tax={taxResult.stcgTotalTax}
        />
        <GainRow
          label="Section 50AA Slab Debt"
          rateLabel="Applicable slab rate"
          gain={taxResult.slabGain}
          tax={taxResult.slabTotalTax}
        />
      </View>
    </View>
  );
}
