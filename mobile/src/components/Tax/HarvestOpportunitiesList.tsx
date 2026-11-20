import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { TrendingDown, Copy, Check, FileText } from 'lucide-react-native';
import type { HarvestPlan } from '../../services/tax-harvesting';
import { formatInr } from '../../services/portfolio-service';
import { OpportunityItem, type OpportunityItemProps } from './OpportunityItem';

/**
 * Props for {@link HarvestOpportunitiesList}.
 */
export interface HarvestOpportunitiesListProps {
  /** Complete tax-free harvesting recommendation plan */
  plan: HarvestPlan;
  /** Callback triggered when user chooses to simulate sell for a specific opportunity */
  onSimulateHarvest?: OpportunityItemProps['onSimulate'];
  /** Callback triggered when user clicks to copy or share instructions */
  onCopyInstructions?: ((instructions: string) => void) | undefined;
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
  header: {
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
  savingsBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  description: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 14,
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  emptyState: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  instructionsText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#a1a1aa',
    lineHeight: 14,
  },
  instructionsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineBtnText: {
    fontSize: 11,
    color: '#d4d4d8',
    fontWeight: '500',
  },
});

interface HarvestHeaderProps {
  fy: string;
  estimatedTaxSavings: number;
  totalPotentialHarvest: number;
  remainingExemption: number;
}

function HarvestHeader({
  fy,
  estimatedTaxSavings,
  totalPotentialHarvest,
  remainingExemption,
}: HarvestHeaderProps): React.ReactElement {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <TrendingDown size={18} color="#22c55e" />
          <Text style={styles.title}>Tax-Free Harvesting</Text>
        </View>
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsText}>Save {formatInr(estimatedTaxSavings)}</Text>
        </View>
      </View>
      <Text style={styles.description}>
        Harvest up to {formatInr(totalPotentialHarvest)} in long-term gains tax-free within your
        remaining {formatInr(remainingExemption)} exemption limit for FY {fy}.
      </Text>
    </>
  );
}

interface InstructionsSectionProps {
  instructions: string;
  onCopyInstructions?: ((instructions: string) => void) | undefined;
}

function InstructionsSection({
  instructions,
  onCopyInstructions,
}: InstructionsSectionProps): React.ReactElement {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyInstructions?.(instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <View style={styles.instructionsActions}>
        <TouchableOpacity
          style={styles.outlineBtn}
          testID="toggle-instructions-btn"
          onPress={() => setShow((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Toggle Harvesting Instructions"
        >
          <FileText size={14} color="#a1a1aa" />
          <Text style={styles.outlineBtnText}>{show ? 'Hide Instructions' : 'View Instructions'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineBtn}
          testID="copy-instructions-btn"
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel="Copy Harvesting Instructions"
        >
          {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} color="#a1a1aa" />}
          <Text style={[styles.outlineBtnText, copied && { color: '#22c55e' }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>
      {show && (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsText}>{instructions}</Text>
        </View>
      )}
    </>
  );
}

/**
 * Renders the Section 112A Tax Loss & Tax-Free Harvesting opportunities list.
 *
 * @param props - Component properties {@link HarvestOpportunitiesListProps}
 * @returns React Native component
 */
export function HarvestOpportunitiesList({
  plan,
  onSimulateHarvest,
  onCopyInstructions,
}: HarvestOpportunitiesListProps): React.ReactElement {
  return (
    <View style={styles.card} testID="harvest-opportunities-list">
      <HarvestHeader
        fy={plan.fy}
        estimatedTaxSavings={plan.estimatedTaxSavings}
        totalPotentialHarvest={plan.totalPotentialHarvest}
        remainingExemption={plan.remainingExemption}
      />

      {plan.opportunities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No eligible tax harvesting opportunities found for this financial year.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {plan.opportunities.map((opp) => (
            <OpportunityItem
              key={opp.folioId}
              opportunity={opp}
              onSimulate={onSimulateHarvest}
            />
          ))}
        </View>
      )}

      <InstructionsSection
        instructions={plan.instructions}
        onCopyInstructions={onCopyInstructions}
      />
    </View>
  );
}
