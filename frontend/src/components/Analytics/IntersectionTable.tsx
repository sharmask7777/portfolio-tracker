/**
 * @file IntersectionTable.tsx
 * @module components/Analytics/IntersectionTable
 * @description Table rendering stock exposures and mutual fund overlaps.
 */

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { StockExposure } from '../../utils/hierarchy-builder';

export type SortField = 'name' | 'sector' | 'percentage' | 'absoluteValue';
export type SortDirection = 'asc' | 'desc';

interface IntersectionTableProps {
  filteredExposures: StockExposure[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  formatCurrency: (amount: unknown) => string;
  formatPercent: (ratio: unknown) => string;
  formatWeight: (percentageValue: unknown) => string;
}

export const IntersectionTable: React.FC<IntersectionTableProps> = ({
  filteredExposures,
  sortField,
  sortDirection,
  onSort,
  formatCurrency,
  formatPercent,
  formatWeight,
}) => {
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4, marginLeft: '4px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={14} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />
    );
  };

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th onClick={() => onSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                Stock Name {renderSortIndicator('name')}
              </div>
            </th>
            <th onClick={() => onSort('sector')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                Sector {renderSortIndicator('sector')}
              </div>
            </th>
            <th onClick={() => onSort('percentage')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                Total Exposure (%) {renderSortIndicator('percentage')}
              </div>
            </th>
            <th onClick={() => onSort('absoluteValue')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                Total Value {renderSortIndicator('absoluteValue')}
              </div>
            </th>
            <th>Contributing Funds & Allocation</th>
          </tr>
        </thead>
        <tbody>
          {filteredExposures.map((item, index) => {
            const isMultiFund = (item.contributions?.length || 0) > 1;

            return (
              <tr key={`${item.name}-${index}`}>
                <td style={{ fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{item.name}</span>
                    {isMultiFund && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                        title={`Present across ${item.contributions.length} mutual funds / portfolios`}
                      >
                        {item.contributions.length} Funds Overlap
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {item.sector || 'Other'}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                  {formatPercent(item.percentage)}
                </td>
                <td style={{ fontWeight: 500 }}>{formatCurrency(item.absoluteValue)}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {(item.contributions || []).map((contribution, contributionIndex) => (
                      <span
                        key={contributionIndex}
                        className="contribution-tag"
                        title={`${formatCurrency(contribution.value)} (${formatWeight(contribution.weight)} allocation in ${contribution.schemeName})`}
                      >
                        {contribution.schemeName}{' '}
                        <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>
                          ({formatWeight(contribution.weight)})
                        </strong>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
