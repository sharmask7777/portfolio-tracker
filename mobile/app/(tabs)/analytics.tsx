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
  syncScopedAnalytics,
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
  /** True when `pct` is a 0..1 fraction (backend `/xray`), false when already 0..100 */
  isFraction?: boolean | undefined;
}

export function AllocationCard({
  name,
  value,
  pct,
  color,
  isFraction = false,
}: AllocationCardProps): React.ReactElement {
  const displayPct = isFraction ? pct * 100 : pct;
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
 * @param props - Component properties containing XRayData and excludeArbitrage flag
 * @returns React Native element
 */
export function AllocationCardsGrid({
  xrayData,
  excludeArbitrage = false,
  isFraction = false,
}: {
  xrayData: XRayData;
  excludeArbitrage?: boolean;
  isFraction?: boolean | undefined;
}): React.ReactElement {
  const alloc =
    excludeArbitrage && xrayData.exArbitrage
      ? xrayData.exArbitrage.assetAllocation
      : xrayData.assetAllocation;
  const rawItems: AllocationCardProps[] = [
    { name: 'Equity', value: alloc.equity.value, pct: alloc.equity.percentage, color: '#38bdf8', isFraction },
    { name: 'Debt', value: alloc.debt.value, pct: alloc.debt.percentage, color: '#10b981', isFraction },
    { name: 'Arbitrage', value: alloc.arbitrage?.value ?? 0, pct: alloc.arbitrage?.percentage ?? 0, color: '#ec4899', isFraction },
    { name: 'Cash', value: alloc.cash.value, pct: alloc.cash.percentage, color: '#06b6d4', isFraction },
    { name: 'Gold', value: alloc.gold.value, pct: alloc.gold.percentage, color: '#f59e0b', isFraction },
    { name: 'Other', value: alloc.other.value, pct: alloc.other.percentage, color: '#71717a', isFraction },
  ];
  const items = rawItems.filter(
    (it) => it.value > 0 || ['Equity', 'Debt', 'Cash', 'Gold'].includes(it.name),
  );

  return (
    <View style={styles.allocationSection} testID="allocation-cards-grid">
      <Text style={styles.sectionTitle}>Asset Allocation (% of Portfolio)</Text>
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
  /** True when `percentage` values are 0..1 fractions from backend `/xray` */
  isFraction?: boolean | undefined;
}

/**
 * Renders the Market Cap Breakdown tier cards (Large Cap, Mid Cap, Small Cap, Other) for equity holdings.
 *
 * @param props - Component properties {@link MarketCapSectionProps}
 * @returns React Native element
 */
export function MarketCapSection({
  marketCap,
  isFraction = false,
}: MarketCapSectionProps): React.ReactElement {
  const items: AllocationCardProps[] = [
    { name: 'Large Cap', value: marketCap.large.value, pct: marketCap.large.percentage, color: '#38bdf8', isFraction },
    { name: 'Mid Cap', value: marketCap.mid.value, pct: marketCap.mid.percentage, color: '#a855f7', isFraction },
    { name: 'Small Cap', value: marketCap.small.value, pct: marketCap.small.percentage, color: '#f59e0b', isFraction },
  ];

  if (marketCap.other && marketCap.other.value > 0) {
    items.push({
      name: 'Other',
      value: marketCap.other.value,
      pct: marketCap.other.percentage,
      color: '#71717a',
      isFraction,
    });
  }

  return (
    <View style={styles.allocationSection} testID="market-cap-section">
      <Text style={styles.sectionTitle}>Market Cap Breakdown (% of Equity)</Text>
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

function useAnalyticsData(scopeId: string) {
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
        getCachedPortfolioAnalytics(undefined, scopeId),
      ]);
      setHoldings(enriched);
      setProfiles(storedProfiles);
      setFolios(storedFolios);
      setCachedAnalytics(analytics);
    } catch {
      // Retain state
    }
  }, [scopeId]);

  useEffect(() => {
    void loadData();
    void Promise.all([refreshPortfolio(), syncScopedAnalytics(scopeId)]).then(([, synced]) => {
      setCachedAnalytics(synced);
      void loadData();
    });
  }, [loadData, scopeId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const [, synced] = await Promise.all([refreshPortfolio(), syncScopedAnalytics(scopeId)]);
    setCachedAnalytics(synced);
    await loadData();
    setRefreshing(false);
  }, [loadData, scopeId]);

  return { refreshing, onRefresh, holdings, profiles, folios, cachedAnalytics };
}

interface AnalyticsStateInput {
  holdings: EnrichedHolding[];
  profiles: FamilyProfile[];
  folios: FolioEntity[];
  cachedAnalytics: CachedAnalyticsResult | null;
  activeProfileId: string | null;
}

function useAnalyticsDerivedData(input: AnalyticsStateInput, excludeArbitrage: boolean) {
  const activeProfile = useMemo(() => {
    if (!input.activeProfileId) return null;
    return input.profiles.find((p) => p.id === input.activeProfileId) ?? null;
  }, [input.activeProfileId, input.profiles]);

  const filteredHoldings = useMemo(
    () => filterHoldingsForProfile(activeProfile, input.holdings, input.folios),
    [activeProfile, input.holdings, input.folios],
  );

  const { xrayData, exposures, isBackendXray } = useMemo(() => {
    if (input.cachedAnalytics?.xrayData && input.cachedAnalytics.exposures) {
      const exps = excludeArbitrage
        ? (input.cachedAnalytics.exposuresExArb ?? input.cachedAnalytics.exposures)
        : input.cachedAnalytics.exposures;
      return { xrayData: input.cachedAnalytics.xrayData, exposures: exps, isBackendXray: true };
    }
    return { ...deriveAnalyticsFromHoldings(filteredHoldings), isBackendXray: false };
  }, [input.cachedAnalytics, excludeArbitrage, filteredHoldings]);

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

  return { xrayData, exposures, isBackendXray, rootHierarchyNode, expenseAnalysis };
}

/**
 * Analytics and Stock X-Ray tab screen.
 *
 * @returns React Native screen component element
 */
export default function AnalyticsScreen(): React.ReactElement {
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const scopeId = scopeState.activeProfileId ?? 'consolidated';
  const { refreshing, onRefresh, holdings, profiles, folios, cachedAnalytics } = useAnalyticsData(scopeId);
  const [excludeArbitrage, setExcludeArbitrage] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockExposure | null>(null);

  const { xrayData, exposures, isBackendXray, rootHierarchyNode, expenseAnalysis } = useAnalyticsDerivedData(
    { holdings, profiles, folios, cachedAnalytics, activeProfileId: scopeState.activeProfileId },
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
        <AllocationCardsGrid xrayData={xrayData} excludeArbitrage={excludeArbitrage} isFraction={isBackendXray} />
        <MarketCapSection
          marketCap={
            excludeArbitrage && xrayData.exArbitrage
              ? xrayData.exArbitrage.marketCap
              : xrayData.marketCap
          }
          isFraction={isBackendXray}
        />
        <ExpenseAnalysisCard {...expenseAnalysis} />
        <Text style={styles.sectionTitle}>Visual Treemap</Text>
        <SvgTreemap rootNode={rootHierarchyNode} onSelectStock={handleSelectFromTreemap} />
        <StockOverlapTable exposures={exposures} totalPortfolioValue={xrayData.totalValue} excludeArbitrage={excludeArbitrage} onToggleExcludeArbitrage={setExcludeArbitrage} onSelectStock={setSelectedStock} />
      </ScrollView>
      <StockDetailModal visible={selectedStock !== null} stock={selectedStock} totalPortfolioValue={xrayData.totalValue} onClose={() => setSelectedStock(null)} />
    </View>
  );
}
