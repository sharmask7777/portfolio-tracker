import React from 'react';
import { StatsGrid } from './StatsGrid';
import { HistoryChart } from './HistoryChart';
import { OverviewCardsSection } from './OverviewCardsSection';
import { HoldingsTableSection } from './HoldingsTableSection';
import type { PortfolioSummaryResponse, EnrichedFolioView } from '../../types/portfolio';
import type { ConsolidatedSchemeGroup, PerformanceMode, SchemeSortField, SortDirection } from '@portfolio/core-view';
import type { StockExposure } from '../../utils/hierarchy-types';

interface OverviewTabContentProps {
  portfolio: PortfolioSummaryResponse;
  performanceMode: PerformanceMode;
  onNavigateToTax: () => void;
  schemeGroups: readonly ConsolidatedSchemeGroup[];
  sortedSchemeGroups: readonly ConsolidatedSchemeGroup[];
  expandedSchemeIds: ReadonlySet<string>;
  onToggleExpanded: (schemeId: string, e?: React.MouseEvent) => void;
  exposures: StockExposure[];
  selectedProfileId: string | null;
  realityCheckMode: boolean;
  marginalTaxBracket: number;
  cpiInflationRate: number;
  isRefetching: boolean;
  sortField: SchemeSortField | null;
  sortDirection: SortDirection | null;
  onSort: (field: SchemeSortField) => void;
  onSelectFolioForTransactions: (folio: EnrichedFolioView) => void;
  onSimulateSell: (folio: EnrichedFolioView) => void;
  onDeleteManualAsset: (assetId: string) => Promise<void>;
  showClosedFolios: boolean;
  onToggleShowClosedFolios: () => void;
  onDeleteFolio: (folio: EnrichedFolioView) => Promise<void>;
}

/**
 * Renders the complete Overview tab body: stats grid, historical chart, analytical breakdown, and holdings table.
 */
export const OverviewTabContent: React.FC<OverviewTabContentProps> = ({
  portfolio,
  performanceMode,
  onNavigateToTax,
  schemeGroups,
  sortedSchemeGroups,
  expandedSchemeIds,
  onToggleExpanded,
  exposures,
  selectedProfileId,
  realityCheckMode,
  marginalTaxBracket,
  cpiInflationRate,
  isRefetching,
  sortField,
  sortDirection,
  onSort,
  onSelectFolioForTransactions,
  onSimulateSell,
  onDeleteManualAsset,
  showClosedFolios,
  onToggleShowClosedFolios,
  onDeleteFolio,
}) => {
  return (
    <>
      <StatsGrid
        metrics={portfolio.metrics}
        performanceMode={performanceMode}
        onNavigateToTax={onNavigateToTax}
      />
      <HistoryChart portfolioId={portfolio.id} />
      <OverviewCardsSection
        portfolioId={portfolio.id}
        schemeGroups={schemeGroups}
        performanceMode={performanceMode}
        exposures={exposures}
      />
      <HoldingsTableSection
        sortedSchemeGroups={sortedSchemeGroups}
        expandedSchemeIds={expandedSchemeIds}
        onToggleExpanded={onToggleExpanded}
        selectedProfileId={selectedProfileId}
        performanceMode={performanceMode}
        realityCheckMode={realityCheckMode}
        marginalTaxBracket={marginalTaxBracket}
        cpiInflationRate={cpiInflationRate}
        isRefetching={isRefetching}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={onSort}
        onSelectFolioForTransactions={onSelectFolioForTransactions}
        onSimulateSell={onSimulateSell}
        onDeleteManualAsset={onDeleteManualAsset}
        closedFolios={portfolio.closedFolios}
        showClosedFolios={showClosedFolios}
        onToggleShowClosedFolios={onToggleShowClosedFolios}
        onDeleteFolio={onDeleteFolio}
      />
    </>
  );
};
