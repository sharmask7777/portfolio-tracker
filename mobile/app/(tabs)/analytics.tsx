import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { usePortfolioScope } from '@portfolio/core-view';
import {
  SvgTreemap,
  StockOverlapTable,
  StockDetailModal,
  ExpenseAnalysisCard,
} from '../../src/components/Analytics';
import {
  calculateExpenseAnalysis,
  type ExpenseAnalysisResult,
} from '../../src/services/expense-calculation-service';
import {
  getEnrichedHoldings,
  refreshPortfolio,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  getCachedPortfolioAnalytics,
  type CachedAnalyticsResult,
} from '../../src/services/analytics-sync-service';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  filterHoldingsForProfile,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';
import {
  buildPortfolioHierarchy,
  type HierarchyNode,
  type StockExposure,
  type XRayData,
} from '../../src/services/hierarchy-builder';
import { deriveAnalyticsFromHoldings } from '../../src/services/analytics-service';
import { formatIndianRupee } from '../../src/services/hierarchy-formatters';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 20, paddingTop: 16 },
  header: { marginBottom: 20 },
  category: { fontSize: 12, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4f4f5' },
  allocationSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  allocationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  allocationCard: { flex: 1, minWidth: 100, backgroundColor: '#18181b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#27272a' },
  allocationName: { fontSize: 11, color: '#a1a1aa', marginBottom: 4 },
  allocationValue: { fontSize: 14, fontWeight: '700', color: '#f4f4f5', marginBottom: 2 },
  allocationPct: { fontSize: 12, fontWeight: '600' },
});

export interface AllocationCardProps {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export function AllocationCard({ name, value, pct, color }: AllocationCardProps): React.ReactElement {
  const displayPct = pct <= 1 && pct > 0 ? pct * 100 : pct;
  return (
    <View style={styles.allocationCard} key={name}>
      <Text style={styles.allocationName}>{name}</Text>
      <Text style={styles.allocationValue}>{formatIndianRupee(value)}</Text>
      <Text style={[styles.allocationPct, { color }]}>{displayPct.toFixed(1)}%</Text>
    </View>
  );
}

/**
 * Renders a responsive grid of canonical asset allocation cards for the portfolio X-Ray.
 *
 * Dynamically displays all non-zero categories (Equity, Debt, Arbitrage, Cash, Gold, Other).
 *
 * @param props - Component properties containing XRayData
 * @returns React Native element
 */
export function AllocationCardsGrid({ xrayData }: { xrayData: XRayData }): React.ReactElement {
  const alloc = xrayData.assetAllocation;
  const rawItems: AllocationCardProps[] = [
    { name: 'Equity', value: alloc.equity.value, pct: alloc.equity.percentage, color: '#38bdf8' },
    { name: 'Debt', value: alloc.debt.value, pct: alloc.debt.percentage, color: '#10b981' },
    { name: 'Arbitrage', value: alloc.arbitrage?.value ?? 0, pct: alloc.arbitrage?.percentage ?? 0, color: '#ec4899' },
    { name: 'Cash', value: alloc.cash.value, pct: alloc.cash.percentage, color: '#06b6d4' },
    { name: 'Gold', value: alloc.gold.value, pct: alloc.gold.percentage, color: '#f59e0b' },
    { name: 'Other', value: alloc.other.value, pct: alloc.other.percentage, color: '#71717a' },
  ];
  const items = rawItems.filter(
    (it) => it.value > 0 || ['Equity', 'Debt', 'Cash', 'Gold'].includes(it.name),
  );

  return (
    <View style={styles.allocationSection} testID="allocation-cards-grid">
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
 * Properties for MarketCapSection component.
 */
export interface MarketCapSectionProps {
  /** Market capitalization look-through data object */
  marketCap: XRayData['marketCap'];
}

/**
 * Renders the Market Cap Breakdown tier cards (Large Cap, Mid Cap, Small Cap, Other) for equity holdings.
 *
 * @param props - Component properties {@link MarketCapSectionProps}
 * @returns React Native element
 */
export function MarketCapSection({ marketCap }: MarketCapSectionProps): React.ReactElement {
  const items: AllocationCardProps[] = [
    { name: 'Large Cap', value: marketCap.large.value, pct: marketCap.large.percentage, color: '#38bdf8' },
    { name: 'Mid Cap', value: marketCap.mid.value, pct: marketCap.mid.percentage, color: '#a855f7' },
    { name: 'Small Cap', value: marketCap.small.value, pct: marketCap.small.percentage, color: '#f59e0b' },
  ];

  if (marketCap.other && marketCap.other.value > 0) {
    items.push({
      name: 'Other',
      value: marketCap.other.value,
      pct: marketCap.other.percentage,
      color: '#71717a',
    });
  }

  return (
    <View style={styles.allocationSection} testID="market-cap-section">
      <Text style={styles.sectionTitle}>Market Cap Breakdown</Text>
      <View style={styles.allocationGrid}>
        {items.map((it) => (
          <AllocationCard key={it.name} {...it} />
        ))}
      </View>
    </View>
  );
}

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
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [cachedAnalytics, setCachedAnalytics] = useState<CachedAnalyticsResult | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [enriched, storedProfiles, storedFolios, analytics] = await Promise.all([
        getEnrichedHoldings(),
        getStoredFamilyProfiles(),
        getStoredFolios(),
        getCachedPortfolioAnalytics(),
      ]);
      setHoldings(enriched);
      setProfiles(storedProfiles);
      setFolios(storedFolios);
      setCachedAnalytics(analytics);
    } catch {
      // Retain state
    }
  }, []);

  useEffect(() => {
    void loadData();
    void refreshPortfolio().then(() => {
      void loadData();
    });
  }, [loadData]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPortfolio();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return { refreshing, onRefresh, holdings, profiles, folios, cachedAnalytics };
}

interface AnalyticsStateInput {
  holdings: EnrichedHolding[];
  profiles: FamilyProfile[];
  folios: FolioEntity[];
  cachedAnalytics: CachedAnalyticsResult | null;
}

function useAnalyticsDerivedData(input: AnalyticsStateInput, excludeArbitrage: boolean) {
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const activeProfile = useMemo(() => {
    if (!scopeState.activeProfileId) return null;
    return input.profiles.find((p) => p.id === scopeState.activeProfileId) ?? null;
  }, [scopeState.activeProfileId, input.profiles]);

  const filteredHoldings = useMemo(
    () => filterHoldingsForProfile(activeProfile, input.holdings, input.folios),
    [activeProfile, input.holdings, input.folios],
  );

  const { xrayData, exposures } = useMemo(() => {
    if (!activeProfile && input.cachedAnalytics?.xrayData && input.cachedAnalytics.exposures) {
      const exps = excludeArbitrage
        ? (input.cachedAnalytics.exposuresExArb ?? input.cachedAnalytics.exposures)
        : input.cachedAnalytics.exposures;
      return { xrayData: input.cachedAnalytics.xrayData, exposures: exps };
    }
    return deriveAnalyticsFromHoldings(filteredHoldings);
  }, [activeProfile, input.cachedAnalytics, excludeArbitrage, filteredHoldings]);

  const rootHierarchyNode = useMemo(
    () => buildPortfolioHierarchy(xrayData, exposures, { excludeArbitrage }),
    [xrayData, exposures, excludeArbitrage],
  );

  const expenseAnalysis: ExpenseAnalysisResult = useMemo(() => {
    if (xrayData.expenseAnalysis) {
      return xrayData.expenseAnalysis;
    }
    return calculateExpenseAnalysis(filteredHoldings);
  }, [xrayData.expenseAnalysis, filteredHoldings]);

  return { scopeState, xrayData, exposures, rootHierarchyNode, expenseAnalysis };
}

/**
 * Analytics and Stock X-Ray tab screen.
 *
 * @returns React Native screen component element
 */
export default function AnalyticsScreen(): React.ReactElement {
  const { refreshing, onRefresh, holdings, profiles, folios, cachedAnalytics } = useAnalyticsData();
  const [excludeArbitrage, setExcludeArbitrage] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockExposure | null>(null);

  const { scopeState, xrayData, exposures, rootHierarchyNode, expenseAnalysis } = useAnalyticsDerivedData(
    { holdings, profiles, folios, cachedAnalytics },
    excludeArbitrage,
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
      <ScopeSelectorHeader
        scope={scopeState.scope}
        profiles={profiles}
        onSelectConsolidated={scopeState.setConsolidated}
        onSelectMember={scopeState.setMemberScope}
        totalFolios={folios.length}
      />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}>
        <AnalyticsHeader />
        <AllocationCardsGrid xrayData={xrayData} />
        <MarketCapSection marketCap={xrayData.marketCap} />
        <ExpenseAnalysisCard {...expenseAnalysis} />
        <Text style={styles.sectionTitle}>Visual Treemap</Text>
        <SvgTreemap rootNode={rootHierarchyNode} onSelectStock={handleSelectFromTreemap} />
        <StockOverlapTable exposures={exposures} totalPortfolioValue={xrayData.totalValue} excludeArbitrage={excludeArbitrage} onToggleExcludeArbitrage={setExcludeArbitrage} onSelectStock={setSelectedStock} />
      </ScrollView>
      <StockDetailModal visible={selectedStock !== null} stock={selectedStock} totalPortfolioValue={xrayData.totalValue} onClose={() => setSelectedStock(null)} />
    </View>
  );
}
