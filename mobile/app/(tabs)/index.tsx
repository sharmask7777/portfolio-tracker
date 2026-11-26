import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { usePortfolioScope, type PerformanceMode } from '@portfolio/core-view';
import {
  getEnrichedHoldings,
  refreshPortfolio,
  summarizeHoldings,
  computeOverallPortfolioXirr,
  getStoredDashboardBundle,
  mergeServerMetricsIntoSummary,
  type DashboardSummary,
  type EnrichedHolding,
  type StoredSummaryEnvelope,
} from '../../src/services/portfolio-service';
import type { HistoryPoint } from '../../src/types/generated';
import { usePerformanceMode } from '../../src/services/settings-service';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  filterHoldingsForProfile,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { getCachedPortfolioHistory } from '../../src/services/history-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';
import {
  DEFAULT_ASSUMPTIONS,
  type RealityCheckAssumptions,
} from '../../src/services/reality-check-service';
import { NetWorthCard } from '../../src/components/NetWorthCard';
import { DayReturnBanner } from '../../src/components/DayReturnBanner';
import { AssetAllocationCard } from '../../src/components/AssetAllocationCard';
import {
  RealityCheckModeToggle,
  RealityCheckBanner,
  AssumptionsModal,
  HistoricalTrendChart,
} from '../../src/components/Dashboard';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 20, paddingTop: 16 },
  header: { marginBottom: 16 },
  greeting: { fontSize: 13, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4f4f5' },
  emptyCard: {
    backgroundColor: '#18181b', borderRadius: 16, padding: 24, borderWidth: 1,
    borderColor: '#27272a', alignItems: 'center', marginTop: 10, marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f4f4f5', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' },
});

async function fetchDashboardSnapshot(historyId: string, scopeId: string) {
  const [enriched, storedProfiles, storedFolios, cachedHistory, scopedBundle, baseBundle] =
    await Promise.all([
      getEnrichedHoldings(),
      getStoredFamilyProfiles(),
      getStoredFolios(),
      getCachedPortfolioHistory(undefined, historyId),
      getStoredDashboardBundle(undefined, scopeId),
      getStoredDashboardBundle(undefined, 'consolidated'),
    ]);
  return { enriched, storedProfiles, storedFolios, cachedHistory, scopedBundle, baseBundle };
}

function useDashboardData(activeProfileId: string | null) {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [serverBundle, setServerBundle] = useState<StoredSummaryEnvelope | null>(null);
  const [consolidatedBundle, setConsolidatedBundle] = useState<StoredSummaryEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchDashboardSnapshot(activeProfileId ?? 'default', activeProfileId ?? 'consolidated');
      setHoldings(data.enriched);
      setProfiles(data.storedProfiles);
      setFolios(data.storedFolios);
      setHistoryPoints(data.cachedHistory);
      setServerBundle(data.scopedBundle);
      setConsolidatedBundle(data.baseBundle);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [activeProfileId]);

  const handleRefresh = useCallback(async (assumptions?: RealityCheckAssumptions) => {
    setIsRefreshing(true);
    try {
      const opts = {
        ...(assumptions ? { cpi: assumptions.inflationRate, taxBracket: assumptions.taxRate } : {}),
        ...(activeProfileId ? { profileId: activeProfileId } : {}),
      };
      await refreshPortfolio(undefined, opts);
      await loadData();
    } catch {
      // Fallback
    } finally {
      setIsRefreshing(false);
    }
  }, [activeProfileId, loadData]);

  useEffect(() => {
    void loadData();
    const opts = activeProfileId ? { profileId: activeProfileId } : undefined;
    void refreshPortfolio(undefined, opts).then(() => void loadData());
  }, [activeProfileId, loadData]);

  return { holdings, profiles, folios, historyPoints, serverBundle, consolidatedBundle, isLoading, isRefreshing, handleRefresh };
}

const defaultSummary: DashboardSummary = {
  totalCurrentValue: 0,
  totalInvestedCost: 0,
  unrealizedGain: 0,
  unrealizedGainPct: 0,
  dayGain: 0,
  dayGainPct: 0,
  assetAllocation: [],
  holdingsCount: 0,
  lastUpdated: null,
  isOfflineFallback: false,
};

function renderEmptyState(): React.ReactElement {
  return (
    <View style={styles.emptyCard} testID="dashboard-empty-state">
      <Text style={styles.emptyTitle}>No Holdings Found</Text>
      <Text style={styles.emptySubtitle}>
        Your portfolio is empty. Pair with a server or upload a CAS statement to track your investments offline.
      </Text>
    </View>
  );
}

interface RealityCheckSectionProps {
  realityCheckMode: boolean;
  setRealityCheckMode: (m: boolean) => void;
  assumptions: RealityCheckAssumptions;
  setAssumptions: (a: RealityCheckAssumptions) => void;
  isAssumptionsOpen: boolean;
  setIsAssumptionsOpen: (open: boolean) => void;
  data: DashboardSummary;
}

function RealityCheckSection(props: RealityCheckSectionProps): React.ReactElement {
  const { realityCheckMode, setRealityCheckMode, assumptions, setAssumptions, isAssumptionsOpen, setIsAssumptionsOpen, data } = props;
  const nominalReturnPct = data.overallXirr ?? 0;

  return (
    <>
      <RealityCheckModeToggle realityCheckMode={realityCheckMode} onToggle={setRealityCheckMode} onOpenAssumptions={() => setIsAssumptionsOpen(true)} />
      <AssumptionsModal visible={isAssumptionsOpen} onClose={() => setIsAssumptionsOpen(false)} assumptions={assumptions} onSaveAssumptions={setAssumptions} />
      {realityCheckMode && (
        <RealityCheckBanner
          nominalValue={data.totalCurrentValue}
          investedCost={data.totalInvestedCost}
          nominalReturnPct={nominalReturnPct}
          drags={data.drags}
          assumptions={assumptions}
          onOpenAssumptions={() => setIsAssumptionsOpen(true)}
        />
      )}
    </>
  );
}

interface DashboardCardsProps {
  data: DashboardSummary;
  historyPoints: HistoryPoint[];
  realityCheckMode: boolean;
  setRealityCheckMode: (m: boolean) => void;
  assumptions: RealityCheckAssumptions;
  setAssumptions: (a: RealityCheckAssumptions) => void;
  isAssumptionsOpen: boolean;
  setIsAssumptionsOpen: (open: boolean) => void;
  performanceMode: PerformanceMode;
  onTogglePerformanceMode: (mode: PerformanceMode) => void;
  onGestureActive?: ((active: boolean) => void) | undefined;
}

function DashboardCards(props: DashboardCardsProps): React.ReactElement {
  const { data, historyPoints, performanceMode, onTogglePerformanceMode, onGestureActive } = props;
  const hasHoldings = data.holdingsCount > 0;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.greeting}>Offline Portfolio</Text>
        <Text style={styles.title}>Dashboard</Text>
      </View>
      <RealityCheckSection {...props} />
      <NetWorthCard
        totalCurrentValue={data.totalCurrentValue} totalInvestedCost={data.totalInvestedCost}
        unrealizedGain={data.unrealizedGain} unrealizedGainPct={data.unrealizedGainPct}
        performanceMode={performanceMode} overallXirr={data.overallXirr}
        onTogglePerformanceMode={onTogglePerformanceMode} realityCheckMode={props.realityCheckMode}
        netRealizableValue={data.netRealizableValue} estimatedTax={data.estimatedTax}
        realPostTaxXirr={data.realPostTaxXirr} postTaxTotalValue={data.postTaxTotalValue}
        postTaxXirr={data.postTaxXirr}
      />
      <DayReturnBanner dayGain={data.dayGain} dayGainPct={data.dayGainPct} isOfflineFallback={data.isOfflineFallback} />
      <HistoricalTrendChart
        currentValue={data.totalCurrentValue}
        investedCost={data.totalInvestedCost}
        historyPoints={historyPoints}
        onGestureActive={onGestureActive}
      />
      {hasHoldings ? <AssetAllocationCard allocation={data.assetAllocation} totalValue={data.totalCurrentValue} /> : renderEmptyState()}
    </>
  );
}

interface FilteredSummaryInput {
  activeProfileId: string | null;
  holdings: EnrichedHolding[];
  profiles: FamilyProfile[];
  folios: FolioEntity[];
  serverBundle: StoredSummaryEnvelope | null;
}

function useFilteredSummary({ activeProfileId, holdings, profiles, folios, serverBundle }: FilteredSummaryInput) {
  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId) ?? null;
  }, [activeProfileId, profiles]);

  const filteredHoldings = useMemo(
    () => filterHoldingsForProfile(activeProfile, holdings, folios),
    [activeProfile, holdings, folios]
  );

  return useMemo<DashboardSummary>(() => {
    if (filteredHoldings.length === 0 && !serverBundle?.metrics) return defaultSummary;
    const base = filteredHoldings.length > 0 ? summarizeHoldings(filteredHoldings) : defaultSummary;
    if (serverBundle?.metrics) {
      return mergeServerMetricsIntoSummary(base, serverBundle.metrics, serverBundle.assetAllocation);
    }
    return {
      ...base,
      overallXirr: computeOverallPortfolioXirr(filteredHoldings),
      drags: null,
      isOfflineFallback: false,
    };
  }, [filteredHoldings, serverBundle]);
}

/**
 * Main mobile dashboard screen. Displays top-level ScopeSelectorHeader,
 * net worth, today's returns banner, Reality Check mode toggle & waterfall teardown,
 * Historical Valuation Trend chart, and asset allocation breakdown.
 *
 * @returns React Native dashboard tab element
 */
export default function DashboardScreen(): React.ReactElement {
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const dash = useDashboardData(scopeState.activeProfileId);
  const summary = useFilteredSummary({
    activeProfileId: scopeState.activeProfileId, holdings: dash.holdings,
    profiles: dash.profiles, folios: dash.folios, serverBundle: dash.serverBundle,
  });
  const [performanceMode, setPerformanceMode] = usePerformanceMode();
  const [realityCheckMode, setRealityCheckMode] = useState(false);
  const [chartGestureActive, setChartGestureActive] = useState(false);
  const [assumptions, setAssumptions] = useState<RealityCheckAssumptions>(DEFAULT_ASSUMPTIONS);
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);
  const handleSaveAssumptions = useCallback((next: RealityCheckAssumptions) => {
    setAssumptions(next);
    void dash.handleRefresh(next);
  }, [dash]);

  if (dash.isLoading && dash.holdings.length === 0) {
    return (
      <View style={styles.center} testID="dashboard-loading">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScopeSelectorHeader
        scope={scopeState.scope} profiles={dash.profiles}
        panBreakdowns={dash.consolidatedBundle?.panBreakdowns}
        onSelectConsolidated={scopeState.setConsolidated}
        onSelectMember={scopeState.setMemberScope} totalFolios={dash.folios.length}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        testID="dashboard-scroll"
        scrollEnabled={!chartGestureActive}
        refreshControl={<RefreshControl refreshing={dash.isRefreshing} onRefresh={() => void dash.handleRefresh(assumptions)} tintColor="#3b82f6" colors={['#3b82f6']} />}
      >
        <DashboardCards
          data={summary} historyPoints={dash.historyPoints}
          realityCheckMode={realityCheckMode} setRealityCheckMode={setRealityCheckMode}
          assumptions={assumptions} setAssumptions={handleSaveAssumptions}
          isAssumptionsOpen={isAssumptionsOpen} setIsAssumptionsOpen={setIsAssumptionsOpen}
          performanceMode={performanceMode} onTogglePerformanceMode={setPerformanceMode}
          onGestureActive={setChartGestureActive}
        />
      </ScrollView>
    </View>
  );
}
