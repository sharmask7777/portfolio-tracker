/**
 * @file ClosedPositionsSection.tsx
 * @description Collapsible drawer section displaying closed/fully redeemed folios with returns and deletion.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react-native';
import { formatIndianRupee, formatPercent } from '@portfolio/core-view';
import type { EnrichedHolding } from '../../services/portfolio-service';

/**
 * Props for {@link ClosedPositionsSection}.
 */
export interface ClosedPositionsSectionProps {
  /** Array of closed / fully redeemed holdings (units === 0) */
  readonly closedHoldings: readonly EnrichedHolding[];
  /** Optional callback to delete a closed folio */
  readonly onDeleteFolio?: ((folioNumber: string) => Promise<void>) | undefined;
  /** Optional callback when folio is pressed */
  readonly onSelectFolio?: ((holding: EnrichedHolding) => void) | undefined;
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#18181b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  toggleText: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '600',
  },
  list: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  schemeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#71717a',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricsCol: {
    alignItems: 'flex-end',
  },
  returnVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  costText: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#27272a',
    borderRadius: 6,
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
});

interface ClosedRowProps {
  holding: EnrichedHolding;
  onDelete?: ((folioNumber: string) => Promise<void>) | undefined;
  onSelect?: ((holding: EnrichedHolding) => void) | undefined;
}

function resolveClosedRowMetrics(holding: EnrichedHolding) {
  const primaryReturn = holding.xirr ?? holding.absolute_return ?? undefined;
  const postTaxXirr = holding.post_tax_xirr ?? undefined;
  const isPositive = (primaryReturn ?? 0) >= 0;
  const retColor = isPositive ? styles.positive : styles.negative;
  const returnText = primaryReturn !== undefined ? formatPercent(primaryReturn) : '—';
  const returnLabel = holding.xirr != null ? 'XIRR' : 'Return';
  return { postTaxXirr, retColor, returnText, returnLabel };
}

function ClosedRow(props: ClosedRowProps): React.ReactElement {
  const { holding, onDelete, onSelect } = props;
  const { postTaxXirr, retColor, returnText, returnLabel } = resolveClosedRowMetrics(holding);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onSelect?.(holding)}
      activeOpacity={onSelect ? 0.7 : 1}
      testID={`closed-folio-row-${holding.id}`}
    >
      <View style={styles.rowInfo}>
        <Text style={styles.schemeName} numberOfLines={1}>
          {holding.scheme_name}
        </Text>
        <Text style={styles.metaText}>
          Folio: {holding.folio_number} · Fully Redeemed
        </Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.metricsCol}>
          <Text style={[styles.returnVal, retColor]}>
            {returnLabel}: {returnText}
          </Text>
          {postTaxXirr !== undefined ? (
            <Text style={styles.costText}>Post-Tax XIRR: {formatPercent(postTaxXirr)}</Text>
          ) : (
            <Text style={styles.costText}>Cost: {formatIndianRupee(holding.invested_cost)}</Text>
          )}
        </View>
        {onDelete ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => void onDelete(holding.folio_number)}
            testID={`delete-closed-folio-${holding.folio_number}`}
            accessibilityLabel={`Delete folio ${holding.folio_number}`}
          >
            <Trash2 size={14} color="#ef4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Collapsible drawer component for zero-balance / fully redeemed folios.
 *
 * @param props - Component properties {@link ClosedPositionsSectionProps}
 * @returns React Native element or null if no closed positions exist
 */
export function ClosedPositionsSection(props: ClosedPositionsSectionProps): React.ReactElement | null {
  const { closedHoldings, onDeleteFolio, onSelectFolio } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  if (closedHoldings.length === 0) return null;

  return (
    <View style={styles.container} testID="closed-positions-section">
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded((prev) => !prev)}
        activeOpacity={0.7}
        testID="closed-positions-toggle"
      >
        <View style={styles.headerLeft}>
          {isExpanded ? <ChevronDown size={16} color="#f4f4f5" /> : <ChevronRight size={16} color="#f4f4f5" />}
          <Text style={styles.title}>
            Closed / Fully Redeemed Positions ({closedHoldings.length})
          </Text>
        </View>
        <Text style={styles.toggleText}>{isExpanded ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {isExpanded ? (
        <View style={styles.list}>
          {closedHoldings.map((h) => (
            <ClosedRow key={h.id} holding={h} onDelete={onDeleteFolio} onSelect={onSelectFolio} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
