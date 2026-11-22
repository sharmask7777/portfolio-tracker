import React from 'react';
import { OverviewTabContent } from './components/Dashboard/OverviewTabContent';
import { XRayView } from './components/Analytics/XRayView';
import { IntersectionView } from './components/Analytics/IntersectionView';
import { TaxView } from './components/Tax/TaxView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InsightsSidebar } from './components/Insights/InsightsSidebar';
import { GoalTracker } from './components/Insights/GoalTracker';
import type { DashboardTab } from './components/Dashboard/DashboardNavigationTabs';
import type { useDashboardController } from './useDashboardController';
import { toFolioView } from './types/portfolio';
import type { PanelFolio } from './components/Dashboard/TransactionSidePanel';

export interface ActiveTabRouterProps {
  activeTab: DashboardTab;
  ctrl: ReturnType<typeof useDashboardController>;
  onSelectTab: (tab: DashboardTab) => void;
}

function renderOverview(ctrl: ReturnType<typeof useDashboardController>, onSelectTab: (tab: DashboardTab) => void) {
  if (!ctrl.portfolio) return null;
  return (
    <OverviewTabContent
      portfolio={ctrl.portfolio}
      performanceMode={ctrl.performanceMode}
      onNavigateToTax={() => onSelectTab('tax')}
      schemeGroups={ctrl.schemeGroups}
      sortedSchemeGroups={ctrl.sortedSchemeGroups}
      expandedSchemeIds={ctrl.expandedSchemeIds}
      onToggleExpanded={(id, e) => {
        if (e) e.stopPropagation();
        ctrl.toggleExpanded(id);
      }}
      exposures={ctrl.exposures}
      selectedProfileId={ctrl.selectedProfileId}
      realityCheckMode={ctrl.realityCheckMode}
      marginalTaxBracket={ctrl.marginalTaxBracket}
      cpiInflationRate={ctrl.cpiInflationRate}
      isRefetching={ctrl.isRefetching}
      sortField={ctrl.sortField}
      sortDirection={ctrl.sortDirection}
      onSort={ctrl.handleSort}
      onSelectFolioForTransactions={(f) => ctrl.setSelectedFolioForTransactions(f as PanelFolio)}
      onSimulateSell={(f) => {
        ctrl.setSimFolio(toFolioView(f));
        ctrl.setSimUnits(null);
      }}
      onDeleteManualAsset={ctrl.handleDeleteManualAsset}
      showClosedFolios={ctrl.showClosedFolios}
      onToggleShowClosedFolios={() => ctrl.setShowClosedFolios(!ctrl.showClosedFolios)}
      onDeleteFolio={ctrl.handleDeleteFolio}
    />
  );
}

function renderAnalytics(
  activeTab: DashboardTab,
  ctrl: ReturnType<typeof useDashboardController>,
  onSelectTab: (tab: DashboardTab) => void
) {
  if (activeTab === 'xray') {
    return (
      <XRayView
        data={ctrl.xrayData}
        exposures={ctrl.exposures}
        excludeArbitrage={ctrl.excludeArbitrage}
        onToggleExcludeArbitrage={ctrl.handleToggleExcludeArbitrage}
        onNavigateToIntersection={(stock) => {
          if (stock) ctrl.setIntersectionSearchQuery(stock);
          onSelectTab('intersection');
        }}
      />
    );
  }
  return (
    <IntersectionView
      exposures={ctrl.exposures}
      isLoading={ctrl.loading}
      onUploadClick={() => ctrl.setShowUpload(true)}
      initialSearchQuery={ctrl.intersectionSearchQuery}
      excludeArbitrage={ctrl.excludeArbitrage}
      onToggleExcludeArbitrage={ctrl.handleToggleExcludeArbitrage}
    />
  );
}

function renderTaxAndInsights(
  activeTab: DashboardTab,
  ctrl: ReturnType<typeof useDashboardController>,
  activeAssets: Array<{ id: string; name: string; type: string }>
) {
  if (!ctrl.portfolio) return null;
  if (activeTab === 'tax') {
    return (
      <ErrorBoundary>
        <TaxView
          summary={ctrl.taxSummary ?? { details: [] }}
          harvesting={ctrl.harvesting}
          onSimulateHarvest={(folioId, units) => {
            const folio = ctrl.portfolio?.folios.find((f) => f.id === folioId);
            if (folio) {
              ctrl.setSimFolio(toFolioView(folio));
              ctrl.setSimUnits(units);
            }
          }}
        />
      </ErrorBoundary>
    );
  }
  return (
    <div className="xray-grid">
      <InsightsSidebar portfolioId={ctrl.portfolio.id} />
      <GoalTracker
        portfolioId={ctrl.portfolio.id}
        currentValue={ctrl.portfolio.metrics.totalValue}
        activeAssets={activeAssets}
      />
    </div>
  );
}

export function ActiveTabRouter({ activeTab, ctrl, onSelectTab }: ActiveTabRouterProps) {
  const activeAssets = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string }>();
    ctrl.portfolio?.folios.forEach((f) => {
      if (f.asset?.id) {
        map.set(f.asset.id, {
          id: f.asset.id,
          name: f.asset.name || 'Unknown',
          type: f.asset.type || 'MUTUAL_FUND',
        });
      }
    });
    return Array.from(map.values());
  }, [ctrl.portfolio?.folios]);

  if (activeTab === 'overview') {
    return renderOverview(ctrl, onSelectTab);
  }
  if (activeTab === 'xray' || activeTab === 'intersection') {
    return renderAnalytics(activeTab, ctrl, onSelectTab);
  }
  if (activeTab === 'tax' || activeTab === 'insights') {
    return renderTaxAndInsights(activeTab, ctrl, activeAssets);
  }
  return null;
}
