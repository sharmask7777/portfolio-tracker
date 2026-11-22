/**
 * @file tax-summary-subcomponents.tsx
 * @description Sub-components for TaxSummaryCard.
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShieldCheck, Share2 } from 'lucide-react-native';
import { formatInr } from '../../services/portfolio-service';
import { type TaxCalculationsResult } from '../../services/tax-harvesting';
import { FYDropdownPicker } from './FYDropdownPicker';

const styles = StyleSheet.create({
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    marginTop: 14,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
});

/**
 * Header of tax summary card.
 *
 * @param props - Component props.
 * @returns React element.
 */
export function SummaryHeader({
  selectedFY,
  availableFYs,
  onFYChange,
}: {
  selectedFY: string;
  availableFYs: string[];
  onFYChange?: ((fy: string) => void) | undefined;
}): React.ReactElement {
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

/**
 * Hero tax block displaying net liability.
 *
 * @param props - Hero tax block props.
 * @returns React element.
 */
export function HeroTaxBlock({
  grandTotalTax,
  baseTaxTotal,
  cessTotal,
}: {
  grandTotalTax: number;
  baseTaxTotal: number;
  cessTotal: number;
}): React.ReactElement {
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
 * Section 112A exemption tracker component.
 *
 * @param props - Tracker props.
 * @returns React element.
 */
export function ExemptionTracker({
  ltcgExemptClaimed,
  ltcgLimit,
  remainingExemption,
  ltcgPercent,
}: {
  ltcgExemptClaimed: number;
  ltcgLimit: number;
  remainingExemption: number;
  ltcgPercent: number;
}): React.ReactElement {
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

function GainRow({
  label,
  rateLabel,
  gain,
  tax,
}: {
  label: string;
  rateLabel: string;
  gain: number;
  tax: number;
}): React.ReactElement {
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

/**
 * Gain and tax breakdown list section.
 *
 * @param props - Breakdown props.
 * @returns React element.
 */
export function BreakdownSection({
  taxResult,
  onExportScheduleCg,
}: {
  taxResult: TaxCalculationsResult;
  onExportScheduleCg?: (() => void) | undefined;
}): React.ReactElement {
  return (
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
      {onExportScheduleCg ? (
        <TouchableOpacity
          style={styles.exportBtn}
          testID="export-schedule-cg-btn"
          onPress={onExportScheduleCg}
          accessibilityRole="button"
          accessibilityLabel="Export Schedule CG CSV"
        >
          <Share2 size={14} color="#38bdf8" />
          <Text style={styles.exportBtnText}>Export Schedule CG (CSV)</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
