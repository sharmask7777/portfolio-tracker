import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  SvgTreemap,
  StockOverlapTable,
  StockDetailModal,
} from '../../src/components/Analytics';
import {
  getEnrichedHoldings,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  buildPortfolioHierarchy,
  type HierarchyNode,
  type StockExposure,
  type XRayData,
} from '../../src/services/hierarchy-builder';
import { deriveAnalyticsFromHoldings } from '../../src/services/analytics-service';
import { formatIndianRupee } from '../../src/services/hierarchy-formatters';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  header: {
    marginBottom: 20,
  },
  category: {
    fontSize: 12,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  allocationSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  allocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  allocationCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  allocationName: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  allocationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  allocationPct: {
    fontSize: 12,
    fontWeight: '600',
  },
});

/**
 * Properties for allocation summary card.
 */
export interface AllocationCardProps {
  name: string;
  value: number;
  pct: number;
  color: string;
}

/**
 * Single card showing metric for an asset class.
 *
 * @param props Card properties
 * @returns Card element
 */
export function AllocationCard({ name, value, pct, color }: AllocationCardProps): React.ReactElement {
  return (
    <View style={styles.allocationCard} key={name}>
      <Text style={styles.allocationName}>{name}</Text>
      <Text style={styles.allocationValue}>{formatIndianRupee(value)}</Text>
      <Text style={[styles.allocationPct, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

/**
 * Properties for grid of allocation cards.
 */
export interface AllocationGridProps {
  xrayData: XRayData;
}

/**
 * Grid rendering cards for all macro asset allocations.
 *
 * @param props Grid properties
 * @returns Grid element
 */
export function AllocationCardsGrid({ xrayData }: AllocationGridProps): React.ReactElement {
  const alloc = xrayData.assetAllocation;
  const items: AllocationCardProps[] = [
    { name: 'Equity', value: alloc.equity.value, pct: alloc.equity.percentage, color: '#38bdf8' },
    { name: 'Debt', value: alloc.debt.value, pct: alloc.debt.percentage, color: '#10b981' },
    { name: 'Cash', value: alloc.cash.value, pct: alloc.cash.percentage, color: '#a855f7' },
    { name: 'Gold', value: alloc.gold.value, pct: alloc.gold.percentage, color: '#f59e0b' },
  ];

  return (
    <View style={styles.allocationSection}>
      <Text style={styles.sectionTitle}>Asset Allocation</Text>
      <View style={styles.allocationGrid}>
        {items.map((it) => (
          <AllocationCard key={it.name} {...it} />
        ))}
      </View>
    </View>
  );
}

/**
 * Header section for analytics screen.
 *
 * @returns Header element
 */
export function AnalyticsHeader(): React.ReactElement {
  return (
    <View style={styles.header}>
      <Text style={styles.category}>Look-Through Analytics</Text>
      <Text style={styles.title}>Portfolio X-Ray</Text>
    </View>
  );
}

function useAnalyticsData() {
  const [refreshing, setRefreshing] = useState(false);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);

  const loadData = useCallback(async () => {
    try {
      const enriched = await getEnrichedHoldings();
      setHoldings(enriched);
    } catch {
      // Retain existing state
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return { refreshing, onRefresh, holdings };
}

/**
 * Analytics and Stock X-Ray tab screen.
 *
 * @returns React Native screen component element
 */
export default function AnalyticsScreen(): React.ReactElement {
  const { refreshing, onRefresh, holdings } = useAnalyticsData();
  const [excludeArbitrage, setExcludeArbitrage] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockExposure | null>(null);

  const { xrayData, exposures } = useMemo(() => deriveAnalyticsFromHoldings(holdings), [holdings]);
  const rootHierarchyNode = useMemo(
    () => buildPortfolioHierarchy(xrayData, exposures, { excludeArbitrage }),
    [xrayData, exposures, excludeArbitrage],
  );

  const handleSelectFromTreemap = useCallback((node: HierarchyNode) => {
    const match = exposures.find((e) => e.name === node.name);
    setSelectedStock(match ?? {
      name: node.name,
      sector: node.sector ?? 'Unclassified',
      absoluteValue: node.metrics.signedValue,
      percentage: node.metrics.weightOfPortfolio,
      contributions: node.contributions ?? [],
    });
  }, [exposures]);

  return (
    <View style={styles.container} testID="analytics-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
      >
        <AnalyticsHeader />
        <AllocationCardsGrid xrayData={xrayData} />
        <Text style={styles.sectionTitle}>Visual Treemap</Text>
        <SvgTreemap rootNode={rootHierarchyNode} onSelectStock={handleSelectFromTreemap} />
        <StockOverlapTable
          exposures={exposures}
          totalPortfolioValue={xrayData.totalValue}
          excludeArbitrage={excludeArbitrage}
          onToggleExcludeArbitrage={setExcludeArbitrage}
          onSelectStock={setSelectedStock}
        />
      </ScrollView>
      <StockDetailModal
        visible={selectedStock !== null}
        stock={selectedStock}
        totalPortfolioValue={xrayData.totalValue}
        onClose={() => setSelectedStock(null)}
      />
    </View>
  );
}
