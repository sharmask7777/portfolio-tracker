import React from 'react';
import type { PerformanceMode } from '@portfolio/core-view';
import {
  isValidNumber,
  getReturnClass,
  PerformanceCells,
} from './PerformanceCells';
import type { EnrichedFolioView } from '../../types/portfolio';
import { FolioRowActionButtons, formatCurrency } from './FolioRowActionButtons';

interface FolioChildRowProps {
  folio: EnrichedFolioView;
  performanceMode: PerformanceMode;
  realityCheckMode: boolean;
  marginalTaxBracket: number;
  cpiInflationRate: number;
  isRefetching: boolean;
  onSelectFolioForTransactions: (folio: EnrichedFolioView) => void;
  onSimulateSell: (folio: EnrichedFolioView) => void;
  onDeleteManualAsset: (id: string) => Promise<void>;
}

function renderDayChange(dayChange: number | undefined, dayChangePct: number | undefined) {
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

function FolioTitleCell({ folio }: { folio: EnrichedFolioView }) {
  return (
    <td style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>└─</span>
        <span style={{ fontWeight: 500 }}>Folio: {folio.number || 'N/A'}</span>
        {folio.pan && <span className="badge" style={{ fontSize: '0.65rem' }}>{folio.pan}</span>}
      </div>
    </td>
  );
}

function resolveRealizedVal(folio: EnrichedFolioView, realityCheckMode: boolean): number | undefined {
  if (realityCheckMode) {
    return folio.metrics?.netRealizableValue ?? folio.metrics?.currentValue;
  }
  return folio.metrics?.currentValue;
}

/**
 * Child row representing an individual folio position within an expanded multi-folio scheme group.
 */
export const FolioChildRow: React.FC<FolioChildRowProps> = ({
  folio,
  performanceMode,
  realityCheckMode,
  marginalTaxBracket,
  cpiInflationRate,
  isRefetching,
  onSelectFolioForTransactions,
  onSimulateSell,
  onDeleteManualAsset,
}) => {
  const isXirr = performanceMode === 'XIRR';
  const perfVal = isXirr ? folio.metrics?.xirr : folio.metrics?.absoluteReturn;
  const postTaxPerf = isXirr ? folio.metrics?.postTaxXirr : folio.metrics?.postTaxAbsoluteReturn;
  const realizedVal = resolveRealizedVal(folio, realityCheckMode);

  return (
    <tr
      onClick={() => onSelectFolioForTransactions(folio)}
      style={{ cursor: 'pointer', backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.03))' }}
      className="folio-child-row"
    >
      <FolioTitleCell folio={folio} />
      <td>
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Individual Folio</span>
      </td>
      <td>{formatCurrency(folio.metrics?.investedAmount)}</td>
      <td>{formatCurrency(realizedVal)}</td>
      <td className={getReturnClass(folio.metrics?.dayChange)}>
        {renderDayChange(folio.metrics?.dayChange, folio.metrics?.dayChangePercentage)}
      </td>
      <PerformanceCells
        perfVal={perfVal}
        realityCheckMode={realityCheckMode}
        marginalTaxBracket={marginalTaxBracket}
        cpiInflationRate={cpiInflationRate}
        postTaxPerf={postTaxPerf}
        isRefetching={isRefetching}
      />
      <td>
        <FolioRowActionButtons
          folio={folio}
          onSimulateSell={onSimulateSell}
          onDeleteManualAsset={onDeleteManualAsset}
        />
      </td>
    </tr>
  );
};
