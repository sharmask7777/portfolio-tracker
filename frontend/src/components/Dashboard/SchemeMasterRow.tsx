import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ConsolidatedSchemeGroup, PerformanceMode } from '@portfolio/core-view';
import type { EnrichedFolioView } from '../../types/portfolio';
import {
  isValidNumber,
  getReturnClass,
  PerformanceCells,
} from './PerformanceCells';
import { FolioRowActionButtons, formatCurrency } from './FolioRowActionButtons';

interface SchemeMasterRowProps {
  group: ConsolidatedSchemeGroup;
  expandedSchemeIds: ReadonlySet<string>;
  onToggleExpanded: (schemeId: string, e?: React.MouseEvent) => void;
  selectedProfileId: string | null;
  performanceMode: PerformanceMode;
  realityCheckMode: boolean;
  marginalTaxBracket: number;
  cpiInflationRate: number;
  isRefetching: boolean;
  onSelectFolioForTransactions: (folio: EnrichedFolioView) => void;
  onSimulateSell: (folio: EnrichedFolioView) => void;
  onDeleteManualAsset: (id: string) => Promise<void>;
}

function renderDayChange(dayChange: number, dayChangePct: number) {
  if (!isValidNumber(dayChange)) return '-';
  const sign = dayChange > 0 ? '+' : '';
  const pctStr = isValidNumber(dayChangePct)
    ? `${dayChangePct > 0 ? '+' : ''}${dayChangePct.toFixed(2)}%`
    : 'N/A';
  return (
    <>
      {sign}{formatCurrency(dayChange)}
      <div style={{ fontSize: '0.75rem' }}>({pctStr})</div>
    </>
  );
}

function SchemeNameCell({
  group,
  isMultiFolio,
  isExpanded,
  selectedProfileId,
  onToggleExpanded,
}: {
  group: ConsolidatedSchemeGroup;
  isMultiFolio: boolean;
  isExpanded: boolean;
  selectedProfileId: string | null;
  onToggleExpanded: (schemeId: string, e?: React.MouseEvent) => void;
}) {
  return (
    <td style={{ fontWeight: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {isMultiFolio && (
          <button
            className="theme-toggle"
            style={{ padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={(e) => onToggleExpanded(group.id, e)}
            title={isExpanded ? 'Collapse folios' : 'Expand folios'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <span>{group.schemeName}</span>
        {selectedProfileId === null && group.pans.length > 0 && (
          <span
            className="badge badge-slab"
            style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            title={`Member PAN: ${group.pans.join(', ')}`}
          >
            {group.pans.join(', ')}
          </span>
        )}
        {isMultiFolio && (
          <span className="badge badge-slab" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
            {group.folioCount} Folios
          </span>
        )}
      </div>
    </td>
  );
}

/**
 * Renders the master row for a consolidated mutual fund or asset scheme.
 */
export const SchemeMasterRow: React.FC<SchemeMasterRowProps> = ({
  group,
  expandedSchemeIds,
  onToggleExpanded,
  selectedProfileId,
  performanceMode,
  realityCheckMode,
  marginalTaxBracket,
  cpiInflationRate,
  isRefetching,
  onSelectFolioForTransactions,
  onSimulateSell,
  onDeleteManualAsset,
}) => {
  const isMultiFolio = group.folioCount > 1;
  const isExpanded = expandedSchemeIds.has(group.id);
  const primaryFolio = group.folios[0] as EnrichedFolioView | undefined;
  const isXirr = performanceMode === 'XIRR';
  const perfVal = isXirr ? group.metrics.xirr : group.metrics.absoluteReturn;
  const postTaxPerf = isXirr ? group.metrics.postTaxXirr : group.metrics.postTaxAbsoluteReturn;
  const valToShow = realityCheckMode ? group.metrics.netRealizableValue : group.metrics.currentValue;

  const handleRowClick = () => {
    if (isMultiFolio) {
      onToggleExpanded(group.id);
    } else if (primaryFolio) {
      onSelectFolioForTransactions(primaryFolio);
    }
  };

  return (
    <tr
      className={`scheme-master-row ${isMultiFolio ? 'has-multiple-folios' : ''}`}
      onClick={handleRowClick}
      style={{ cursor: 'pointer' }}
    >
      <SchemeNameCell
        group={group}
        isMultiFolio={isMultiFolio}
        isExpanded={isExpanded}
        selectedProfileId={selectedProfileId}
        onToggleExpanded={onToggleExpanded}
      />
      <td>
        <span className="badge badge-slab">{group.type.replace('_', ' ')}</span>
      </td>
      <td>{formatCurrency(group.metrics.investedAmount)}</td>
      <td>{formatCurrency(valToShow)}</td>
      <td className={getReturnClass(group.metrics.dayChange)}>
        {renderDayChange(group.metrics.dayChange, group.metrics.dayChangePercentage)}
      </td>
      <PerformanceCells
        perfVal={perfVal}
        realityCheckMode={realityCheckMode}
        type={group.type}
        marginalTaxBracket={marginalTaxBracket}
        cpiInflationRate={cpiInflationRate}
        postTaxPerf={postTaxPerf}
        isRefetching={isRefetching}
      />
      <td>
        {!isMultiFolio && primaryFolio ? (
          <FolioRowActionButtons
            folio={primaryFolio}
            onSimulateSell={onSimulateSell}
            onDeleteManualAsset={onDeleteManualAsset}
          />
        ) : (
          <button
            className="theme-toggle"
            onClick={(e) => onToggleExpanded(group.id, e)}
            title={isExpanded ? 'Collapse folios' : 'Expand folios'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </td>
    </tr>
  );
};
