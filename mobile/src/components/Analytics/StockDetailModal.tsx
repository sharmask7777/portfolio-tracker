import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { X, Layers } from 'lucide-react-native';
import type { StockExposure, StockContribution } from '../../services/hierarchy-builder';
import { formatIndianRupee } from '../../services/hierarchy-formatters';

/**
 * Properties for configuring the StockDetailModal component.
 */
export interface StockDetailModalProps {
  visible: boolean;
  stock: StockExposure | null;
  totalPortfolioValue: number;
  onClose: () => void;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleGroup: {
    flex: 1,
    marginRight: 12,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  sectorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#09090b',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  summaryHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
  },
  overlapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  overlapText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  schemeCard: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 10,
  },
  schemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  schemeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
    flex: 1,
    marginRight: 8,
  },
  schemeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  schemePct: {
    fontSize: 11,
    color: '#71717a',
  },
  portfolioPct: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
});

/**
 * Properties for an individual contributing mutual fund scheme item.
 */
export interface SchemeItemProps {
  item: StockContribution;
  totalPortfolioValue: number;
}

/**
 * Breakdown row for an individual mutual fund scheme contributing to this stock.
 *
 * @param props Scheme item properties
 * @returns Rendered card element
 */
export function SchemeContributionItem({
  item,
  totalPortfolioValue,
}: SchemeItemProps): React.ReactElement {
  const portfolioPct = totalPortfolioValue > 0
    ? ((item.value / totalPortfolioValue) * 100).toFixed(2)
    : '0.00';
  const progressRatio = Math.min(100, Math.max(5, item.weight));

  return (
    <View style={styles.schemeCard} key={item.schemeName}>
      <View style={styles.schemeHeader}>
        <Text style={styles.schemeName}>{item.schemeName}</Text>
        <Text style={styles.schemeValue}>{formatIndianRupee(item.value)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.schemePct}>{item.weight.toFixed(2)}% of Scheme</Text>
        <Text style={styles.portfolioPct}>{portfolioPct}% of Portfolio</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressRatio}%` }]} />
      </View>
    </View>
  );
}

/**
 * Properties for modal header bar.
 */
export interface ModalHeaderProps {
  name: string;
  sector: string;
  onClose: () => void;
}

/**
 * Header section of stock detail modal.
 *
 * @param props Header properties
 * @returns Header element
 */
export function ModalHeader({ name, sector, onClose }: ModalHeaderProps): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.titleGroup}>
        <Text style={styles.companyName}>{name}</Text>
        <View style={styles.sectorBadge}>
          <Text style={styles.sectorText}>{sector}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close stock details modal"
      >
        <X size={18} color="#a1a1aa" />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Properties for stock summary cards.
 */
export interface SummaryProps {
  absoluteValue: number;
  pct: string;
}

/**
 * Metric summary cards showing total rupee holding and portfolio weight.
 *
 * @param props Summary properties
 * @returns Grid element
 */
export function StockSummaryCards({ absoluteValue, pct }: SummaryProps): React.ReactElement {
  return (
    <View style={styles.summaryGrid}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Rupee Holding</Text>
        <Text style={styles.summaryValue}>{formatIndianRupee(absoluteValue)}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Portfolio Weight</Text>
        <Text style={styles.summaryHighlight}>{pct}%</Text>
      </View>
    </View>
  );
}

/**
 * Slide-up modal displaying underlying corporate look-through details and fund breakdown.
 *
 * @param props StockDetailModal properties
 * @returns Rendered modal element
 */
export function StockDetailModal({
  visible,
  stock,
  totalPortfolioValue,
  onClose,
  testID = 'stock-detail-modal',
}: StockDetailModalProps): React.ReactElement | null {
  if (!visible || !stock) return null;

  const pct = (stock.percentage * (stock.percentage <= 1 ? 100 : 1)).toFixed(2);
  const fundCount = stock.contributions?.length || 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <ModalHeader name={stock.name} sector={stock.sector} onClose={onClose} />
          <StockSummaryCards absoluteValue={stock.absoluteValue} pct={pct} />

          {fundCount > 1 && (
            <View style={styles.overlapBanner}>
              <Layers size={14} color="#38bdf8" />
              <Text style={styles.overlapText}>Held across {fundCount} mutual fund schemes in your portfolio</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Contributing Schemes</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {stock.contributions.map((c) => (
              <SchemeContributionItem key={c.schemeName} item={c} totalPortfolioValue={totalPortfolioValue} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
