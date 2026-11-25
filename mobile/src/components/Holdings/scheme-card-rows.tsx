/**
 * @file scheme-card-rows.tsx
 * @description Sub-row and children renderer components for SchemeGroupCard.
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import {
  formatIndianRupee,
  formatPercent,
  type PerformanceMode,
  type FolioInput,
} from '@portfolio/core-view';
import { FolioChildRow } from './FolioChildRow';
import { TransactionLedgerSheet } from './TransactionLedgerSheet';

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleCol: {
    flex: 1,
    marginRight: 12,
  },
  schemeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 6,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93c5fd',
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  dayChangeRow: {
    marginTop: 4,
  },
  dayChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  pansRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  panChip: {
    backgroundColor: '#27272a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  panChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e4e4e7',
    letterSpacing: 0.5,
  },
  singleFolioText: {
    fontSize: 12,
    color: '#71717a',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#93c5fd',
  },
  childrenContainer: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

function formatDayChange(dayChange: number, dayChangePct: number | undefined): string {
  const isDayPositive = dayChange >= 0;
  const isPctPositive = (dayChangePct ?? 0) >= 0;
  const pct = dayChangePct !== undefined ? formatPercent(dayChangePct / 100) : '0.00%';
  return `${isDayPositive ? '+' : ''}${formatIndianRupee(dayChange)} (${isPctPositive ? '+' : ''}${pct})`;
}

/**
 * Top row properties for scheme card.
 */
export interface CardTopRowProps {
  /** Scheme display name */
  schemeName: string;
  /** Scheme asset type */
  schemeType: string;
  /** Current valuation in INR */
  currentValue: number;
  /** Day change in INR */
  dayChange: number;
  /** Day change percentage */
  dayChangePercentage: number | undefined;
}

/**
 * Renders the top title and valuation row of a scheme card.
 *
 * @param props Card top row props
 * @returns React Native element
 */
export function CardTopRow(props: CardTopRowProps): React.ReactElement {
  const isPositive = props.dayChange >= 0;
  const dayFormatted = formatDayChange(props.dayChange, props.dayChangePercentage);
  const style = isPositive ? styles.positive : styles.negative;

  return (
    <View style={styles.topRow}>
      <View style={styles.titleCol}>
        <Text style={styles.schemeName} numberOfLines={2}>
          {props.schemeName}
        </Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {props.schemeType.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.valueCol}>
        <Text style={styles.currentValue}>{formatIndianRupee(props.currentValue)}</Text>
        <View style={styles.dayChangeRow}>
          <Text style={[styles.dayChangeText, style]}>{dayFormatted}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Sub row properties for scheme card.
 */
export interface CardSubRowProps {
  /** Whether to render PAN chips */
  showPanBadges: boolean;
  /** Member PANs */
  pans: readonly string[];
  /** Single folio number fallback */
  singleFolioNum?: string | undefined;
  /** Multi folio indicator */
  isMultiFolio: boolean;
  /** Folio count */
  folioCount: number;
  /** Expansion state */
  isExpanded: boolean;
  /** Toggle handler */
  onToggle: () => void;
  /** Scheme identifier */
  schemeId: string;
}

/**
 * Renders the sub-row containing PAN chips or folio number and expansion button.
 *
 * @param props Card sub row props
 * @returns React Native element
 */
export function CardSubRow(props: CardSubRowProps): React.ReactElement {
  const { showPanBadges, pans, singleFolioNum, isMultiFolio, folioCount, isExpanded, onToggle, schemeId } = props;

  return (
    <View style={styles.subRow}>
      <View style={styles.pansRow}>
        {showPanBadges && pans.length > 0 ? (
          pans.map((pan) => (
            <View key={pan} style={styles.panChip} testID={`scheme-pan-chip-${pan}`}>
              <Text style={styles.panChipText}>{pan}</Text>
            </View>
          ))
        ) : singleFolioNum ? (
          <Text style={styles.singleFolioText}>Folio: {singleFolioNum}</Text>
        ) : null}
      </View>

      {isMultiFolio ? (
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={onToggle}
          testID={`scheme-expand-btn-${schemeId}`}
        >
          <Text style={styles.expandBtnText}>{folioCount} Folios</Text>
          {isExpanded ? (
            <ChevronDown size={14} color="#93c5fd" />
          ) : (
            <ChevronRight size={14} color="#93c5fd" />
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Properties for nested folio children.
 */
export interface CardChildrenProps {
  /** Array of child folios */
  folios: readonly FolioInput[];
  /** Scheme identifier */
  schemeId: string;
  /** Performance mode */
  performanceMode: PerformanceMode;
  /** Multi folio indicator */
  isMultiFolio: boolean;
  /** Expansion state */
  isExpanded: boolean;
}

/**
 * Renders nested folio children rows when expanded.
 *
 * @param props Children properties
 * @returns React Native element or null
 */
export function CardChildren(props: CardChildrenProps): React.ReactElement | null {
  const { folios, schemeId, performanceMode, isMultiFolio, isExpanded } = props;
  if (!isMultiFolio || !isExpanded) return null;

  return (
    <View style={styles.childrenContainer} testID={`scheme-children-${schemeId}`}>
      {folios.map((folio) => (
        <FolioChildRow
          key={folio.id}
          folio={folio}
          performanceMode={performanceMode}
        />
      ))}
    </View>
  );
}

/**
 * Props for {@link SingleFolioLedger}.
 */
export interface SingleFolioLedgerProps {
  /** Whether scheme has multiple folios */
  isMultiFolio: boolean;
  /** Folio number if single */
  singleFolioNum?: string | undefined;
  /** PAN if single */
  singleFolioPan?: string | undefined;
  /** Scheme display name */
  schemeName: string;
  /** Sheet visibility */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
}

/**
 * Conditionally mounts TransactionLedgerSheet for single-folio schemes.
 *
 * @param props Ledger sheet props
 * @returns React Native element or null
 */
export function SingleFolioLedger(props: SingleFolioLedgerProps): React.ReactElement | null {
  const { isMultiFolio, singleFolioNum, singleFolioPan, schemeName, visible, onClose } = props;
  if (isMultiFolio || !singleFolioNum) return null;
  return (
    <TransactionLedgerSheet
      visible={visible}
      folioNumber={singleFolioNum}
      schemeName={schemeName}
      pan={singleFolioPan}
      onClose={onClose}
    />
  );
}
