import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { usePortfolioScope } from '@portfolio/core-view';
import {
  getEnrichedHoldings,
  refreshPortfolio,
  summarizeHoldings,
  type DashboardSummary,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  filterHoldingsForProfile,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { getCachedPortfolioHistory } from '../../src/services/history-service';
import type { HistoryPoint } from '../../src/types/generated';
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
  content: { padding: 20, paddingTop: 48 },
  header: { marginBottom: 16 },
  greeting: { fontSize: 13, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4f4f5' },
  emptyCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f4f4f5', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' },
});

function useDashboardData() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [enriched, storedProfiles, storedFolios, cachedHistory] = await Promise.all([
        getEnrichedHoldings(),
        getStoredFamilyProfiles(),
        getStoredFolios(),
        getCachedPortfolioHistory(),
      ]);
      setHoldings(enriched);
      setProfiles(storedProfiles);
      setFolios(storedFolios);
      setHistoryPoints(cachedHistory);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshPortfolio();
      await loadData();
    } catch {
      // Fallback
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => { void loadData(); }, [loadData]);
  return { holdings, profiles, folios, historyPoints, isLoading, isRefreshing, handleRefresh };
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
  const nominalReturnPct = data.totalInvestedCost > 0 ? (data.unrealizedGain / data.totalInvestedCost) : 0;

  return (
    <>
      <RealityCheckModeToggle realityCheckMode={realityCheckMode} onToggle={setRealityCheckMode} onOpenAssumptions={() => setIsAssumptionsOpen(true)} />
      <AssumptionsModal visible={isAssumptionsOpen} onClose={() => setIsAssumptionsOpen(false)} assumptions={assumptions} onSaveAssumptions={setAssumptions} />
      {realityCheckMode && (
        <RealityCheckBanner
          nominalValue={data.totalCurrentValue}
          investedCost={data.totalInvestedCost}
          nominalReturnPct={nominalReturnPct}
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
}

function DashboardCards(props: DashboardCardsProps): React.ReactElement {
  const { data, historyPoints } = props;
  const hasHoldings = data.holdingsCount > 0;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.greeting}>Offline Portfolio</Text>
        <Text style={styles.title}>Dashboard</Text>
      </View>
      <RealityCheckSection {...props} />
      <NetWorthCard totalCurrentValue={data.totalCurrentValue} totalInvestedCost={data.totalInvestedCost} unrealizedGain={data.unrealizedGain} unrealizedGainPct={data.unrealizedGainPct} />
      <DayReturnBanner dayGain={data.dayGain} dayGainPct={data.dayGainPct} isOfflineFallback={data.isOfflineFallback} />
      <HistoricalTrendChart
        currentValue={data.totalCurrentValue}
        investedCost={data.totalInvestedCost}
        historyPoints={historyPoints}
      />
      {hasHoldings ? <AssetAllocationCard allocation={data.assetAllocation} totalValue={data.totalCurrentValue} /> : renderEmptyState()}
    </>
  );
}

function useFilteredSummary(holdings: EnrichedHolding[], profiles: FamilyProfile[], folios: FolioEntity[]) {
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const activeProfile = useMemo(() => {
    if (!scopeState.activeProfileId) return null;
    return profiles.find((p) => p.id === scopeState.activeProfileId) ?? null;
  }, [scopeState.activeProfileId, profiles]);

  const filteredHoldings = useMemo(
    () => filterHoldingsForProfile(activeProfile, holdings, folios),
    [activeProfile, holdings, folios]
  );

  const summary = useMemo(() => {
    if (filteredHoldings.length === 0) return defaultSummary;
    return { ...summarizeHoldings(filteredHoldings), isOfflineFallback: false };
  }, [filteredHoldings]);

  return { scopeState, summary };
}

/**
 * Main mobile dashboard screen. Displays top-level ScopeSelectorHeader,
 * net worth, today's returns banner, Reality Check mode toggle & waterfall teardown,
 * Historical Valuation Trend chart, and asset allocation breakdown.
 *
 * @returns React Native dashboard tab element
 */
export default function DashboardScreen(): React.ReactElement {
  const { holdings, profiles, folios, historyPoints, isLoading, isRefreshing, handleRefresh } = useDashboardData();
  const { scopeState, summary } = useFilteredSummary(holdings, profiles, folios);
  const [realityCheckMode, setRealityCheckMode] = useState(false);
  const [assumptions, setAssumptions] = useState<RealityCheckAssumptions>(DEFAULT_ASSUMPTIONS);
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);

  if (isLoading && holdings.length === 0) {
    return (
      <View style={styles.center} testID="dashboard-loading">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScopeSelectorHeader
        scope={scopeState.scope}
        profiles={profiles}
        onSelectConsolidated={scopeState.setConsolidated}
        onSelectMember={scopeState.setMemberScope}
        totalFolios={folios.length}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        testID="dashboard-scroll"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
      >
        <DashboardCards
          data={summary}
          historyPoints={historyPoints}
          realityCheckMode={realityCheckMode}
          setRealityCheckMode={setRealityCheckMode}
          assumptions={assumptions}
          setAssumptions={setAssumptions}
          isAssumptionsOpen={isAssumptionsOpen}
          setIsAssumptionsOpen={setIsAssumptionsOpen}
        />
      </ScrollView>
    </View>
  );
}
