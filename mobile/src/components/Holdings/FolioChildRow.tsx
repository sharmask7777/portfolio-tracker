/**
 * @file FolioChildRow.tsx
 * @description Renders a single child folio row inside an expanded SchemeGroupCard.
 * Shows individual folio number, AMC name, member PAN badge, units, NAV,
 * current value, invested amount, and individual return (XIRR or absolute return).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatIndianRupee,
  formatPercent,
  type FolioInput,
  type PerformanceMode,
} from '@portfolio/core-view';

/**
 * Props for {@link FolioChildRow}.
 */
export interface FolioChildRowProps {
  /** Folio data item */
  readonly folio: FolioInput;
  /** Performance display mode: 'XIRR' or 'ABS' */
  readonly performanceMode?: PerformanceMode | undefined;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  folioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  treeBranch: {
    color: '#71717a',
    fontSize: 14,
    fontWeight: '600',
  },
  folioNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  panBadge: {
    backgroundColor: '#27272a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  panText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.5,
  },
  amcText: {
    fontSize: 11,
    color: '#71717a',
    marginBottom: 6,
    paddingLeft: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 18,
    marginTop: 2,
  },
  unitsNav: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  valuesColumn: {
    alignItems: 'flex-end',
  },
  currentValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  subValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  investedCost: {
    fontSize: 11,
    color: '#71717a',
  },
  returnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

function getReturnRate(folio: FolioInput, mode: PerformanceMode): number | undefined {
  if (mode === 'XIRR') {
    return folio.metrics?.xirr ?? folio.metrics?.absoluteReturn;
  }
  return folio.metrics?.absoluteReturn ?? folio.metrics?.xirr;
}

function resolveUnitsNavText(folio: FolioInput, folioNum: string): string {
  const units = folio.units;
  const currentNav = folio.currentNav ?? folio.metrics?.currentPrice;
  if (units !== undefined && currentNav !== undefined && units > 0 && currentNav > 0) {
    return `${units.toFixed(3)} units @ ${formatIndianRupee(currentNav)}`;
  }
  return `Folio: ${folioNum}`;
}

interface ReturnDisplayProps {
  rate: number | undefined;
}

function ReturnDisplay({ rate }: ReturnDisplayProps): React.ReactElement | null {
  if (rate === undefined) return null;
  const isPositive = rate >= 0;
  const style = isPositive ? styles.positive : styles.negative;
  return <Text style={[styles.returnText, style]}>{formatPercent(rate)}</Text>;
}

interface FolioHeaderInfoProps {
  folioNum: string;
  pan?: string | undefined;
  currentValue: number;
}

function FolioHeaderInfo({ folioNum, pan, currentValue }: FolioHeaderInfoProps): React.ReactElement {
  return (
    <View style={styles.headerRow}>
      <View style={styles.folioInfo}>
        <Text style={styles.treeBranch}>└─</Text>
        <Text style={styles.folioNumber} numberOfLines={1}>
          {folioNum}
        </Text>
        {pan ? (
          <View style={styles.panBadge} testID={`folio-pan-badge-${pan}`}>
            <Text style={styles.panText}>{pan}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.valuesColumn}>
        <Text style={styles.currentValue}>{formatIndianRupee(currentValue)}</Text>
      </View>
    </View>
  );
}

interface FolioMetricsSubRowProps {
  unitsNavFormatted: string;
  investedAmount: number;
  returnRate: number | undefined;
}

function FolioMetricsSubRow(props: FolioMetricsSubRowProps): React.ReactElement {
  const { unitsNavFormatted, investedAmount, returnRate } = props;
  return (
    <View style={styles.metricsRow}>
      <Text style={styles.unitsNav}>{unitsNavFormatted}</Text>
      <View style={styles.subValueRow}>
        {investedAmount > 0 ? (
          <Text style={styles.investedCost}>
            Cost: {formatIndianRupee(investedAmount)}
          </Text>
        ) : null}
        <ReturnDisplay rate={returnRate} />
      </View>
    </View>
  );
}

function resolveFolioValues(folio: FolioInput) {
  const folioNum = folio.number ?? folio.folioNumber ?? 'UNKNOWN';
  const amcName = folio.amcName ?? folio.amc;
  const currentValue = folio.metrics?.currentValue ?? (folio.units ?? 0) * (folio.currentNav ?? 0);
  const investedAmount = folio.metrics?.investedAmount ?? 0;
  return { folioNum, amcName, currentValue, investedAmount };
}

/**
 * Renders an individual folio child row with folio number, PAN, value, units, NAV, and return.
 *
 * @param props - Component properties {@link FolioChildRowProps}.
 * @returns React Native element.
 */
export function FolioChildRow({
  folio,
  performanceMode = 'XIRR',
}: FolioChildRowProps): React.ReactElement {
  const { folioNum, amcName, currentValue, investedAmount } = resolveFolioValues(folio);
  const returnRate = getReturnRate(folio, performanceMode);
  const unitsNavFormatted = resolveUnitsNavText(folio, folioNum);

  return (
    <View style={styles.container} testID={`folio-child-row-${folio.id}`}>
      <FolioHeaderInfo folioNum={folioNum} pan={folio.pan} currentValue={currentValue} />
      {amcName ? (
        <Text style={styles.amcText} numberOfLines={1}>
          {amcName}
        </Text>
      ) : null}
      <FolioMetricsSubRow
        unitsNavFormatted={unitsNavFormatted}
        investedAmount={investedAmount}
        returnRate={returnRate}
      />
    </View>
  );
}
