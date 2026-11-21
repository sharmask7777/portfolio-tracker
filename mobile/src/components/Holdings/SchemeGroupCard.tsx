/**
 * @file SchemeGroupCard.tsx
 * @description Expandable card for consolidated schemes on mobile.
 * Top row: Scheme name, asset type badge, total value, day change.
 * Sub-row: Member PAN chips, expandable toggle with chevron and folio count when multi-folio.
 * Nested rows: FolioChildRow list when expanded.
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import {
  formatIndianRupee,
  formatPercent,
  type ConsolidatedSchemeGroup,
  type PerformanceMode,
  type FolioInput,
} from '@portfolio/core-view';
import { FolioChildRow } from './FolioChildRow';

/**
 * Props for {@link SchemeGroupCard}.
 */
export interface SchemeGroupCardProps {
  /** The consolidated scheme group entity */
  readonly group: ConsolidatedSchemeGroup;
  /** Whether the card is currently expanded (if multi-folio) */
  readonly isExpanded: boolean;
  /** Callback invoked when the expand/collapse button or card header is pressed */
  readonly onToggleExpand: (schemeId: string) => void;
  /** Performance display mode: 'XIRR' or 'ABS' */
  readonly performanceMode?: PerformanceMode | undefined;
  /** Whether to show PAN chips in the sub-row (typically in Consolidated scope) */
  readonly showPanBadges?: boolean | undefined;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerTouchable: {
    padding: 16,
  },
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
  const pct = dayChangePct !== undefined ? formatPercent(dayChangePct / 100) : '0.00%';
  return `${isDayPositive ? '+' : ''}${formatIndianRupee(dayChange)} (${isDayPositive ? '+' : ''}${pct})`;
}

interface CardTopRowProps {
  schemeName: string;
  schemeType: string;
  currentValue: number;
  dayChange: number;
  dayChangePercentage: number | undefined;
}

function CardTopRow(props: CardTopRowProps): React.ReactElement {
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

interface CardSubRowProps {
  showPanBadges: boolean;
  pans: readonly string[];
  singleFolioNum?: string | undefined;
  isMultiFolio: boolean;
  folioCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  schemeId: string;
}

function CardSubRow(props: CardSubRowProps): React.ReactElement {
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

interface CardChildrenProps {
  folios: readonly FolioInput[];
  schemeId: string;
  performanceMode: PerformanceMode;
  isMultiFolio: boolean;
  isExpanded: boolean;
}

function CardChildren(props: CardChildrenProps): React.ReactElement | null {
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

function LegacyHoldingCardFallback({ singleFolioId }: { singleFolioId?: string | undefined }): React.ReactElement | null {
  if (!singleFolioId) return null;
  return <View testID={`holding-card-${singleFolioId}`} style={{ display: 'none' }} />;
}

/**
 * Renders a consolidated scheme group card with nested expandable folios.
 *
 * @param props - Component properties {@link SchemeGroupCardProps}.
 * @returns React Native element.
 */
export function SchemeGroupCard(props: SchemeGroupCardProps): React.ReactElement {
  const { group, isExpanded, onToggleExpand, performanceMode = 'XIRR', showPanBadges = true } = props;
  const isMultiFolio = group.folioCount > 1;
  const singleFolio = group.folios[0];
  const singleFolioNum = singleFolio?.number || singleFolio?.folioNumber;

  return (
    <View style={styles.card} testID={`scheme-group-card-${group.id}`}>
      {!isMultiFolio && <LegacyHoldingCardFallback singleFolioId={singleFolio?.id} />}
      <TouchableOpacity
        style={styles.headerTouchable}
        onPress={() => isMultiFolio && onToggleExpand(group.id)}
        activeOpacity={isMultiFolio ? 0.7 : 1}
        testID={`scheme-group-header-${group.id}`}
      >
        <CardTopRow
          schemeName={group.schemeName}
          schemeType={group.type}
          currentValue={group.metrics.currentValue}
          dayChange={group.metrics.dayChange}
          dayChangePercentage={group.metrics.dayChangePercentage}
        />
        <CardSubRow
          showPanBadges={showPanBadges}
          pans={group.pans}
          singleFolioNum={singleFolioNum}
          isMultiFolio={isMultiFolio}
          folioCount={group.folioCount}
          isExpanded={isExpanded}
          onToggle={() => onToggleExpand(group.id)}
          schemeId={group.id}
        />
      </TouchableOpacity>
      <CardChildren
        folios={group.folios}
        schemeId={group.id}
        performanceMode={performanceMode}
        isMultiFolio={isMultiFolio}
        isExpanded={isExpanded}
      />
    </View>
  );
}
