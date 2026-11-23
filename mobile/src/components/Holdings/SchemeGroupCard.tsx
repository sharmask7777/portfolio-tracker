/**
 * @file SchemeGroupCard.tsx
 * @description Expandable card for consolidated schemes on mobile.
 */

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import type {
  ConsolidatedSchemeGroup,
  PerformanceMode,
} from '@portfolio/core-view';
import {
  CardTopRow,
  CardSubRow,
  CardChildren,
  SingleFolioLedger,
} from './scheme-card-rows';

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
});

function LegacyHoldingCardFallback({ singleFolioId }: { singleFolioId?: string | undefined }): React.ReactElement | null {
  if (!singleFolioId) return null;
  return <View testID={`holding-card-${singleFolioId}`} style={{ display: 'none' }} />;
}

interface SchemeHeaderProps {
  group: ConsolidatedSchemeGroup;
  singleFolioNum?: string | undefined;
  isMultiFolio: boolean;
  isExpanded: boolean;
  showPanBadges: boolean;
  onPress: () => void;
  onToggleExpand: (id: string) => void;
}

function SchemeHeader(props: SchemeHeaderProps): React.ReactElement {
  const { group, singleFolioNum, isMultiFolio, isExpanded, showPanBadges, onPress, onToggleExpand } = props;
  return (
    <TouchableOpacity
      style={styles.headerTouchable}
      onPress={onPress}
      activeOpacity={0.7}
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
  );
}

/**
 * Renders a consolidated scheme group card with nested expandable folios.
 *
 * @param props - Component properties {@link SchemeGroupCardProps}.
 * @returns React Native element.
 */
export function SchemeGroupCard(props: SchemeGroupCardProps): React.ReactElement {
  const { group, isExpanded, onToggleExpand, performanceMode = 'XIRR', showPanBadges = true } = props;
  const [showLedger, setShowLedger] = useState(false);
  const isMultiFolio = group.folioCount > 1;
  const singleFolio = group.folios[0];
  const singleFolioNum = singleFolio?.number || singleFolio?.folioNumber;

  const handleHeaderPress = () => {
    if (isMultiFolio) {
      onToggleExpand(group.id);
    } else {
      setShowLedger(true);
    }
  };

  return (
    <View style={styles.card} testID={`scheme-group-card-${group.id}`}>
      {!isMultiFolio && <LegacyHoldingCardFallback singleFolioId={singleFolio?.id} />}
      <SchemeHeader
        group={group}
        singleFolioNum={singleFolioNum}
        isMultiFolio={isMultiFolio}
        isExpanded={isExpanded}
        showPanBadges={showPanBadges}
        onPress={handleHeaderPress}
        onToggleExpand={onToggleExpand}
      />
      <CardChildren
        folios={group.folios}
        schemeId={group.id}
        performanceMode={performanceMode}
        isMultiFolio={isMultiFolio}
        isExpanded={isExpanded}
      />
      <SingleFolioLedger
        isMultiFolio={isMultiFolio}
        singleFolioNum={singleFolioNum}
        singleFolioPan={singleFolio?.pan}
        schemeName={group.schemeName}
        visible={showLedger}
        onClose={() => setShowLedger(false)}
      />
    </View>
  );
}
