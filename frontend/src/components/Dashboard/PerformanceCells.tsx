import React from 'react';

interface PerformanceCellProps {
  perfVal: number | undefined;
  realityCheckMode: boolean;
  type?: string | undefined;
  marginalTaxBracket: number;
  cpiInflationRate: number;
  postTaxPerf: number | undefined;
  isRefetching: boolean;
  isNominal?: boolean;
}

export function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

export function getReturnClass(val: unknown): string {
  if (!isValidNumber(val)) return '';
  return val > 0 ? 'positive' : val < 0 ? 'negative' : '';
}

export function formatPercent(val: unknown): string {
  if (!isValidNumber(val)) return 'N/A';
  return `${(val * 100).toFixed(2)}%`;
}

/**
 * Pre-tax and Post-tax performance table cells with negative real return warnings.
 */
export const PerformanceCells: React.FC<PerformanceCellProps> = ({
  perfVal,
  realityCheckMode,
  type,
  marginalTaxBracket,
  cpiInflationRate,
  postTaxPerf,
  isRefetching,
}) => {
  const isDebtOrLiquid = type === 'DEBT' || type === 'LIQUID';
  const isNegativeReal =
    realityCheckMode &&
    isDebtOrLiquid &&
    isValidNumber(perfVal) &&
    perfVal * (1 - marginalTaxBracket) < cpiInflationRate;

  return (
    <>
      <td className={getReturnClass(perfVal)}>
        {formatPercent(perfVal)}
        {realityCheckMode && (
          <span
            className="badge badge-slab"
            style={{ marginLeft: '4px', fontSize: '0.65rem', verticalAlign: 'middle' }}
            title="Nominal pre-tax XIRR (Aggregate portfolio real post-tax XIRR shown in Reality Check banner above)"
          >
            Nominal
          </span>
        )}
        {isNegativeReal && (
          <span
            title={`Negative real return: Estimated yield after ${Math.round(marginalTaxBracket * 100)}% slab tax and ${Math.round(cpiInflationRate * 100)}% inflation is negative`}
            style={{ color: 'var(--warning-color)', marginLeft: '4px', cursor: 'help' }}
          >
            ●
          </span>
        )}
      </td>
      <td
        className={getReturnClass(postTaxPerf)}
        style={{ opacity: isRefetching ? 0.5 : 1, transition: 'opacity 0.2s, color 0.2s' }}
      >
        {formatPercent(postTaxPerf)}
      </td>
    </>
  );
};
