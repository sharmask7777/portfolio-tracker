import React from 'react';
import type {
  ConsolidatedSchemeGroup,
  PerformanceMode,
  SchemeSortField,
  SortDirection,
  FolioInput,
} from '@portfolio/core-view';
import type { EnrichedFolioView } from '../../types/portfolio';
import { SortHeaderCell } from './SortHeaderCell';
import { SchemeMasterRow } from './SchemeMasterRow';
import { FolioChildRow } from './FolioChildRow';
import { ClosedFoliosSection } from './ClosedFoliosSection';

export interface HoldingsTableSectionProps {
  sortedSchemeGroups: readonly ConsolidatedSchemeGroup[];
  expandedSchemeIds: ReadonlySet<string>;
  onToggleExpanded: (schemeId: string, e?: React.MouseEvent) => void;
  selectedProfileId: string | null;
  performanceMode: PerformanceMode;
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
  closedFolios?: EnrichedFolioView[] | undefined;
  showClosedFolios: boolean;
  onToggleShowClosedFolios: () => void;
  onDeleteFolio: (folio: EnrichedFolioView) => Promise<void>;
}

/**
 * Renders the consolidated holdings data table, expanded child folios, and closed positions drawer.
 */
export const HoldingsTableSection: React.FC<HoldingsTableSectionProps> = ({
  sortedSchemeGroups,
  expandedSchemeIds,
  onToggleExpanded,
  selectedProfileId,
  performanceMode,
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
  closedFolios,
  showClosedFolios,
  onToggleShowClosedFolios,
  onDeleteFolio,
}) => {
  return (
    <>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <SortHeaderCell label="Scheme Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label="Type" field="type" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label="Invested" field="invested" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label={realityCheckMode ? 'Net Realizable Value' : 'Current Value'} field="value" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label="Day Change" field="dayChange" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label={performanceMode === 'XIRR' ? 'XIRR' : 'Return'} field="performance" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <SortHeaderCell label={`Post-Tax ${performanceMode === 'XIRR' ? 'XIRR' : 'Return'}`} field="postTaxPerformance" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSchemeGroups.map((group) => {
              const isMultiFolio = group.folioCount > 1;
              const isExpanded = expandedSchemeIds.has(group.id);

              return (
                <React.Fragment key={group.id}>
                  <SchemeMasterRow
                    group={group}
                    expandedSchemeIds={expandedSchemeIds}
                    onToggleExpanded={onToggleExpanded}
                    selectedProfileId={selectedProfileId}
                    performanceMode={performanceMode}
                    realityCheckMode={realityCheckMode}
                    marginalTaxBracket={marginalTaxBracket}
                    cpiInflationRate={cpiInflationRate}
                    isRefetching={isRefetching}
                    onSelectFolioForTransactions={onSelectFolioForTransactions}
                    onSimulateSell={onSimulateSell}
                    onDeleteManualAsset={onDeleteManualAsset}
                  />
                  {isMultiFolio && isExpanded && group.folios.map((folio: FolioInput) => (
                    <FolioChildRow
                      key={folio.id}
                      folio={folio as EnrichedFolioView}
                      performanceMode={performanceMode}
                      realityCheckMode={realityCheckMode}
                      marginalTaxBracket={marginalTaxBracket}
                      cpiInflationRate={cpiInflationRate}
                      isRefetching={isRefetching}
                      onSelectFolioForTransactions={onSelectFolioForTransactions}
                      onSimulateSell={onSimulateSell}
                      onDeleteManualAsset={onDeleteManualAsset}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {closedFolios && closedFolios.length > 0 && (
        <ClosedFoliosSection
          closedFolios={closedFolios}
          showClosedFolios={showClosedFolios}
          onToggleShowClosedFolios={onToggleShowClosedFolios}
          onSelectFolioForTransactions={onSelectFolioForTransactions}
          onDeleteFolio={onDeleteFolio}
        />
      )}
    </>
  );
};
