import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Calculator } from 'lucide-react-native';
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
  type EnrichedHolding,
} from '../../src/services/portfolio-service';

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
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  simBtn: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f4f4f5',
  },
});

function mapHoldingsToHarvestInputs(holdings: EnrichedHolding[]): HoldingHarvestInput[] {
  return holdings.map((h) => ({
    folioId: h.folio_number,
    schemeName: h.scheme_name,
    isin: h.isin ?? undefined,
    isElss: h.scheme_name.toLowerCase().includes('elss'),
    currentUnits: h.units,
    currentNav: h.current_nav,
    lots: [
      {
        lotId: `LOT-${h.id}`,
        buyDate: '2023-04-01',
        units: h.units,
        buyPrice: h.invested_cost > 0 && h.units > 0 ? h.invested_cost / h.units : h.current_nav * 0.8,
        isElss: h.scheme_name.toLowerCase().includes('elss'),
      },
    ],
  }));
}

interface ActiveSimulationTarget {
  schemeName: string;
  folioId: string;
  units: number;
  currentNav: number;
  isElss: boolean;
}

interface TaxHeaderProps {
  onSimulate: () => void;
}

function TaxHeader({ onSimulate }: TaxHeaderProps): React.ReactElement {
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

function useTaxData(selectedFY: string) {
  const [refreshing, setRefreshing] = useState(false);
  const [taxResult, setTaxResult] = useState<TaxCalculationsResult>(() =>
    computeTaxBreakdowns([], selectedFY)
  );
  const [advanceMatrix, setAdvanceMatrix] = useState<AdvanceTaxAccrualMatrix>(() =>
    buildAdvanceTaxMatrix([])
  );
  const [harvestPlan, setHarvestPlan] = useState<HarvestPlan>(() =>
    buildTaxHarvestPlan([], 0)
  );

  const loadData = useCallback(async () => {
    try {
      const holdings = await getEnrichedHoldings();
      const harvestInputs = mapHoldingsToHarvestInputs(holdings);
      setHarvestPlan(buildTaxHarvestPlan(harvestInputs, 0));
      setTaxResult(computeTaxBreakdowns([], selectedFY));
      setAdvanceMatrix(buildAdvanceTaxMatrix([]));
    } catch {
      // Retain existing state
    }
  }, [selectedFY]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return { refreshing, onRefresh, taxResult, advanceMatrix, harvestPlan };
}

interface MainContentProps {
  selectedFY: string;
  taxResult: TaxCalculationsResult;
  advanceMatrix: AdvanceTaxAccrualMatrix;
  harvestPlan: HarvestPlan;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectFY: (fy: string) => void;
  onSimulateHarvest: (opp: HarvestOpportunity) => void;
  onOpenSimulate: () => void;
}

function MainContent({
  selectedFY,
  taxResult,
  advanceMatrix,
  harvestPlan,
  refreshing,
  onRefresh,
  onSelectFY,
  onSimulateHarvest,
  onOpenSimulate,
}: MainContentProps): React.ReactElement {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TaxHeader onSimulate={onOpenSimulate} />
      <TaxSummaryCard
        selectedFY={selectedFY}
        taxResult={taxResult}
        remainingExemption={harvestPlan.remainingExemption}
        onFYChange={onSelectFY}
      />
      <AdvanceTaxMatrixCard selectedFY={selectedFY} matrix={advanceMatrix} />
      <HarvestOpportunitiesList plan={harvestPlan} onSimulateHarvest={onSimulateHarvest} />
    </ScrollView>
  );
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

  const { refreshing, onRefresh, taxResult, advanceMatrix, harvestPlan } = useTaxData(selectedFY);

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
      <MainContent
        selectedFY={selectedFY}
        taxResult={taxResult}
        advanceMatrix={advanceMatrix}
        harvestPlan={harvestPlan}
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
