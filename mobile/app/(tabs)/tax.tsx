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
import { exportScheduleCgCsv } from '../../src/services/itr-csv-service';
import {
  buildTaxHarvestPlan,
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
  type TaxCalculationsResult,
  type AdvanceTaxAccrualMatrix,
  type HarvestPlan,
  type HarvestOpportunity,
} from '../../src/services/tax-harvesting';
import { refreshPortfolio } from '../../src/services/portfolio-service';
import {
  getCachedPortfolioAnalytics,
  syncScopedAnalytics,
  type CachedAnalyticsResult,
} from '../../src/services/analytics-sync-service';
import {
  mapServerTableFToMatrix,
  mapServerSummaryToResult,
  mapHarvestTicketToPlan,
} from '../../src/services/tax-summary-mapper';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  content: { padding: 20, paddingTop: 16 },
  header: { marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 12, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#f4f4f5' },
  simBtn: { backgroundColor: '#27272a', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46', flexDirection: 'row', alignItems: 'center', gap: 6 },
  simBtnText: { fontSize: 12, fontWeight: '600', color: '#f4f4f5' },
});

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

function useTaxData(scopeId: string, selectedFY: string) {
  const [refreshing, setRefreshing] = useState(false);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [cachedAnalytics, setCachedAnalytics] = useState<CachedAnalyticsResult | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [storedProfiles, storedFolios, analytics] = await Promise.all([
        getStoredFamilyProfiles(),
        getStoredFolios(),
        getCachedPortfolioAnalytics(undefined, scopeId, selectedFY),
      ]);
      setProfiles(storedProfiles);
      setFolios(storedFolios);
      setCachedAnalytics(analytics);
    } catch {
      // Retain state
    }
  }, [scopeId, selectedFY]);

  useEffect(() => {
    void loadData();
    void Promise.all([refreshPortfolio(), syncScopedAnalytics(scopeId, selectedFY)]).then(
      ([, synced]) => {
        setCachedAnalytics(synced);
        void loadData();
      },
    );
  }, [loadData, scopeId, selectedFY]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const [, synced] = await Promise.all([
      refreshPortfolio(),
      syncScopedAnalytics(scopeId, selectedFY),
    ]);
    setCachedAnalytics(synced);
    await loadData();
    setRefreshing(false);
  }, [loadData, scopeId, selectedFY]);

  return { refreshing, onRefresh, profiles, folios, cachedAnalytics };
}

interface TaxDerivedCalculations {
  taxResult: TaxCalculationsResult;
  advanceMatrix: AdvanceTaxAccrualMatrix;
  harvestPlan: HarvestPlan;
}

function useTaxCalculations(
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
    if (cachedAnalytics?.harvestTicket) {
      return mapHarvestTicketToPlan(cachedAnalytics.harvestTicket, selectedFY);
    }
    const realizedLtcg = Math.max(0, taxResult.totalEquityLTCG);
    return buildTaxHarvestPlan([], realizedLtcg);
  }, [cachedAnalytics, selectedFY, taxResult.totalEquityLTCG]);

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
  onExportScheduleCg: () => void;
}

function MainContent(props: MainContentProps): React.ReactElement {
  const {
    selectedFY,
    calcs,
    refreshing,
    onRefresh,
    onSelectFY,
    onSimulateHarvest,
    onOpenSimulate,
    onExportScheduleCg,
  } = props;
  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <TaxHeader onSimulate={onOpenSimulate} />
      <TaxSummaryCard
        selectedFY={selectedFY}
        taxResult={calcs.taxResult}
        remainingExemption={calcs.harvestPlan.remainingExemption}
        onFYChange={onSelectFY}
        onExportScheduleCg={onExportScheduleCg}
      />
      <AdvanceTaxMatrixCard selectedFY={selectedFY} matrix={calcs.advanceMatrix} />
      <HarvestOpportunitiesList plan={calcs.harvestPlan} onSimulateHarvest={onSimulateHarvest} />
    </ScrollView>
  );
}

function useTaxSimulation() {
  const [simModalOpen, setSimModalOpen] = useState<boolean>(false);
  const [simTarget, setSimTarget] = useState<ActiveSimulationTarget | null>(null);

  const handleSimulateHarvest = useCallback((opportunity: HarvestOpportunity) => {
    setSimTarget({
      schemeName: opportunity.schemeName,
      folioId: opportunity.folioId,
      units: opportunity.unitsToHarvest,
      currentNav: opportunity.currentNav,
      isElss: opportunity.schemeName.toLowerCase().includes('elss'),
    });
    setSimModalOpen(true);
  }, []);

  const openBlankSimulate = useCallback(() => {
    setSimTarget(null);
    setSimModalOpen(true);
  }, []);

  return { simModalOpen, setSimModalOpen, simTarget, handleSimulateHarvest, openBlankSimulate };
}

function resolveSimDefaults(simTarget: ActiveSimulationTarget | null) {
  return {
    schemeName: simTarget?.schemeName ?? 'Portfolio Mutual Fund',
    folioId: simTarget?.folioId ?? 'FOLIO-1',
    initialUnits: simTarget?.units,
    currentNav: simTarget?.currentNav ?? 100,
    isElss: simTarget?.isElss ?? false,
  };
}

/**
 * Tax & Statutory Compliance Tab screen.
 *
 * @returns React Native tax tab screen component
 */
export default function TaxScreen(): React.ReactElement {
  const [selectedFY, setSelectedFY] = useState<string>('2024-25');
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const scopeId = scopeState.activeProfileId ?? 'consolidated';
  const { simModalOpen, setSimModalOpen, simTarget, handleSimulateHarvest, openBlankSimulate } = useTaxSimulation();
  const { refreshing, onRefresh, profiles, folios, cachedAnalytics } = useTaxData(scopeId, selectedFY);
  const calcs = useTaxCalculations(selectedFY, cachedAnalytics);
  const simProps = resolveSimDefaults(simTarget);

  const handleExportScheduleCg = useCallback(() => {
    void exportScheduleCgCsv(selectedFY, calcs.taxResult, calcs.advanceMatrix);
  }, [selectedFY, calcs.taxResult, calcs.advanceMatrix]);

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
        onOpenSimulate={openBlankSimulate}
        onExportScheduleCg={handleExportScheduleCg}
      />
      <SimulationModal
        visible={simModalOpen}
        onClose={() => setSimModalOpen(false)}
        {...simProps}
      />
    </View>
  );
}
