import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Calculator } from 'lucide-react-native';
import { usePortfolioScope } from '@portfolio/core-view';
import {
  TaxSummaryCard,
  AdvanceTaxMatrixCard,
  HarvestOpportunitiesList,
  SimulationModal,
} from '../../src/components/Tax';
import {
  buildTaxHarvestPlan,
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
  type TaxCalculationsResult,
  type AdvanceTaxAccrualMatrix,
  type HarvestPlan,
  type HarvestOpportunity,
  type HoldingHarvestInput,
} from '../../src/services/tax-harvesting';
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
  mapServerTableFToMatrix,
  mapServerSummaryToResult,
} from '../../src/services/tax-summary-mapper';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  filterHoldingsForProfile,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 20, paddingTop: 48 },
  header: { marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 12, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4f4f5' },
  simBtn: { backgroundColor: '#27272a', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46', flexDirection: 'row', alignItems: 'center', gap: 6 },
  simBtnText: { fontSize: 12, fontWeight: '600', color: '#f4f4f5' },
});

function mapHoldingsToHarvestInputs(holdings: EnrichedHolding[]): HoldingHarvestInput[] {
  return holdings.map((h) => {
    const buyPrice = h.invested_cost > 0 && h.units > 0 ? h.invested_cost / h.units : h.current_nav * 0.8;
    const buyDate = h.nav_date && !isNaN(Date.parse(h.nav_date))
      ? h.nav_date
      : new Date().toISOString().split('T')[0] ?? '2024-04-01';
    const isElss = h.scheme_name.toLowerCase().includes('elss');

    return {
      folioId: h.folio_number,
      schemeName: h.scheme_name,
      isin: h.isin ?? undefined,
      isElss,
      currentUnits: h.units,
      currentNav: h.current_nav,
      lots: [
        {
          lotId: `LOT-${h.id}`,
          buyDate,
          units: h.units,
          buyPrice,
          isElss,
        },
      ],
    };
  });
}

interface ActiveSimulationTarget {
  schemeName: string;
  folioId: string;
  units: number;
  currentNav: number;
  isElss: boolean;
}

function TaxHeader({ onSimulate }: { onSimulate: () => void }): React.ReactElement {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.category}>Statutory Compliance</Text>
        <Text style={styles.title}>Tax & ITR</Text>
      </View>
      <TouchableOpacity
        style={styles.simBtn}
        testID="open-sell-simulation-btn"
        onPress={onSimulate}
        accessibilityRole="button"
        accessibilityLabel="Open sell redemption simulation modal"
      >
        <Calculator size={15} color="#38bdf8" />
        <Text style={styles.simBtnText}>Simulate Sell</Text>
      </TouchableOpacity>
    </View>
  );
}

function useTaxData() {
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

interface TaxDerivedCalculations {
  taxResult: TaxCalculationsResult;
  advanceMatrix: AdvanceTaxAccrualMatrix;
  harvestPlan: HarvestPlan;
}

function useTaxCalculations(
  filteredHoldings: EnrichedHolding[],
  selectedFY: string,
  cachedAnalytics: CachedAnalyticsResult | null,
): TaxDerivedCalculations {
  const taxResult = useMemo(() => {
    if (cachedAnalytics?.taxSummary) {
      return mapServerSummaryToResult(cachedAnalytics.taxSummary, selectedFY);
    }
    return computeTaxBreakdowns([], selectedFY);
  }, [cachedAnalytics, selectedFY]);

  const harvestPlan = useMemo(() => {
    const harvestInputs = mapHoldingsToHarvestInputs(filteredHoldings);
    const realizedLtcg = Math.max(0, taxResult.totalEquityLTCG);
    return buildTaxHarvestPlan(harvestInputs, realizedLtcg);
  }, [filteredHoldings, taxResult.totalEquityLTCG]);

  const advanceMatrix = useMemo(() => {
    if (cachedAnalytics?.taxSummary) {
      const tableF = cachedAnalytics.taxSummary['tableF'] as Record<string, unknown> | undefined;
      return mapServerTableFToMatrix(tableF);
    }
    return buildAdvanceTaxMatrix([]);
  }, [cachedAnalytics]);

  return { taxResult, advanceMatrix, harvestPlan };
}

interface MainContentProps {
  selectedFY: string;
  calcs: TaxDerivedCalculations;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectFY: (fy: string) => void;
  onSimulateHarvest: (opp: HarvestOpportunity) => void;
  onOpenSimulate: () => void;
}

function MainContent(props: MainContentProps): React.ReactElement {
  const { selectedFY, calcs, refreshing, onRefresh, onSelectFY, onSimulateHarvest, onOpenSimulate } = props;
  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <TaxHeader onSimulate={onOpenSimulate} />
      <TaxSummaryCard
        selectedFY={selectedFY}
        taxResult={calcs.taxResult}
        remainingExemption={calcs.harvestPlan.remainingExemption}
        onFYChange={onSelectFY}
      />
      <AdvanceTaxMatrixCard selectedFY={selectedFY} matrix={calcs.advanceMatrix} />
      <HarvestOpportunitiesList plan={calcs.harvestPlan} onSimulateHarvest={onSimulateHarvest} />
    </ScrollView>
  );
}

function useTaxScopeFilter(holdings: EnrichedHolding[], profiles: FamilyProfile[], folios: FolioEntity[]) {
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const activeProfile = useMemo(() => {
    if (!scopeState.activeProfileId) return null;
    return profiles.find((p) => p.id === scopeState.activeProfileId) ?? null;
  }, [scopeState.activeProfileId, profiles]);

  const filteredHoldings = useMemo(
    () => filterHoldingsForProfile(activeProfile, holdings, folios),
    [activeProfile, holdings, folios],
  );

  return { scopeState, filteredHoldings };
}

/**
 * Tax & Statutory Compliance Tab screen.
 *
 * @returns React Native tax tab screen component
 */
export default function TaxScreen(): React.ReactElement {
  const [selectedFY, setSelectedFY] = useState<string>('2024-25');
  const [simModalOpen, setSimModalOpen] = useState<boolean>(false);
  const [simTarget, setSimTarget] = useState<ActiveSimulationTarget | null>(null);

  const { refreshing, onRefresh, holdings, profiles, folios, cachedAnalytics } = useTaxData();
  const { scopeState, filteredHoldings } = useTaxScopeFilter(holdings, profiles, folios);
  const calcs = useTaxCalculations(filteredHoldings, selectedFY, cachedAnalytics);

  const handleSimulateHarvest = (opportunity: HarvestOpportunity) => {
    setSimTarget({
      schemeName: opportunity.schemeName,
      folioId: opportunity.folioId,
      units: opportunity.unitsToHarvest,
      currentNav: opportunity.currentNav,
      isElss: opportunity.schemeName.toLowerCase().includes('elss'),
    });
    setSimModalOpen(true);
  };

  return (
    <View style={styles.container}>
      <ScopeSelectorHeader
        scope={scopeState.scope}
        profiles={profiles}
        onSelectConsolidated={scopeState.setConsolidated}
        onSelectMember={scopeState.setMemberScope}
        totalFolios={folios.length}
      />
      <MainContent
        selectedFY={selectedFY}
        calcs={calcs}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onSelectFY={setSelectedFY}
        onSimulateHarvest={handleSimulateHarvest}
        onOpenSimulate={() => { setSimTarget(null); setSimModalOpen(true); }}
      />
      <SimulationModal
        visible={simModalOpen}
        onClose={() => setSimModalOpen(false)}
        schemeName={simTarget?.schemeName ?? 'Portfolio Mutual Fund'}
        folioId={simTarget?.folioId ?? 'FOLIO-1'}
        initialUnits={simTarget?.units}
        currentNav={simTarget?.currentNav ?? 100}
        isElss={simTarget?.isElss ?? false}
      />
    </View>
  );
}
